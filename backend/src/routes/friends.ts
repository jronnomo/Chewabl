import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { requireAuth, AuthRequest } from '../middleware/auth';
import Friendship from '../models/Friendship';
import User from '../models/User';
import { sendPushNotification } from '../utils/pushNotifications';

const router = Router();

// List accepted friends
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const uid = new mongoose.Types.ObjectId(req.userId);

    // Fetch without populate so requester/recipient are raw ObjectIds
    const friendships = await Friendship.find({
      $or: [{ requester: uid }, { recipient: uid }],
      status: 'accepted',
    });

    // Extract the other person's ID from each friendship
    const friendIds = friendships.map(f =>
      f.requester.toString() === req.userId ? f.recipient : f.requester
    );

    // Fetch friend users directly and explicitly shape the response
    const friends = await User.find({ _id: { $in: friendIds } })
      .select('name phone avatarUri inviteCode');

    res.json(friends.map(u => ({
      id: u.id,
      name: u.name,
      phone: u.phone,
      avatarUri: u.avatarUri,
      inviteCode: u.inviteCode,
    })));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Pending requests — both received and sent
router.get('/requests', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const uid = new mongoose.Types.ObjectId(req.userId);

    // Received pending requests (someone sent to me)
    const received = await Friendship.find({ recipient: uid, status: 'pending' })
      .populate('requester', 'id name avatarUri');

    // Sent pending requests (I sent to someone)
    const sent = await Friendship.find({ requester: uid, status: 'pending' })
      .populate('recipient', 'id name avatarUri');

    const result = [
      ...received.map(r => ({
        id: r.id,
        from: r.requester,
        direction: 'received' as const,
        createdAt: r.createdAt,
      })),
      ...sent.map(s => ({
        id: s.id,
        to: s.recipient,
        direction: 'sent' as const,
        createdAt: s.createdAt,
      })),
    ];

    res.json(result);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Send friend request
router.post('/request', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.body as { userId: string };
    if (!userId) { res.status(400).json({ error: 'userId required' }); return; }
    if (userId === req.userId) { res.status(400).json({ error: 'Cannot add yourself' }); return; }

    const existing = await Friendship.findOne({
      $or: [
        { requester: req.userId, recipient: userId },
        { requester: userId, recipient: req.userId },
      ],
    });

    // F-007-006: Allow re-requesting after decline — delete declined friendship and create fresh
    if (existing) {
      if (existing.status === 'declined') {
        await Friendship.deleteOne({ _id: existing._id });
        // Fall through to create a new pending request below
      } else {
        res.status(409).json({ error: 'Friend request already exists', status: existing.status });
        return;
      }
    }

    const friendship = await Friendship.create({ requester: req.userId, recipient: userId, status: 'pending' });

    const [requester, recipient] = await Promise.all([
      User.findById(req.userId).select('name pushToken'),
      User.findById(userId).select('pushToken'),
    ]);
    if (recipient?.pushToken && requester) {
      await sendPushNotification(
        recipient.pushToken,
        'New Friend Request',
        `${requester.name} wants to be your friend on Chewabl`,
        { type: 'friend_request', friendshipId: friendship.id }
      );
    }

    res.status(201).json(friendship);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Accept or decline request
router.put('/request/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { action } = req.body as { action: 'accept' | 'decline' };
    const friendship = await Friendship.findOne({ _id: req.params.id, recipient: req.userId, status: 'pending' });
    if (!friendship) { res.status(404).json({ error: 'Request not found' }); return; }

    friendship.status = action === 'accept' ? 'accepted' : 'declined';
    await friendship.save();

    if (action === 'accept') {
      const [requester, recipient] = await Promise.all([
        User.findById(friendship.requester).select('pushToken'),
        User.findById(req.userId).select('name'),
      ]);
      if (requester?.pushToken && recipient) {
        await sendPushNotification(
          requester.pushToken,
          'Friend Request Accepted',
          `${recipient.name} accepted your friend request`,
          { type: 'friend_accepted' }
        );
      }
    }

    res.json({ ok: true, status: friendship.status });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// F-007-005: Remove friend — accepts either friendship._id or friend userId
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const uid = req.userId;
    const paramId = req.params.id;

    // Try to delete by friendship _id first
    const byId = await Friendship.deleteOne({
      _id: paramId,
      $or: [{ requester: uid }, { recipient: uid }],
    });

    if (byId.deletedCount > 0) {
      res.json({ ok: true });
      return;
    }

    // If not found by _id, try treating paramId as a friend's userId
    const byUserId = await Friendship.deleteOne({
      $or: [
        { requester: uid, recipient: paramId },
        { requester: paramId, recipient: uid },
      ],
      status: 'accepted',
    });

    res.json({ ok: true, deleted: byUserId.deletedCount > 0 });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
