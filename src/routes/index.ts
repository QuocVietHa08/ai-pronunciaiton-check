import { Router } from 'express';
import { analyzePronunciation } from '../controllers/pronunciationController';
import { upload } from '../middlewares/fileUpload';

const router = Router();

// Pronunciation analysis endpoint
router.post('/analyze-pronunciation', upload.single('audio'), analyzePronunciation);

export default router;