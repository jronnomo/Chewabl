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
    const friendships = await Friendship.find({
      $or: [{ requester: uid }, { recipient: uid }],
      status: 'accepted',
    }).populate('requester recipient', 'id name phone avatarUri');

    const friends = friendships.map(f => {
      const other = f.requester.toString() === req.userId ? f.recipient : f.requester;
      return other;
    });
    res.json(friends);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Pending requests sent to me
router.get('/requests', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const uid = new mongoose.Types.ObjectId(req.userId);
    const requests = await Friendship.find({ recipient: uid, status: 'pending' })
      .populate('requester', 'id name avatarUri');
    res.json(requests.map(r => ({ id: r.id, from: r.requester, createdAt: r.createdAt })));
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
    if (existing) {
      res.status(409).json({ error: 'Friend request already exists', status: existing.status });
      return;
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

// Remove friend
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const uid = req.userId;
    await Friendship.deleteOne({
      _id: req.params.id,
      $or: [{ requester: uid }, { recipient: uid }],
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
