import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import Notification from '../models/Notification';

const router = Router();

// Get paginated notifications for the authenticated user
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      Notification.find({ userId: req.userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments({ userId: req.userId }),
    ]);

    res.json({
      notifications,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get unread notification count
router.get('/unread-count', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const count = await Notification.countDocuments({ userId: req.userId, read: false });
    res.json({ count });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Mark a single notification as read
router.put('/:id/read', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { read: true },
      { new: true }
    );
    if (!notification) { res.status(404).json({ error: 'Notification not found' }); return; }
    res.json(notification);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Mark all notifications as read
router.put('/read-all', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await Notification.updateMany(
      { userId: req.userId, read: false },
      { read: true }
    );
    res.json({ ok: true, modifiedCount: result.modifiedCount });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a notification
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notification = await Notification.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!notification) { res.status(404).json({ error: 'Notification not found' }); return; }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
