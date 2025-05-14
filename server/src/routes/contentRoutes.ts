import express from 'express';
import contentController from '../controllers/contentController';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = express.Router();

router.use(authenticateJWT as express.RequestHandler);

router.get('/create', contentController.createContent as express.RequestHandler);

export default router;