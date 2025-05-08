import express from 'express';
import companyController from '../controllers/companyController';
import { authenticateJWT, isAdmin } from '../middleware/authMiddleware';

const router = express.Router();

// All routes require authentication
router.use(authenticateJWT);

// Get company details (all authenticated users)
router.get('/', companyController.getCompanyDetails);

// Update company details (admin only)
router.put('/', isAdmin, companyController.updateCompanyDetails);

// Get company settings (all authenticated users)
router.get('/settings', companyController.getCompanySettings);

// Update company settings (admin only)
router.put('/settings', isAdmin, companyController.updateCompanySettings);

// Get team members (all authenticated users)
router.get('/team', companyController.getCompanyTeam);

export default router;