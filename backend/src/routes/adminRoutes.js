import express from 'express';
import {
  addGuardianNote,
  addPoliceUpdate,
  checkCctvCamera,
  createCctvCamera,
  createCctvEvidenceRequest,
  createPolice,
  getCctvEvidenceUploadToken,
  getPoliceUpdates,
  listCctvCameras,
  listCctvEvidenceRequests,
  scanFaces,
  stats,
  updateCctvCamera,
  uploadCctvEvidence,
  users,
} from '../controllers/adminController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { upload } from '../utils/upload.js';
const router = express.Router();

router.get('/cctv-evidence/upload/:token', getCctvEvidenceUploadToken);
router.post('/cctv-evidence/upload/:token', upload.single('evidence'), uploadCctvEvidence);

router.use(requireAuth);
router.get('/stats', requireRole('admin'), stats);
router.get('/users', requireRole('admin'), users);
router.post('/police', requireRole('admin'), createPolice);
router.get('/cctv-cameras', requireRole('admin'), listCctvCameras);
router.post('/cctv-cameras', requireRole('admin'), createCctvCamera);
router.patch('/cctv-cameras/:id', requireRole('admin'), updateCctvCamera);
router.post('/cctv-cameras/:id/check', requireRole('admin'), checkCctvCamera);
router.get('/cctv-evidence-requests', requireRole('admin', 'police'), listCctvEvidenceRequests);
router.post('/cctv-evidence-requests', requireRole('admin', 'police'), createCctvEvidenceRequest);
// Face scan available to both admin and police
router.post('/scan-face', requireRole('admin', 'police'), upload.single('image'), scanFaces);
// Police update notes — admin and police
router.post('/cases/:id/updates', requireRole('admin', 'police'), addPoliceUpdate);
router.get('/cases/:id/updates', getPoliceUpdates);
router.post('/cases/:id/guardian-note', requireRole('guardian'), addGuardianNote);
export default router;
