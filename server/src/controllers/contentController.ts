import { AuthRequest } from "../middleware/authMiddleware.js";
import { Content, User, IgnoredError } from "../models/index.js";
import logger from "../utils/logger.js";
import { Response } from "express";
import { Model } from "sequelize";
import SaplingApiService from "../services/saplingApiService.js";
import SeoApiService from "../services/seoApiService.js";
import AnthropicApiService from "../services/anthropicApiService.js";

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

// Interface for ignored error
interface IgnoredErrorInterface {
  id: number;
  user_id: number;
  token: string;
  type: string;
  created_at: Date;
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

// Check if an error is in the user's ignored list
const isErrorIgnored = (error: SpellcheckError, ignoredErrors: IgnoredErrorInterface[]): boolean => {
  return ignoredErrors.some(ignored =>
    ignored.token === error.token && ignored.type === error.type
  );
};

// Filter out ignored errors from a list of spellcheck errors
const filterIgnoredErrors = (errors: SpellcheckError[], ignoredErrors: IgnoredErrorInterface[]): SpellcheckError[] => {
  return errors.filter(error => !isErrorIgnored(error, ignoredErrors));
};

// Load a user's ignored errors
const loadIgnoredErrors = async (userId: number): Promise<IgnoredErrorInterface[]> => {
  try {
    const ignoredErrors = await IgnoredError.findAll({
      where: { user_id: userId }
    }) as unknown as IgnoredErrorInterface[];

    logger.info(`Loaded ${ignoredErrors.length} ignored errors for user ${userId}`);
    return ignoredErrors;
  } catch (error) {
    logger.error('Error loading ignored errors:', error);
    return [];
  }
};

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

        // Load user's ignored errors from database
        const ignoredErrors = await loadIgnoredErrors(req.user.id);

        // Filter out ignored errors before returning
        const filteredErrors = filterIgnoredErrors(cachedResult.errors, ignoredErrors);

        return res.status(200).json({
          success: true,
          errors: filteredErrors
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

    // Cache the result (store all errors, including those that might be ignored)
    spellcheckCache.set(cacheKey, {
      errors,
      timestamp: Date.now()
    });

    // Load user's ignored errors from database
    const ignoredErrors = await loadIgnoredErrors(req.user.id);

    // Filter out ignored errors
    const filteredErrors = filterIgnoredErrors(errors, ignoredErrors);

    logger.info('Spellcheck complete', {
      userId: req.user.id,
      totalErrors: errors.length,
      filteredErrors: filteredErrors.length,
      cached: true
    });

    return res.status(200).json({
      success: true,
      errors: filteredErrors
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

// Get all ignored errors for the current user
const getIgnoredErrors = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const ignoredErrors = await IgnoredError.findAll({
      where: { user_id: req.user.id }
    });

    return res.status(200).json({
      success: true,
      ignoredErrors
    });
  } catch (error) {
    logger.error('Error fetching ignored errors:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching ignored errors',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

// Add a new ignored error
const addIgnoredError = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { token, type } = req.body;

    if (!token || !type) {
      return res.status(400).json({
        success: false,
        message: 'Token and type are required'
      });
    }

    // Check if already exists
    const existing = await IgnoredError.findOne({
      where: {
        user_id: req.user.id,
        token,
        type
      }
    });

    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'Error already ignored',
        ignoredError: existing
      });
    }

    // Create new record
    const ignoredError = await IgnoredError.create({
      user_id: req.user.id,
      token,
      type
    } as any);  // Using 'as any' to bypass TypeScript check since created_at has a default value

    return res.status(201).json({
      success: true,
      message: 'Error ignored successfully',
      ignoredError
    });
  } catch (error) {
    logger.error('Error adding ignored error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding ignored error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

// Remove an ignored error
const removeIgnoredError = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { id } = req.params;

    const ignoredError = await IgnoredError.findOne({
      where: {
        id,
        user_id: req.user.id
      }
    });

    if (!ignoredError) {
      return res.status(404).json({
        success: false,
        message: 'Ignored error not found'
      });
    }

    await ignoredError.destroy();

    return res.status(200).json({
      success: true,
      message: 'Ignored error removed successfully'
    });
  } catch (error) {
    logger.error('Error removing ignored error:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing ignored error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

// Clear all ignored errors for a user
const clearIgnoredErrors = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    await IgnoredError.destroy({
      where: { user_id: req.user.id }
    });

    return res.status(200).json({
      success: true,
      message: 'All ignored errors cleared successfully'
    });
  } catch (error) {
    logger.error('Error clearing ignored errors:', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing ignored errors',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

// Generate a text summary using DataForSEO API
const generateTextSummary = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { text, languageCode } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Text is required'
      });
    }

    const result = await SeoApiService.generateTextSummary(text, languageCode || 'en-US');

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error generating text summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating text summary',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

// Generate content suggestions using DataForSEO API
const generateContentSuggestions = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { text, debug } = req.body;
    const includeDebugInfo = debug === true || process.env.NODE_ENV === 'development';

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Text is required'
      });
    }

    logger.info('Generating content suggestions for user:', req.user.id);
    const result = await SeoApiService.getContentSuggestions(text);
    logger.info('Content suggestions generated successfully');

    // Prepare a response with or without debug info
    const responseData = includeDebugInfo ?
      result : // Include full result with all API data for debugging
      {
        // Extract only the essential data for production
        summary: result.summary,
        relatedKeywords: result.relatedKeywords,
        analyzedKeywords: result.analyzedKeywords
      };

    // Add debug metadata if requested
    if (includeDebugInfo) {
      // Create a structured debug summary of the response
      const debugInfo = {
        summary: {
          status: result.summary.status_code,
          hasResults: Boolean(result.summary.tasks?.[0]?.result),
          resultCount: result.summary.tasks?.[0]?.result?.length || 0
        },
        relatedKeywords: {
          status: result.relatedKeywords.status_code,
          hasResults: Boolean(result.relatedKeywords.tasks?.[0]?.result),
          resultCount: result.relatedKeywords.tasks?.[0]?.result?.length || 0,
          firstResultKeys: result.relatedKeywords.tasks?.[0]?.result?.[0] ?
            Object.keys(result.relatedKeywords.tasks[0].result[0]) : []
        },
        analyzedKeywords: result.analyzedKeywords
      };

      return res.status(200).json({
        success: true,
        data: responseData,
        debug: debugInfo
      });
    }

    return res.status(200).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    logger.error('Error generating content suggestions:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating content suggestions',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

// Analyze content for a specific keyword using DataForSEO API
const analyzeKeyword = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { text, keyword, debug } = req.body;
    const includeDebugInfo = debug === true || process.env.NODE_ENV === 'development';

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Text is required'
      });
    }

    if (!keyword || keyword.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Keyword is required'
      });
    }

    logger.info(`Analyzing keyword "${keyword}" for user: ${req.user.id}`);

    // First get text summary
    const summaryResponse = await SeoApiService.generateTextSummary(text);

    // Then get related keywords for the specific keyword
    const relatedKeywordsResponse = await SeoApiService.getRelatedKeywords(keyword);

    // Get top keywords from the text summary for context
    let analyzedKeywords: string[] = [];
    if (summaryResponse.tasks?.[0]?.result?.[0]?.keyword_density) {
      const keywordDensity = summaryResponse.tasks[0].result[0].keyword_density as Record<string, number>;
      analyzedKeywords = Object.entries(keywordDensity)
        .filter(([k]) => k.length > 2) // Filter out short keywords
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k]) => k);
    }

    // Extract keywords directly
    let extractedKeywords = [];
    if (relatedKeywordsResponse.tasks?.[0]?.result) {
      const results = relatedKeywordsResponse.tasks[0].result;

      if (results.length > 0) {
        // Case 1: Check if results have the keyword property directly
        if (results[0].keyword && typeof results[0].keyword === 'string') {
          logger.info('Found direct keyword structure');
          extractedKeywords = results;
        }
        // Case 2: Check if results have keyword_data with related_keywords
        else if (results[0].keyword_data && results[0].keyword_data.related_keywords) {
          logger.info('Found nested keyword_data structure');
          extractedKeywords = results[0].keyword_data.related_keywords;
        }
      }
    }

    const result = {
      summary: summaryResponse,
      relatedKeywords: relatedKeywordsResponse,
      analyzedKeywords: analyzedKeywords,
      extractedKeywords: extractedKeywords
    };

    // Prepare response with or without debug info
    const responseData = includeDebugInfo ?
      result : // Include full result for debugging
      {
        summary: result.summary,
        relatedKeywords: result.relatedKeywords,
        analyzedKeywords: result.analyzedKeywords,
        extractedKeywords: result.extractedKeywords
      };

    // Add debug metadata if requested
    if (includeDebugInfo) {
      const debugInfo = {
        summary: {
          status: result.summary.status_code,
          hasResults: Boolean(result.summary.tasks?.[0]?.result),
          resultCount: result.summary.tasks?.[0]?.result?.length || 0
        },
        relatedKeywords: {
          status: result.relatedKeywords.status_code,
          hasResults: Boolean(result.relatedKeywords.tasks?.[0]?.result),
          resultCount: result.relatedKeywords.tasks?.[0]?.result?.length || 0,
          firstResultKeys: result.relatedKeywords.tasks?.[0]?.result?.[0] ?
            Object.keys(result.relatedKeywords.tasks[0].result[0]) : []
        },
        targetKeyword: keyword,
        analyzedKeywords: result.analyzedKeywords
      };

      return res.status(200).json({
        success: true,
        data: responseData,
        debug: debugInfo
      });
    }

    return res.status(200).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    logger.error('Error analyzing keyword:', error);
    res.status(500).json({
      success: false,
      message: 'Error analyzing keyword',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

// Suggest content rewrites using Anthropic API
const suggestContentRewrites = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { content, targetKeywords, existingAnalysis } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Content is required'
      });
    }

    if (!targetKeywords || !Array.isArray(targetKeywords) || targetKeywords.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Target keywords are required'
      });
    }

    // Remove HTML tags for cleaner text
    const plainText = content.replace(/<[^>]*>/g, ' ').trim();

    logger.info(`Requesting content rewrites for user ${req.user.id} with keywords: ${targetKeywords.join(', ')}`);

    // Define the SeoInsights interface to match the one in AnthropicApiService
    interface SeoInsights {
      analyzedKeywords?: string[];
      relatedKeywords?: Array<{
        keyword: string;
        search_volume?: number;
        competition?: string;
      }>;
      readabilityLevel?: string;
      textSummary?: any;
    }

    // Get SEO insights to enhance the suggestions
    let seoInsights: SeoInsights | undefined = undefined;

    // Check if existing analysis is provided in the request
    if (existingAnalysis &&
      typeof existingAnalysis === 'object' &&
      (existingAnalysis.analyzedKeywords || existingAnalysis.relatedKeywords)) {

      logger.info('Using provided existing analysis data');

      // Use the provided analysis data
      seoInsights = {
        analyzedKeywords: existingAnalysis.analyzedKeywords || [],
        relatedKeywords: Array.isArray(existingAnalysis.relatedKeywords)
          ? existingAnalysis.relatedKeywords
          : [],
        readabilityLevel: existingAnalysis.readabilityLevel || 'Unknown',
        textSummary: existingAnalysis.textSummary || null
      };
    } else {
      // No existing analysis provided, so perform the API calls
      try {
        // First get text summary for insights
        const summaryResponse = await SeoApiService.generateTextSummary(plainText);

        // Get related keywords based on primary target keyword
        const primaryKeyword = targetKeywords[0]; // Use the first keyword for related keywords
        const relatedKeywordsResponse = await SeoApiService.getRelatedKeywords(primaryKeyword);

        // Determine readability level
        const readabilityLevel = getReadabilityLevel(
          summaryResponse.tasks?.[0]?.result?.[0]?.coleman_liau_index
        );

        // Extract analyzed keywords from text summary
        let analyzedKeywords: string[] = [];
        if (summaryResponse.tasks?.[0]?.result?.[0]?.keyword_density) {
          const keywordDensity = summaryResponse.tasks[0].result[0].keyword_density as Record<string, number>;
          analyzedKeywords = Object.entries(keywordDensity)
            .filter(([k]) => k.length > 2) // Filter out short keywords
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([k]) => k);
        }

        // Extract related keywords
        let relatedKeywords: Array<{
          keyword: string;
          search_volume?: number;
          competition?: string;
        }> = [];

        if (relatedKeywordsResponse.tasks?.[0]?.result) {
          const results = relatedKeywordsResponse.tasks[0].result;

          if (results.length > 0) {
            // Case 1: Direct keyword structure
            if (results[0].keyword && typeof results[0].keyword === 'string') {
              relatedKeywords = results.map(item => ({
                keyword: item.keyword,
                search_volume: item.search_volume || 0,
                competition: item.competition || 'LOW'
              }));
            }
            // Case 2: Nested keyword_data structure
            else if (results[0].keyword_data && results[0].keyword_data.related_keywords) {
              relatedKeywords = results[0].keyword_data.related_keywords.map(item => ({
                keyword: item.keyword,
                search_volume: item.search_volume || 0,
                competition: item.competition || 'LOW'
              }));
            }
          }
        }

        // Build insights object
        seoInsights = {
          analyzedKeywords,
          relatedKeywords,
          readabilityLevel,
          textSummary: summaryResponse.tasks?.[0]?.result?.[0]
        };

        logger.info('Successfully gathered SEO insights for content rewrite suggestions');
      } catch (insightsError) {
        logger.warn('Error getting SEO insights, continuing without them:', insightsError);
        // Continue without insights if there's an error
      }
    }

    // Call Anthropic API for suggestions, passing the SEO insights if available
    const result = await AnthropicApiService.suggestContentRewrites(plainText, targetKeywords, seoInsights);

    // Process the raw suggestions into structured format
    const processedSuggestions = AnthropicApiService.processSuggestions(result.suggestions);

    logger.info(`Generated ${processedSuggestions.length} content rewrite suggestions`);

    return res.status(200).json({
      success: true,
      suggestions: processedSuggestions,
      rawSuggestions: result.suggestions,
      insights: seoInsights ? {
        analyzedKeywords: seoInsights.analyzedKeywords || [],
        relatedKeywords: seoInsights.relatedKeywords?.map(k => k.keyword) || [],
        readabilityLevel: seoInsights.readabilityLevel || 'Unknown'
      } : null
    });
  } catch (error) {
    logger.error('Error suggesting content rewrites:', error);
    res.status(500).json({
      success: false,
      message: 'Error suggesting content rewrites',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

// Helper function to determine readability level from Coleman-Liau index
const getReadabilityLevel = (colemanLiauIndex: number): string => {
  if (!colemanLiauIndex && colemanLiauIndex !== 0) return "Unknown";

  if (colemanLiauIndex < 6) return "Elementary";
  if (colemanLiauIndex < 10) return "Middle School";
  if (colemanLiauIndex < 14) return "High School";
  if (colemanLiauIndex < 18) return "College";
  return "Professional";
};

export default {
  createContent,
  getDrafts,
  getDraft,
  saveDraft,
  deleteDraft,
  spellcheck,
  acceptSpellcheckEdit,
  rejectSpellcheckEdit,
  getIgnoredErrors,
  addIgnoredError,
  removeIgnoredError,
  clearIgnoredErrors,
  generateTextSummary,
  generateContentSuggestions,
  analyzeKeyword,
  suggestContentRewrites
} as Record<string, (req: AuthRequest, res: Response) => Promise<any>>;