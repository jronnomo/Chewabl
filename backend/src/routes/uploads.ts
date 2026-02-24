import { Router, Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { requireAuth, AuthRequest } from '../middleware/auth';
import User from '../models/User';

const router = Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

router.post('/avatar', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { image } = req.body;
    if (!image || typeof image !== 'string') {
      res.status(400).json({ error: 'image (base64 data URI) is required' });
      return;
    }

    const result = await cloudinary.uploader.upload(image, {
      folder: 'chewabl/avatars',
      public_id: req.userId,
      overwrite: true,
      transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
    });

    await User.findByIdAndUpdate(req.userId, { avatarUri: result.secure_url });

    res.json({ avatarUri: result.secure_url });
  } catch (err) {
    console.error('/uploads/avatar error:', err);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

export default router;
