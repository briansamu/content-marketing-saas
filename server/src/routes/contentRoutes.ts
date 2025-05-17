import express from 'express';
import contentController from '../controllers/contentController.js';
import { isAuthenticated } from '../middleware/authMiddleware.js';

const router = express.Router();

// Use session authentication only
router.use(isAuthenticated as express.RequestHandler);

router.get('/create', contentController.createContent as express.RequestHandler);

// Draft management endpoints
router.get('/drafts', contentController.getDrafts as express.RequestHandler);
router.get('/drafts/:id', contentController.getDraft as express.RequestHandler);
router.post('/drafts', contentController.saveDraft as express.RequestHandler);
router.put('/drafts', contentController.saveDraft as express.RequestHandler);
router.delete('/drafts/:id', contentController.deleteDraft as express.RequestHandler);

// Spellcheck endpoints
router.post('/spellcheck', contentController.spellcheck as express.RequestHandler);
router.post('/spellcheck/accept/:editId', contentController.acceptSpellcheckEdit as express.RequestHandler);
router.post('/spellcheck/reject/:editId', contentController.rejectSpellcheckEdit as express.RequestHandler);

// Ignored errors endpoints
router.get('/spellcheck/ignored', contentController.getIgnoredErrors as express.RequestHandler);
router.post('/spellcheck/ignored', contentController.addIgnoredError as express.RequestHandler);
router.delete('/spellcheck/ignored/:id', contentController.removeIgnoredError as express.RequestHandler);
router.delete('/spellcheck/ignored', contentController.clearIgnoredErrors as express.RequestHandler);

// Seo endpoints
router.post('/seo/text-summary', contentController.generateTextSummary as express.RequestHandler);
router.post('/seo/content-suggestions', contentController.generateContentSuggestions as express.RequestHandler);
router.post('/seo/keyword-analysis', contentController.analyzeKeyword as express.RequestHandler);

// AI content optimization endpoints
router.post('/ai/suggest-rewrites', contentController.suggestContentRewrites as express.RequestHandler);

export default router;