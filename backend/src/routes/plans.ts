import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import Plan from '../models/Plan';
import User from '../models/User';
import { createNotification, createNotificationForMany } from '../utils/createNotification';
import { tallyWinner } from '../utils/tallyVotes';

const router = Router();

// Get all plans the current user owns or is invited to
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const plans = await Plan.find({
      $or: [
        { ownerId: req.userId },
        { 'invites.userId': req.userId },
      ],
    }).sort({ createdAt: -1 });

    // Collect all user IDs (owners + invitees) to fetch fresh avatars
    const allUserIds = new Set<string>();
    for (const p of plans) {
      allUserIds.add(p.ownerId.toString());
      for (const inv of p.invites) allUserIds.add(inv.userId.toString());
    }
    const users = await User.find({ _id: { $in: [...allUserIds] } }, 'name avatarUri').lean();
    const userMap = new Map(users.map(u => [u._id.toString(), { name: u.name, avatarUri: (u as any).avatarUri }]));

    const enriched = plans.map(p => {
      const ownerInfo = userMap.get(p.ownerId.toString());
      const planJson = p.toJSON();
      // Freshen invite avatars from current user data
      if (planJson.invites) {
        planJson.invites = planJson.invites.map((inv: any) => {
          const fresh = userMap.get(inv.userId.toString());
          return fresh ? { ...inv, avatarUri: fresh.avatarUri } : inv;
        });
      }
      return { ...planJson, ownerName: ownerInfo?.name, ownerAvatarUri: ownerInfo?.avatarUri };
    });

    res.json(enriched);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single plan with check-on-access auto-decline
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) { res.status(404).json({ error: 'Plan not found' }); return; }

    // Check-on-access: auto-decline pending invites if RSVP deadline passed
    if (plan.type === 'planned' && plan.status === 'voting' && plan.rsvpDeadline && plan.rsvpDeadline.getTime() <= Date.now()) {
      const pendingInvites = plan.invites.filter(i => i.status === 'pending');
      if (pendingInvites.length > 0) {
        for (const invite of pendingInvites) {
          invite.status = 'declined';
          invite.respondedAt = new Date();
        }
        await plan.save();

        // Fire notifications asynchronously (don't block the response)
        setImmediate(async () => {
          try {
            for (const invite of pendingInvites) {
              await createNotification({
                userId: invite.userId.toString(),
                type: 'rsvp_deadline_passed' as any,
                title: 'RSVP Deadline Passed',
                body: `You didn't respond to "${plan.title}" in time.`,
                data: { planId: plan.id },
              });
              await createNotification({
                userId: plan.ownerId.toString(),
                type: 'rsvp_deadline_missed_organizer' as any,
                title: 'RSVP Deadline Missed',
                body: `${invite.name} didn't respond to "${plan.title}" before the deadline.`,
                data: { planId: plan.id },
              });
            }
          } catch (err) {
            console.error('Check-on-access notification error:', err);
          }
        });
      }
    }

    const owner = await User.findById(plan.ownerId, 'name avatarUri').lean();
    res.json({ ...plan.toJSON(), ownerName: owner?.name, ownerAvatarUri: (owner as any)?.avatarUri });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create plan
router.post('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, date, time, cuisine, budget, inviteeIds, rsvpDeadline, options, type, status: reqStatus, restaurant, restaurantOptions, restaurantCount, allowCurveball } = req.body as {
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
      restaurantCount?: number;
      allowCurveball?: boolean;
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

    // Validate restaurantCount if provided
    if (restaurantCount !== undefined) {
      if (!Number.isInteger(restaurantCount) || restaurantCount < 5 || restaurantCount > 20) {
        res.status(400).json({ error: 'restaurantCount must be an integer between 5 and 20' }); return;
      }
    }

    // Require RSVP deadline for planned events
    if (type !== 'group-swipe' && !rsvpDeadline) {
      res.status(400).json({ error: 'RSVP deadline is required for planned events' }); return;
    }

    const owner = await User.findById(req.userId).select('name avatarUri');
    if (!owner) { res.status(404).json({ error: 'User not found' }); return; }

    const isGroupSwipe = type === 'group-swipe';
    const invites: { userId: string; name: string; avatarUri?: string; status: 'pending' }[] = [];

    if (inviteeIds && inviteeIds.length > 0) {
      const invitees = await User.find({ _id: { $in: inviteeIds } }).select('name avatarUri');
      invitees.forEach(u => {
        invites.push({ userId: u.id, name: u.name, avatarUri: u.avatarUri, status: 'pending' });
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
      ...(restaurantCount !== undefined ? { restaurantCount } : {}),
      ...(allowCurveball !== undefined ? { allowCurveball } : {}),
      invites,
      rsvpDeadline: rsvpDeadline ? new Date(rsvpDeadline) : undefined,
      options: options || [],
      votes: {},
      restaurantOptions: restaurantOptions || [],
      swipesCompleted: [],
    });

    // Notify invitees
    if (invites.length > 0) {
      const inviteeUserIds = invites.map(i => i.userId);
      const notifType = isGroupSwipe ? 'group_swipe_invite' : 'plan_invite';
      await createNotificationForMany(
        inviteeUserIds,
        notifType as any,
        isGroupSwipe ? 'Group Swipe Started!' : 'Dining Plan Invite',
        isGroupSwipe
          ? `${owner.name} started a group swipe — tap to vote!`
          : `${owner.name} invited you to "${title}"`,
        { planId: plan.id }
      );
    }

    // F-005-004: RSVP reminders need a proper job scheduler (e.g. Bull, Agenda).
    // The previous setTimeout-based approach is unreliable (lost on restart).
    // TODO: Implement with a job scheduler when infrastructure supports it.

    res.status(201).json({ ...plan.toJSON(), ownerName: owner.name, ownerAvatarUri: owner.avatarUri });
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

    // Reject RSVP if deadline has passed for planned events
    if (plan.type === 'planned' && plan.rsvpDeadline && plan.rsvpDeadline.getTime() <= Date.now()) {
      res.status(400).json({ error: 'RSVP deadline has passed' });
      return;
    }

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

    const responder = await User.findById(req.userId).select('name');
    if (responder) {
      await createNotification({
        userId: plan.ownerId.toString(),
        type: 'rsvp_response',
        title: action === 'accept' ? 'RSVP Accepted' : 'RSVP Declined',
        body: `${responder.name} ${action === 'accept' ? 'accepted' : 'declined'} your invite to "${plan.title}"`,
        data: { planId: plan.id, action },
      });
    }

    // When an invitee declines a voting group-swipe plan, check if remaining participants are all done
    if (action === 'decline' && plan.type === 'group-swipe' && plan.status === 'voting') {
      const allParticipantIds = [
        plan.ownerId.toString(),
        ...plan.invites.filter(i => i.status !== 'declined').map(i => i.userId.toString()),
      ];
      const allDone = allParticipantIds.length > 0 && allParticipantIds.every(pid => plan.swipesCompleted.includes(pid));
      if (allDone) {
        const winner = tallyWinner(plan);
        if (winner) {
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

    // For planned events, reject swipe if RSVP deadline hasn't passed AND invites are still pending
    const hasPendingInvites = plan.invites.some(i => i.status === 'pending');
    if (plan.type === 'planned' && plan.rsvpDeadline && plan.rsvpDeadline.getTime() > Date.now() && hasPendingInvites) {
      res.status(400).json({ error: 'Voting is not yet open. RSVP deadline has not passed.' }); return;
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

    // Notify other participants that this user finished swiping
    const swiper = await User.findById(userId).select('name');
    if (swiper) {
      const otherIds = [
        plan.ownerId.toString(),
        ...plan.invites.filter(i => i.status !== 'declined').map(i => i.userId.toString()),
      ].filter(pid => pid !== userId);
      if (otherIds.length > 0) {
        await createNotificationForMany(
          otherIds,
          'swipe_completed',
          'Swipe Update',
          `${swiper.name} finished swiping for "${plan.title}"`,
          { planId: plan.id }
        );
      }
    }

    // Check if all participants have swiped (owner + non-declined invitees)
    const allParticipantIds = [
      plan.ownerId.toString(),
      ...plan.invites.filter(i => i.status !== 'declined').map(i => i.userId.toString()),
    ];
    const allDone = allParticipantIds.every(pid => plan.swipesCompleted.includes(pid));

    if (allDone) {
      const winner = tallyWinner(plan);
      if (winner) {
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

        // Notify other participants about the result
        const otherParticipantIds = allParticipantIds.filter(pid => pid !== userId);
        if (otherParticipantIds.length > 0) {
          await createNotificationForMany(
            otherParticipantIds,
            'group_swipe_result',
            'Group Pick Decided!',
            `The group picked ${winner.name} for "${plan.title}"`,
            { planId: plan.id }
          );
        }
      }
    }

    await plan.save();
    const swipeOwner = await User.findById(plan.ownerId, 'name avatarUri').lean();
    res.json({ ...plan.toJSON(), ownerName: swipeOwner?.name, ownerAvatarUri: (swipeOwner as any)?.avatarUri });
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

    const { title, date, time, cuisine, budget, options, rsvpDeadline, restaurant, allowCurveball, restaurantOptions } = req.body;
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
    if (allowCurveball !== undefined) plan.allowCurveball = allowCurveball;
    if (restaurantOptions !== undefined) plan.restaurantOptions = restaurantOptions;

    await plan.save();
    const putOwner = await User.findById(plan.ownerId, 'name avatarUri').lean();
    res.json({ ...plan.toJSON(), ownerName: putOwner?.name, ownerAvatarUri: (putOwner as any)?.avatarUri });
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

    // When cancelling, set cancelledAt and notify invitees
    if (status === 'cancelled') {
      plan.cancelledAt = new Date();
      const inviteeIds = plan.invites.map(i => i.userId.toString());
      if (inviteeIds.length > 0) {
        const owner = await User.findById(req.userId).select('name');
        await createNotificationForMany(
          inviteeIds,
          'plan_cancelled',
          'Plan Cancelled',
          `"${plan.title}" has been cancelled by ${owner?.name ?? 'the organizer'}`,
          { planId: plan.id }
        );
      }
    }

    // When confirming a voting plan, tally votes and pick winner
    if (status === 'confirmed' && !plan.restaurant) {
      const winner = tallyWinner(plan);
      if (winner) {
        plan.restaurant = {
          id: winner.id,
          name: winner.name,
          imageUrl: winner.imageUrl,
          address: winner.address,
          cuisine: winner.cuisine,
          priceLevel: winner.priceLevel,
          rating: winner.rating,
        };
      }
    }

    await plan.save();
    const statusOwner = await User.findById(plan.ownerId, 'name avatarUri').lean();
    res.json({ ...plan.toJSON(), ownerName: statusOwner?.name, ownerAvatarUri: (statusOwner as any)?.avatarUri });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delegate organizer role to an accepted invitee
router.post('/:id/delegate', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { newOwnerId } = req.body as { newOwnerId: string };
    if (!newOwnerId) { res.status(400).json({ error: 'newOwnerId is required' }); return; }

    const plan = await Plan.findById(req.params.id);
    if (!plan) { res.status(404).json({ error: 'Plan not found' }); return; }
    if (plan.ownerId.toString() !== req.userId) {
      res.status(403).json({ error: 'Only the plan owner can delegate' }); return;
    }
    if (plan.status === 'completed' || plan.status === 'cancelled') {
      res.status(400).json({ error: 'Cannot delegate on a completed or cancelled plan' }); return;
    }

    const newOwnerInvite = plan.invites.find(
      i => i.userId.toString() === newOwnerId && i.status === 'accepted'
    );
    if (!newOwnerInvite) {
      res.status(400).json({ error: 'New owner must be an accepted invitee' }); return;
    }

    // Block on 2-person plans (owner + 1 invitee) — old owner leaving would leave 1 person
    if (plan.invites.length < 2) {
      res.status(400).json({ error: 'Cannot delegate on a 2-person plan. Cancel instead.' }); return;
    }

    const oldOwnerId = plan.ownerId.toString();
    const oldOwner = await User.findById(oldOwnerId).select('name');
    const newOwner = await User.findById(newOwnerId).select('name');

    // Transfer ownership
    plan.ownerId = newOwnerId as any;
    // Remove new owner from invites (they're now the owner)
    plan.invites = plan.invites.filter(i => i.userId.toString() !== newOwnerId);
    // Old owner leaves entirely — don't add them back to invites

    // Clean up old owner's votes and swipes
    if (plan.votes instanceof Map) {
      plan.votes.delete(oldOwnerId);
    }
    plan.swipesCompleted = plan.swipesCompleted.filter(id => id !== oldOwnerId);

    await plan.save();

    // Notify new organizer
    await createNotification({
      userId: newOwnerId,
      type: 'organizer_delegated',
      title: "You're Now the Organizer",
      body: `${oldOwner?.name ?? 'Someone'} made you the organizer of "${plan.title}"`,
      data: { planId: plan.id },
    });

    // Notify other participants
    const otherInviteeIds = plan.invites
      .map(i => i.userId.toString())
      .filter(id => id !== newOwnerId);
    if (otherInviteeIds.length > 0) {
      await createNotificationForMany(
        otherInviteeIds,
        'organizer_changed',
        'New Organizer',
        `${newOwner?.name ?? 'Someone'} is now the organizer of "${plan.title}"`,
        { planId: plan.id }
      );
    }

    const enrichedOwner = await User.findById(plan.ownerId, 'name avatarUri').lean();
    res.json({ ...plan.toJSON(), ownerName: enrichedOwner?.name, ownerAvatarUri: (enrichedOwner as any)?.avatarUri });
  } catch (err) {
    console.error('POST /plans/:id/delegate error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Leave plan (non-owner participant)
router.post('/:id/leave', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) { res.status(404).json({ error: 'Plan not found' }); return; }
    if (plan.ownerId.toString() === req.userId) {
      res.status(403).json({ error: 'Owner cannot leave. Cancel or delegate instead.' }); return;
    }

    const inviteIndex = plan.invites.findIndex(i => i.userId.toString() === req.userId);
    if (inviteIndex === -1) {
      res.status(403).json({ error: 'You are not a participant in this plan' }); return;
    }
    if (plan.status === 'completed' || plan.status === 'cancelled') {
      res.status(400).json({ error: 'Cannot leave a completed or cancelled plan' }); return;
    }

    const leavingInvite = plan.invites[inviteIndex];
    const wasAccepted = leavingInvite.status === 'accepted';
    const leaver = await User.findById(req.userId).select('name');

    // Remove from invites
    plan.invites.splice(inviteIndex, 1);

    // Clean up votes and swipes
    if (plan.votes instanceof Map) {
      plan.votes.delete(req.userId!);
    }
    plan.swipesCompleted = plan.swipesCompleted.filter(id => id !== req.userId);

    // Check if auto-cancel needed: if leaver was accepted and no accepted invitees remain
    let autoCancelled = false;
    if (wasAccepted) {
      const acceptedRemaining = plan.invites.filter(i => i.status === 'accepted').length;
      if (acceptedRemaining === 0) {
        plan.status = 'cancelled';
        plan.cancelledAt = new Date();
        autoCancelled = true;
      }
    }

    await plan.save();

    if (autoCancelled) {
      // Notify owner about auto-cancellation
      await createNotification({
        userId: plan.ownerId.toString(),
        type: 'plan_auto_cancelled',
        title: 'Plan Auto-Cancelled',
        body: `"${plan.title}" was cancelled — not enough participants`,
        data: { planId: plan.id },
      });
    } else {
      // Notify remaining participants
      const remainingIds = [
        plan.ownerId.toString(),
        ...plan.invites.map(i => i.userId.toString()),
      ];
      if (remainingIds.length > 0) {
        await createNotificationForMany(
          remainingIds,
          'participant_left',
          'Participant Left',
          `${leaver?.name ?? 'Someone'} has left "${plan.title}"`,
          { planId: plan.id }
        );
      }
    }

    res.json({ ok: true, autoCancelled });
  } catch (err) {
    console.error('POST /plans/:id/leave error:', err);
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
