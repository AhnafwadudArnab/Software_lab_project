import express from 'express';
import { createPolice, scanFaces, stats, users } from '../controllers/adminController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { upload } from '../utils/upload.js';
const router = express.Router();
router.use(requireAuth);
router.get('/stats', requireRole('admin'), stats);
router.get('/users', requireRole('admin'), users);
router.post('/police', requireRole('admin'), createPolice);
// Face scan available to both admin and police
router.post('/scan-face', requireRole('admin', 'police'), upload.single('image'), scanFaces);
export default router;
