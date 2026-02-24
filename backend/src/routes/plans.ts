import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import Plan from '../models/Plan';
import User from '../models/User';
import { sendPushNotification, sendPushToMany } from '../utils/pushNotifications';

const router = Router();

// Get all plans the current user owns or is invited to
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const plans = await Plan.find({
      $or: [
        { ownerId: req.userId },
        { 'invites.userId': req.userId },
      ],
    }).sort({ date: 1 });
    res.json(plans);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// F-005-007: Get single plan (removed auto-decline logic)
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) { res.status(404).json({ error: 'Plan not found' }); return; }
    res.json(plan);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create plan
router.post('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, date, time, cuisine, budget, inviteeIds, rsvpDeadline, options, type, status: reqStatus, restaurant, restaurantOptions } = req.body as {
      title: string;
      date?: string;
      time?: string;
      cuisine: string;
      budget: string;
      inviteeIds?: string[];
      rsvpDeadline?: string;
      options?: string[];
      type?: 'planned' | 'group-swipe';
      status?: 'voting' | 'confirmed';
      restaurant?: { id: string; name: string; imageUrl: string; address: string; cuisine: string; priceLevel: number; rating: number };
      restaurantOptions?: Array<Record<string, unknown>>;
    };

    // Input length validation
    if (!title || typeof title !== 'string' || title.length > 100) {
      res.status(400).json({ error: 'Title is required and must be 100 characters or less' }); return;
    }
    if (type !== 'group-swipe' && (!date || !time)) {
      res.status(400).json({ error: 'Date and time are required' }); return;
    }
    if (cuisine && cuisine.length > 50) {
      res.status(400).json({ error: 'Cuisine must be 50 characters or less' }); return;
    }
    if (inviteeIds && inviteeIds.length > 50) {
      res.status(400).json({ error: 'Cannot invite more than 50 people' }); return;
    }
    if (options && options.length > 20) {
      res.status(400).json({ error: 'Cannot have more than 20 options' }); return;
    }

    const owner = await User.findById(req.userId).select('name avatarUri');
    if (!owner) { res.status(404).json({ error: 'User not found' }); return; }

    const isGroupSwipe = type === 'group-swipe';
    const invites: { userId: string; name: string; avatarUri?: string; status: 'pending' }[] = [];
    const pushTokens: string[] = [];

    if (inviteeIds && inviteeIds.length > 0) {
      const invitees = await User.find({ _id: { $in: inviteeIds } }).select('name avatarUri pushToken');
      invitees.forEach(u => {
        invites.push({ userId: u.id, name: u.name, avatarUri: u.avatarUri, status: 'pending' });
        if (u.pushToken) pushTokens.push(u.pushToken);
      });
    }

    const plan = await Plan.create({
      type: type || 'planned',
      title,
      ...(date ? { date } : {}),
      ...(time ? { time } : {}),
      ownerId: req.userId,
      status: (type === 'group-swipe' && reqStatus) ? reqStatus : 'voting',
      cuisine: cuisine || 'Any',
      budget: budget || '$$',
      ...(restaurant ? { restaurant } : {}),
      invites,
      rsvpDeadline: rsvpDeadline ? new Date(rsvpDeadline) : undefined,
      options: options || [],
      votes: {},
      restaurantOptions: restaurantOptions || [],
      swipesCompleted: [],
    });

    // Notify invitees
    if (pushTokens.length > 0) {
      const notifTitle = isGroupSwipe ? 'Group Swipe Started!' : 'Dining Plan Invite';
      const notifBody = isGroupSwipe
        ? `${owner.name} started a group swipe — tap to vote!`
        : `${owner.name} invited you to "${title}"`;
      await sendPushToMany(
        pushTokens,
        notifTitle,
        notifBody,
        { type: isGroupSwipe ? 'group_swipe_invite' : 'plan_invite', planId: plan.id }
      );
    }

    // F-005-004: RSVP reminders need a proper job scheduler (e.g. Bull, Agenda).
    // The previous setTimeout-based approach is unreliable (lost on restart).
    // TODO: Implement with a job scheduler when infrastructure supports it.

    res.status(201).json(plan);
  } catch (err) {
    console.error('POST /plans error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// RSVP to a plan
router.post('/:id/rsvp', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { action } = req.body as { action: 'accept' | 'decline' };
    const plan = await Plan.findById(req.params.id);
    if (!plan) { res.status(404).json({ error: 'Plan not found' }); return; }

    // F-005-015: Reject RSVP if plan date+time has passed
    // Group-swipe plans have no date — skip the past-plan check
    if (plan.date) {
      let planDateTime: Date;
      if (plan.time) {
        const timeMatch = plan.time.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
        if (timeMatch) {
          let h = parseInt(timeMatch[1], 10);
          const m = parseInt(timeMatch[2], 10);
          const isPM = timeMatch[3].toUpperCase() === 'PM';
          if (isPM && h !== 12) h += 12;
          if (!isPM && h === 12) h = 0;
          const [year, month, day] = plan.date.split('-').map(Number);
          planDateTime = new Date(year, month - 1, day, h, m);
        } else {
          planDateTime = new Date(plan.date);
        }
      } else {
        planDateTime = new Date(plan.date);
      }
      if (planDateTime.getTime() < Date.now()) {
        res.status(400).json({ error: 'Cannot RSVP to a past plan' });
        return;
      }
    }

    const invite = plan.invites.find(i => i.userId.toString() === req.userId);
    if (!invite) { res.status(403).json({ error: 'You are not invited to this plan' }); return; }

    // F-005-019: Prevent re-RSVP if already responded
    if (invite.status !== 'pending') {
      res.status(400).json({ error: 'You have already responded to this invite' });
      return;
    }

    invite.status = action === 'accept' ? 'accepted' : 'declined';
    invite.respondedAt = new Date();
    await plan.save();

    const [owner, responder] = await Promise.all([
      User.findById(plan.ownerId).select('pushToken'),
      User.findById(req.userId).select('name'),
    ]);
    if (owner?.pushToken && responder) {
      await sendPushNotification(
        owner.pushToken,
        action === 'accept' ? 'RSVP Accepted' : 'RSVP Declined',
        `${responder.name} ${action === 'accept' ? 'accepted' : 'declined'} your invite to "${plan.title}"`,
        { type: 'rsvp_response', planId: plan.id, action }
      );
    }

    // When an invitee declines a voting group-swipe plan, check if remaining participants are all done
    if (action === 'decline' && plan.type === 'group-swipe' && plan.status === 'voting') {
      const allParticipantIds = [
        plan.ownerId.toString(),
        ...plan.invites.filter(i => i.status !== 'declined').map(i => i.userId.toString()),
      ];
      const allDone = allParticipantIds.length > 0 && allParticipantIds.every(pid => plan.swipesCompleted.includes(pid));
      if (allDone) {
        // Tally votes and pick winner
        const voteCounts: Record<string, number> = {};
        const votesObj: Record<string, string[]> = plan.votes instanceof Map ? Object.fromEntries(plan.votes) : (plan.votes as Record<string, string[]>);
        for (const userVotes of Object.values(votesObj)) {
          for (const rid of userVotes) {
            voteCounts[rid] = (voteCounts[rid] || 0) + 1;
          }
        }
        const sorted = plan.restaurantOptions
          .map(r => ({ restaurant: r, count: voteCounts[r.id] || 0 }))
          .sort((a, b) => b.count - a.count || b.restaurant.rating - a.restaurant.rating);

        if (sorted.length > 0) {
          const winner = sorted[0].restaurant;
          plan.restaurant = {
            id: winner.id,
            name: winner.name,
            imageUrl: winner.imageUrl,
            address: winner.address,
            cuisine: winner.cuisine,
            priceLevel: winner.priceLevel,
            rating: winner.rating,
          };
          plan.status = 'confirmed';
          await plan.save();
        }
      }
    }

    res.json({ ok: true, status: invite.status });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Submit swipe votes for a group-swipe plan
router.post('/:id/swipe', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { votes } = req.body as { votes: string[] };
    if (!Array.isArray(votes)) {
      res.status(400).json({ error: 'votes must be an array of restaurant IDs' }); return;
    }

    const plan = await Plan.findById(req.params.id);
    if (!plan) { res.status(404).json({ error: 'Plan not found' }); return; }
    if (plan.status !== 'voting') {
      res.status(400).json({ error: 'Plan is not in voting status' }); return;
    }

    // Check user is owner or invitee (pending or accepted — swiping auto-accepts)
    const userId = req.userId!;
    const isOwner = plan.ownerId.toString() === userId;
    const invite = plan.invites.find(i => i.userId.toString() === userId);
    const isInvitee = !!invite && invite.status !== 'declined';
    if (!isOwner && !isInvitee) {
      res.status(403).json({ error: 'You are not a participant in this plan' }); return;
    }

    // Check user hasn't already swiped
    if (plan.swipesCompleted.includes(userId)) {
      res.status(400).json({ error: 'You have already submitted swipes for this plan' }); return;
    }

    // Validate vote IDs exist in restaurantOptions
    const validIds = new Set(plan.restaurantOptions.map(r => r.id));
    const invalidVotes = votes.filter(v => !validIds.has(v));
    if (invalidVotes.length > 0) {
      res.status(400).json({ error: 'Some vote IDs are not in restaurantOptions' }); return;
    }

    // Auto-accept pending invitee on swipe (swiping = accepting)
    if (invite && invite.status === 'pending') {
      invite.status = 'accepted';
      invite.respondedAt = new Date();
    }

    // Store votes using Map set method
    if (plan.votes instanceof Map) {
      plan.votes.set(userId, votes);
    } else {
      (plan.votes as unknown as Map<string, string[]>).set(userId, votes);
    }
    plan.swipesCompleted.push(userId);

    // Check if all participants have swiped (owner + non-declined invitees)
    const allParticipantIds = [
      plan.ownerId.toString(),
      ...plan.invites.filter(i => i.status !== 'declined').map(i => i.userId.toString()),
    ];
    const allDone = allParticipantIds.every(pid => plan.swipesCompleted.includes(pid));

    if (allDone) {
      // Tally votes and pick winner
      const voteCounts: Record<string, number> = {};
      const votesObj2: Record<string, string[]> = plan.votes instanceof Map ? Object.fromEntries(plan.votes) : (plan.votes as Record<string, string[]>);
      for (const userVotes of Object.values(votesObj2)) {
        for (const rid of userVotes) {
          voteCounts[rid] = (voteCounts[rid] || 0) + 1;
        }
      }
      const sorted = plan.restaurantOptions
        .map(r => ({ restaurant: r, count: voteCounts[r.id] || 0 }))
        .sort((a, b) => b.count - a.count || b.restaurant.rating - a.restaurant.rating);

      if (sorted.length > 0) {
        const winner = sorted[0].restaurant;
        plan.restaurant = {
          id: winner.id,
          name: winner.name,
          imageUrl: winner.imageUrl,
          address: winner.address,
          cuisine: winner.cuisine,
          priceLevel: winner.priceLevel,
          rating: winner.rating,
        };
        plan.status = 'confirmed';

        // Send push notification to all participants
        const participantUsers = await User.find({ _id: { $in: allParticipantIds } }).select('pushToken');
        const pushTokens = participantUsers
          .filter(u => u.pushToken && u.id !== userId)
          .map(u => u.pushToken!);
        if (pushTokens.length > 0) {
          await sendPushToMany(
            pushTokens,
            'Group Pick Decided!',
            `The group picked ${winner.name} for "${plan.title}"`,
            { type: 'group_swipe_result', planId: plan.id }
          );
        }
      }
    }

    await plan.save();
    res.json(plan);
  } catch (err) {
    console.error('POST /plans/:id/swipe error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update plan (owner only)
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) { res.status(404).json({ error: 'Plan not found' }); return; }
    if (plan.ownerId.toString() !== req.userId) {
      res.status(403).json({ error: 'Only the plan owner can update this plan' });
      return;
    }

    const { title, date, time, cuisine, budget, options, rsvpDeadline, restaurant } = req.body;
    if (title !== undefined && (typeof title !== 'string' || title.length > 100)) {
      res.status(400).json({ error: 'Title must be 100 characters or less' }); return;
    }
    if (cuisine !== undefined && typeof cuisine === 'string' && cuisine.length > 50) {
      res.status(400).json({ error: 'Cuisine must be 50 characters or less' }); return;
    }
    if (options !== undefined && Array.isArray(options) && options.length > 20) {
      res.status(400).json({ error: 'Cannot have more than 20 options' }); return;
    }
    if (title !== undefined) plan.title = title;
    if (date !== undefined) plan.date = date;
    if (time !== undefined) plan.time = time;
    if (cuisine !== undefined) plan.cuisine = cuisine;
    if (budget !== undefined) plan.budget = budget;
    if (options !== undefined) plan.options = options;
    if (rsvpDeadline !== undefined) plan.rsvpDeadline = rsvpDeadline ? new Date(rsvpDeadline) : undefined;
    if (restaurant !== undefined) plan.restaurant = restaurant || undefined;

    await plan.save();
    res.json(plan);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// F-005-020: Update plan status (owner only)
router.put('/:id/status', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.body as { status: 'confirmed' | 'completed' | 'cancelled' };
    if (!['confirmed', 'completed', 'cancelled'].includes(status)) {
      res.status(400).json({ error: 'Invalid status. Must be confirmed, completed, or cancelled' });
      return;
    }

    const plan = await Plan.findById(req.params.id);
    if (!plan) { res.status(404).json({ error: 'Plan not found' }); return; }
    if (plan.ownerId.toString() !== req.userId) {
      res.status(403).json({ error: 'Only the plan owner can update status' });
      return;
    }

    // State machine: only allow valid transitions
    const validTransitions: Record<string, string[]> = {
      voting: ['confirmed', 'cancelled'],
      confirmed: ['completed', 'cancelled'],
    };
    const allowed = validTransitions[plan.status ?? 'voting'] ?? [];
    if (!allowed.includes(status)) {
      res.status(400).json({ error: `Cannot transition from ${plan.status ?? 'voting'} to ${status}` });
      return;
    }

    plan.status = status;
    await plan.save();
    res.json(plan);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// F-005-021: Delete plan (owner only)
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) { res.status(404).json({ error: 'Plan not found' }); return; }
    if (plan.ownerId.toString() !== req.userId) {
      res.status(403).json({ error: 'Only the plan owner can delete this plan' });
      return;
    }

    await Plan.deleteOne({ _id: plan._id });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
