import { AuthRequest } from "../middleware/authMiddleware.js";
import { Content, User } from "../models/index.js";
import logger from "../utils/logger.js";
import { Response } from "express";
import { Model } from "sequelize";
import SaplingApiService from "../services/saplingApiService.js";

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

// Interface for spellcheck error
interface SpellcheckError {
  offset: number;
  token: string;
  type: string;
  suggestions: string[];
}

// Cache for spellcheck results to minimize API calls
const spellcheckCache = new Map<string, any>();

// Max cache size (number of entries)
const MAX_CACHE_SIZE = 1000;

// Time-to-live for cache entries (24 hours)
const CACHE_TTL = 24 * 60 * 60 * 1000;

// Minimum content length to check
const MIN_CONTENT_LENGTH = 20;

// Generate a cache key that's more specific than just the first 100 chars
const generateCacheKey = (userId: number, content: string): string => {
  // Create a fingerprint from the content by sampling it at different positions
  const contentLength = content.length;
  let fingerprint = '';

  // Take samples from beginning, middle, and end
  if (contentLength <= 100) {
    fingerprint = content;
  } else {
    // Beginning (30 chars)
    fingerprint += content.substring(0, 30);

    // Middle (30 chars)
    const middleStart = Math.floor(contentLength / 2) - 15;
    fingerprint += content.substring(middleStart, middleStart + 30);

    // End (30 chars)
    fingerprint += content.substring(contentLength - 30);

    // Add content length as another dimension
    fingerprint += `-${contentLength}`;
  }

  return `spellcheck-${userId}-${fingerprint}`;
};

// Sapling API Service instance
const saplingApiService = new SaplingApiService();

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

// Spellcheck content
const spellcheck = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Text content is required'
      });
    }

    logger.info('Processing spellcheck request', {
      userId: req.user.id,
      contentLength: text.length
    });

    // Remove HTML tags to get plain text for spellchecking
    const plainText = text.replace(/<[^>]*>/g, ' ').trim();

    // Skip very short content
    if (plainText.length < MIN_CONTENT_LENGTH) {
      logger.info('Content too short for spellcheck', { length: plainText.length });
      return res.status(200).json({
        success: true,
        errors: []
      });
    }

    logger.debug('Plain text for spellcheck', {
      length: plainText.length,
      sample: plainText.substring(0, 50) + (plainText.length > 50 ? '...' : '')
    });

    // Generate a more robust cache key
    const cacheKey = generateCacheKey(req.user.id, plainText);

    if (spellcheckCache.has(cacheKey)) {
      const cachedResult = spellcheckCache.get(cacheKey);
      if (cachedResult.timestamp > Date.now() - CACHE_TTL) {
        logger.info('Using cached spellcheck result', {
          userId: req.user.id,
          errorCount: cachedResult.errors.length,
          age: Math.round((Date.now() - cachedResult.timestamp) / 1000) + 's'
        });
        return res.status(200).json({
          success: true,
          errors: cachedResult.errors
        });
      } else {
        // Remove expired cache entry
        logger.debug('Removing expired cache entry');
        spellcheckCache.delete(cacheKey);
      }
    }

    // If cache is too large, remove oldest entries
    if (spellcheckCache.size >= MAX_CACHE_SIZE) {
      // Simple approach: clear half the cache when it gets full
      // A more sophisticated approach would use LRU cache
      logger.info('Cache size limit reached, clearing oldest entries', {
        cacheSize: spellcheckCache.size,
        limit: MAX_CACHE_SIZE
      });

      const cacheEntries = Array.from(spellcheckCache.entries());
      cacheEntries.sort((a, b) => a[1].timestamp - b[1].timestamp);

      // Delete oldest half
      const toDelete = cacheEntries.slice(0, Math.floor(MAX_CACHE_SIZE / 2));
      for (const [key] of toDelete) {
        spellcheckCache.delete(key);
      }

      logger.debug('Cache entries removed', {
        removedCount: toDelete.length,
        newSize: spellcheckCache.size
      });
    }

    let errors: SpellcheckError[] = [];

    try {
      // Create a session ID for this spellcheck request
      const sessionId = `user-${req.user.id}-${Date.now()}`;

      // Use the Sapling API Service for spellchecking
      logger.info('Calling Sapling API for spellcheck');
      const saplingResponse = await saplingApiService.spellCheck(plainText, sessionId);

      // Convert Sapling's edit format to our error format
      if (saplingResponse.edits && saplingResponse.edits.length > 0) {
        errors = saplingResponse.edits.map(edit => {
          // Determine what kind of suggestions to provide based on the error type
          const suggestions = [edit.replacement];

          // Calculate the absolute offset in the plainText (not HTML)
          const absoluteOffset = edit.sentence_start + edit.start;

          // Extract the exact token from the plainText for better matching
          const originalToken = plainText.substring(absoluteOffset, absoluteOffset + (edit.end - edit.start));

          // Debug the token extraction
          logger.info('Extracting token from text:', {
            originalText: edit.sentence,
            tokenFromEdit: edit.sentence.substring(edit.start, edit.end),
            tokenFromPlainText: originalToken,
            start: edit.start,
            end: edit.end,
            sentenceStart: edit.sentence_start
          });

          return {
            offset: absoluteOffset,
            token: originalToken,
            type: edit.general_error_type.toLowerCase(),
            suggestions,
            // Store the original edit ID so we can provide feedback to Sapling later
            editId: edit.id
          } as SpellcheckError & { editId: string };
        });

        logger.info('Transformed Sapling response', {
          errorCount: errors.length,
          firstErrors: errors.slice(0, 3).map(e => e.token).join(', ')
        });
      } else {
        logger.info('No errors found by Sapling API');

        // If we're in development mode and got no results, provide mock data for testing
        if (process.env.NODE_ENV === 'development') {
          logger.info('Using mock data for development');

          if (plainText.includes('teh')) {
            errors.push({
              offset: plainText.indexOf('teh'),
              token: 'teh',
              type: 'spelling',
              suggestions: ['the', 'tech', 'ten']
            });
          }

          if (plainText.includes('recieve')) {
            errors.push({
              offset: plainText.indexOf('recieve'),
              token: 'recieve',
              type: 'spelling',
              suggestions: ['receive', 'received', 'receiver']
            });
          }

          if (plainText.includes('thier')) {
            errors.push({
              offset: plainText.indexOf('thier'),
              token: 'thier',
              type: 'spelling',
              suggestions: ['their', 'there', 'they\'re']
            });
          }
        }
      }
    } catch (error) {
      logger.error('Error calling spellcheck API:', error);
      // Continue with empty errors array
    }

    // Cache the result
    spellcheckCache.set(cacheKey, {
      errors,
      timestamp: Date.now()
    });

    logger.info('Spellcheck complete', {
      userId: req.user.id,
      errorCount: errors.length,
      cached: true
    });

    return res.status(200).json({
      success: true,
      errors
    });
  } catch (error) {
    logger.error('Spellcheck error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking spelling',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

// New endpoint to accept a spellcheck suggestion
const acceptSpellcheckEdit = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { editId } = req.params;
    const sessionId = `user-${req.user.id}`;

    // Send accept feedback to Sapling
    const success = await saplingApiService.acceptEdit(editId, sessionId);

    return res.status(success ? 200 : 400).json({
      success
    });
  } catch (error) {
    logger.error('Error accepting spellcheck edit:', error);
    res.status(500).json({
      success: false,
      message: 'Error accepting edit',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

// New endpoint to reject a spellcheck suggestion
const rejectSpellcheckEdit = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { editId } = req.params;
    const sessionId = `user-${req.user.id}`;

    // Send reject feedback to Sapling
    const success = await saplingApiService.rejectEdit(editId, sessionId);

    return res.status(success ? 200 : 400).json({
      success
    });
  } catch (error) {
    logger.error('Error rejecting spellcheck edit:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting edit',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

export default {
  createContent,
  getDrafts,
  getDraft,
  saveDraft,
  deleteDraft,
  spellcheck,
  acceptSpellcheckEdit,
  rejectSpellcheckEdit
} as Record<string, (req: AuthRequest, res: Response) => Promise<any>>;