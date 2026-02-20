import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import User from '../models/User';

const router = Router();

router.get('/me', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId).select('-passwordHash');
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/me', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, phone, avatarUri } = req.body;
    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: { name, phone, avatarUri } },
      { new: true, runValidators: true }
    ).select('-passwordHash');
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/push-token', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { pushToken } = req.body;
    await User.findByIdAndUpdate(req.userId, { $set: { pushToken } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Look up users by phone numbers (for contacts import)
router.post('/lookup', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { phones } = req.body as { phones: string[] };
    if (!Array.isArray(phones) || phones.length === 0) {
      res.status(400).json({ error: 'phones array required' });
      return;
    }
    const users = await User.find({ phone: { $in: phones } }).select('id name phone avatarUri inviteCode');
    res.json(users);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Look up user by invite code
router.get('/invite/:code', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findOne({ inviteCode: req.params.code.toUpperCase() }).select('id name avatarUri inviteCode');
    if (!user) { res.status(404).json({ error: 'Invite code not found' }); return; }
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
