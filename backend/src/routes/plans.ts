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

// Get single plan — auto-decline expired pending invites
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) { res.status(404).json({ error: 'Plan not found' }); return; }

    if (plan.rsvpDeadline && new Date() > plan.rsvpDeadline) {
      let changed = false;
      plan.invites.forEach(invite => {
        if (invite.status === 'pending') {
          invite.status = 'declined';
          invite.respondedAt = new Date();
          changed = true;
        }
      });
      if (changed) await plan.save();
    }

    res.json(plan);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create plan
router.post('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, date, time, cuisine, budget, inviteeIds, rsvpDeadline, options } = req.body as {
      title: string;
      date: string;
      time: string;
      cuisine: string;
      budget: string;
      inviteeIds?: string[];
      rsvpDeadline?: string;
      options?: string[];
    };

    const owner = await User.findById(req.userId).select('name avatarUri');
    if (!owner) { res.status(404).json({ error: 'User not found' }); return; }

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
      title,
      date,
      time,
      ownerId: req.userId,
      cuisine: cuisine || 'Any',
      budget: budget || '$$',
      invites,
      rsvpDeadline: rsvpDeadline ? new Date(rsvpDeadline) : undefined,
      options: options || [],
      votes: {},
    });

    // Notify invitees
    if (pushTokens.length > 0) {
      await sendPushToMany(
        pushTokens,
        'Dining Plan Invite',
        `${owner.name} invited you to "${title}"`,
        { type: 'plan_invite', planId: plan.id }
      );
    }

    // Schedule 24h reminder before rsvpDeadline
    if (rsvpDeadline && pushTokens.length > 0) {
      const deadlineMs = new Date(rsvpDeadline).getTime();
      const reminderMs = deadlineMs - 24 * 60 * 60 * 1000;
      const delay = reminderMs - Date.now();
      if (delay > 0) {
        setTimeout(async () => {
          try {
            const freshPlan = await Plan.findById(plan.id);
            if (!freshPlan) return;
            const pendingUserIds = freshPlan.invites
              .filter(i => i.status === 'pending')
              .map(i => i.userId.toString());
            if (pendingUserIds.length === 0) return;
            const pendingUsers = await User.find({ _id: { $in: pendingUserIds }, pushToken: { $exists: true } });
            const tokens = pendingUsers.map(u => u.pushToken!).filter(Boolean);
            await sendPushToMany(tokens, 'RSVP Reminder', `24 hours left to respond to "${title}"`, { type: 'rsvp_reminder', planId: plan.id });
          } catch (e) {
            console.error('Reminder push error:', e);
          }
        }, delay);
      }
    }

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

    const invite = plan.invites.find(i => i.userId.toString() === req.userId);
    if (!invite) { res.status(403).json({ error: 'You are not invited to this plan' }); return; }

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

    res.json({ ok: true, status: invite.status });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
