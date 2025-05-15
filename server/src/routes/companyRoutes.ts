import express from 'express';
import companyController from '../controllers/companyController';
import { authenticateJWT, isAuthenticated, isAdmin } from '../middleware/authMiddleware';

const router = express.Router();

// All routes require authentication
router.use(isAuthenticated as express.RequestHandler);

// Get company details (all authenticated users)
router.get('/', companyController.getCompanyDetails as express.RequestHandler);

// Update company details (admin only)
router.put('/', isAdmin as express.RequestHandler, companyController.updateCompanyDetails as express.RequestHandler);

// Get company settings (all authenticated users)
router.get('/settings', companyController.getCompanySettings as express.RequestHandler);

// Update company settings (admin only)
router.put('/settings', isAdmin as express.RequestHandler, companyController.updateCompanySettings as express.RequestHandler);

// Get team members (all authenticated users)
router.get('/team', companyController.getCompanyTeam as express.RequestHandler);

export default router;