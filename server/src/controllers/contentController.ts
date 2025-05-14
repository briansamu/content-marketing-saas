import { AuthRequest } from "../middleware/authMiddleware.js";
import { Content, User } from "../models/index.js";
import logger from "../utils/logger.js";
import { Response } from "express";
import { Model } from "sequelize";

// Interface for Content model instance
interface ContentInstance extends Model {
  id: number;
  user_id: number;
  title: string;
  content: string;
  status: string;
  content_type: string;
  seo_score: number;
  created_at: Date;
  updated_at: Date;
}

const createContent = async (req, res) => {
  try {
    const { title, textContent, category, source, published_at, url, relevance_score } = req.body;

    const content = await Content.create({
      user_id: req.user.id,
      title,
      content: textContent,
      status: 'draft',
      content_type: 'article',
      seo_score: 0
    });

    return res.status(201).json({
      success: true,
      message: 'Content created successfully',
      data: content
    });
  } catch (error) {
    logger.error('Error creating content:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating content',
      error: error.message
    });
  }
};

// Get all drafts for a user
const getDrafts = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const drafts = await Content.findAll({
      where: {
        user_id: req.user.id,
        status: 'draft'
      },
      order: [['updated_at', 'DESC']]
    }) as ContentInstance[];

    // Transform to match client-side ContentDraft interface
    const formattedDrafts = drafts.map(draft => ({
      id: draft.id.toString(),
      title: draft.title,
      content: draft.content,
      wordCount: draft.content ? draft.content.split(/\s+/).filter(Boolean).length : 0,
      lastSaved: draft.updated_at,
      status: draft.status,
      storageLocation: 'cloud'
    }));

    return res.status(200).json({
      success: true,
      drafts: formattedDrafts
    });
  } catch (error) {
    logger.error('Error fetching drafts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching drafts',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

// Get a specific draft
const getDraft = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { id } = req.params;

    const draft = await Content.findOne({
      where: {
        id,
        user_id: req.user.id
      }
    }) as ContentInstance | null;

    if (!draft) {
      return res.status(404).json({
        success: false,
        message: 'Draft not found'
      });
    }

    // Transform to match client-side ContentDraft interface
    const formattedDraft = {
      id: draft.id.toString(),
      title: draft.title,
      content: draft.content,
      wordCount: draft.content ? draft.content.split(/\s+/).filter(Boolean).length : 0,
      lastSaved: draft.updated_at,
      status: draft.status,
      storageLocation: 'cloud'
    };

    return res.status(200).json({
      success: true,
      draft: formattedDraft
    });
  } catch (error) {
    logger.error('Error fetching draft:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching draft',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

// Create or update a draft
const saveDraft = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { id, title, content, status } = req.body;

    let draft: ContentInstance;

    if (id && !id.startsWith('draft-')) {
      // Update existing draft
      const existingDraft = await Content.findOne({
        where: {
          id,
          user_id: req.user.id
        }
      }) as ContentInstance | null;

      if (!existingDraft) {
        return res.status(404).json({
          success: false,
          message: 'Draft not found'
        });
      }

      await existingDraft.update({
        title,
        content,
        status: status || 'draft'
      });

      draft = existingDraft;
    } else {
      // Create new draft
      draft = await Content.create({
        user_id: req.user.id,
        title,
        content,
        status: status || 'draft',
        content_type: 'article',
        seo_score: 0
      }) as ContentInstance;
    }

    // Transform to match client-side ContentDraft interface
    const formattedDraft = {
      id: draft.id.toString(),
      title: draft.title,
      content: draft.content,
      wordCount: draft.content ? draft.content.split(/\s+/).filter(Boolean).length : 0,
      lastSaved: draft.updated_at,
      status: draft.status,
      storageLocation: 'cloud'
    };

    return res.status(200).json({
      success: true,
      message: id ? 'Draft updated successfully' : 'Draft created successfully',
      draft: formattedDraft
    });
  } catch (error) {
    logger.error('Error saving draft:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving draft',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

// Delete a draft
const deleteDraft = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { id } = req.params;

    const draft = await Content.findOne({
      where: {
        id,
        user_id: req.user.id
      }
    }) as ContentInstance | null;

    if (!draft) {
      return res.status(404).json({
        success: false,
        message: 'Draft not found'
      });
    }

    await draft.destroy();

    return res.status(200).json({
      success: true,
      message: 'Draft deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting draft:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting draft',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

export default {
  createContent,
  getDrafts,
  getDraft,
  saveDraft,
  deleteDraft
} as Record<string, (req: AuthRequest, res: Response) => Promise<any>>;