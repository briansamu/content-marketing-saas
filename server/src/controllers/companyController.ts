import { Request, Response } from 'express';
import { Company, User } from '../models';
import { AuthRequest } from '../middleware/authMiddleware';
import logger from '../utils/logger';

// Get company details
export const getCompanyDetails = async (req: AuthRequest, res: Response) => {
  try {
    const company_id = req.user?.company_id;

    if (!company_id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized or missing company information'
      });
    }

    const company = await Company.findByPk(company_id);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Company details retrieved successfully',
      data: company
    });
  } catch (error) {
    logger.error('Error fetching company details:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching company details',
      error: error.message
    });
  }
};

// Update company details
export const updateCompanyDetails = async (req: AuthRequest, res: Response) => {
  try {
    const company_id = req.user?.company_id;

    if (!company_id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized or missing company information'
      });
    }

    const {
      name,
      billing_email,
      billing_address,
      custom_domain,
      logo_url
    } = req.body;

    const company = await Company.findByPk(company_id);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    // Update company fields
    await company.update({
      name: name !== undefined ? name : company.name,
      billing_email: billing_email !== undefined ? billing_email : company.billing_email,
      billing_address: billing_address !== undefined ? billing_address : company.billing_address,
      custom_domain: custom_domain !== undefined ? custom_domain : company.custom_domain,
      logo_url: logo_url !== undefined ? logo_url : company.logo_url
    });

    return res.status(200).json({
      success: true,
      message: 'Company details updated successfully',
      data: company
    });
  } catch (error) {
    logger.error('Error updating company details:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating company details',
      error: error.message
    });
  }
};

// Get company settings
export const getCompanySettings = async (req: AuthRequest, res: Response) => {
  try {
    const company_id = req.user?.company_id;

    if (!company_id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized or missing company information'
      });
    }

    const company = await Company.findByPk(company_id);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Company settings retrieved successfully',
      data: {
        settings: company.settings
      }
    });
  } catch (error) {
    logger.error('Error fetching company settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching company settings',
      error: error.message
    });
  }
};

// Update company settings
export const updateCompanySettings = async (req: AuthRequest, res: Response) => {
  try {
    const company_id = req.user?.company_id;

    if (!company_id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized or missing company information'
      });
    }

    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Invalid settings format'
      });
    }

    const company = await Company.findByPk(company_id);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    // Merge existing settings with new ones
    const updatedSettings = {
      ...company.settings,
      ...settings
    };

    // Update company settings
    await company.update({
      settings: updatedSettings
    });

    return res.status(200).json({
      success: true,
      message: 'Company settings updated successfully',
      data: {
        settings: updatedSettings
      }
    });
  } catch (error) {
    logger.error('Error updating company settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating company settings',
      error: error.message
    });
  }
};

// Get company team members
export const getCompanyTeam = async (req: AuthRequest, res: Response) => {
  try {
    const company_id = req.user?.company_id;

    if (!company_id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized or missing company information'
      });
    }

    const team = await User.findAll({
      where: { company_id },
      attributes: ['id', 'email', 'first_name', 'last_name', 'role', 'status', 'last_login', 'created_at']
    });

    return res.status(200).json({
      success: true,
      message: 'Company team retrieved successfully',
      data: team
    });
  } catch (error) {
    logger.error('Error fetching company team:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching company team',
      error: error.message
    });
  }
};

export default {
  getCompanyDetails,
  updateCompanyDetails,
  getCompanySettings,
  updateCompanySettings,
  getCompanyTeam
} as Record<string, (req: AuthRequest, res: Response) => Promise<any>>;