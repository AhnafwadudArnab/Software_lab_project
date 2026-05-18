import express from 'express';
import { createPolice, scanFaces, stats, users, addPoliceUpdate, getPoliceUpdates } from '../controllers/adminController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { upload } from '../utils/upload.js';
const router = express.Router();
router.use(requireAuth);
router.get('/stats', requireRole('admin'), stats);
router.get('/users', requireRole('admin'), users);
router.post('/police', requireRole('admin'), createPolice);
// Face scan available to both admin and police
router.post('/scan-face', requireRole('admin', 'police'), upload.single('image'), scanFaces);
// Police update notes — admin and police
router.post('/cases/:id/updates', requireRole('admin', 'police'), addPoliceUpdate);
router.get('/cases/:id/updates', requireRole('admin', 'police'), getPoliceUpdates);
export default router;
