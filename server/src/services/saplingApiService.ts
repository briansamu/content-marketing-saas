import dotenv from 'dotenv';
import axios from 'axios';
import logger from '../utils/logger.js';

dotenv.config();

const SAPLING_API_KEY = process.env.SAPLING_API_KEY;
const SAPLING_API_URL = 'https://api.sapling.ai/api/v1/edits';

// Configuration for cost optimization
const MAX_TEXT_LENGTH = 5000; // Maximum text length to check at once
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds
const MAX_REQUESTS_PER_WINDOW = 30; // Max requests per minute

export interface SaplingEditResult {
  id: string;
  sentence: string;
  sentence_start: number;
  start: number;
  end: number;
  replacement: string;
  error_type: string;
  general_error_type: string;
}

export interface SaplingResponse {
  edits: SaplingEditResult[];
}

class SaplingApiService {
  // Track API usage for rate limiting
  private requestTimestamps: number[] = [];
  private recentQueries: Map<string, { response: SaplingResponse, timestamp: number }> = new Map();
  private readonly RECENT_QUERY_TTL = 10 * 60 * 1000; // 10 minutes

  // Check if we're being rate limited
  private isRateLimited(): boolean {
    const now = Date.now();

    // Remove timestamps older than the window
    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => now - timestamp < RATE_LIMIT_WINDOW
    );

    // Check if we've hit the limit
    if (this.requestTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
      logger.warn('Sapling API rate limit reached, throttling requests', {
        requestCount: this.requestTimestamps.length,
        window: `${RATE_LIMIT_WINDOW / 1000}s`,
        limit: MAX_REQUESTS_PER_WINDOW
      });
      return true;
    }

    return false;
  }

  // Clean up old entries in the recent queries cache
  private cleanupRecentQueries(): void {
    const now = Date.now();

    for (const [key, value] of this.recentQueries.entries()) {
      if (now - value.timestamp > this.RECENT_QUERY_TTL) {
        this.recentQueries.delete(key);
      }
    }

    // If map gets too large, remove oldest entries
    if (this.recentQueries.size > 100) {
      const entries = Array.from(this.recentQueries.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);

      // Remove oldest half
      const toRemove = entries.slice(0, 50);
      for (const [key] of toRemove) {
        this.recentQueries.delete(key);
      }
    }
  }

  // Generate a simple hash for a text string
  private hashText(text: string): string {
    let hash = 0;
    if (text.length === 0) return hash.toString();

    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return hash.toString(16);
  }

  // Check if a similar text was already processed recently
  private checkRecentQueries(text: string): SaplingResponse | null {
    // Clean up old entries first
    this.cleanupRecentQueries();

    // Create a simplified fingerprint of the text
    // For very similar texts, we can reuse results
    const simplifiedText = text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');

    const hash = this.hashText(simplifiedText);

    // Check if we've recently processed this text
    if (this.recentQueries.has(hash)) {
      const cachedResult = this.recentQueries.get(hash);
      if (cachedResult) {
        logger.info('Using recently cached Sapling API result');
        return cachedResult.response;
      }
    }

    return null;
  }

  // Store a result in the recent queries cache
  private storeRecentQuery(text: string, response: SaplingResponse): void {
    const simplifiedText = text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');

    const hash = this.hashText(simplifiedText);

    this.recentQueries.set(hash, {
      response,
      timestamp: Date.now()
    });
  }

  async spellCheck(text: string, sessionId: string = 'default-session') {
    try {
      // Log API configuration
      logger.info('Sapling API Service Configuration:', {
        apiKeyExists: !!SAPLING_API_KEY,
        apiKeyLength: SAPLING_API_KEY ? SAPLING_API_KEY.length : 0,
        textLength: text.length,
        sessionId
      });

      if (!SAPLING_API_KEY) {
        logger.warn('Sapling API Key is missing. Check your environment variables.');
        return { edits: [] };
      }

      // Check for rate limiting
      if (this.isRateLimited()) {
        logger.warn('Sapling API request was rate limited');
        return { edits: [] };
      }

      // Check if we've recently processed similar text
      const recentResult = this.checkRecentQueries(text);
      if (recentResult) {
        return recentResult;
      }

      // Truncate text if needed to reduce API costs
      let processedText = text;
      let truncated = false;

      if (text.length > MAX_TEXT_LENGTH) {
        processedText = text.substring(0, MAX_TEXT_LENGTH);
        truncated = true;
        logger.info('Truncating text for Sapling API to save costs', {
          originalLength: text.length,
          truncatedLength: processedText.length
        });
      }

      logger.info('Making Sapling API spellcheck request', {
        textLength: processedText.length,
        textSample: processedText.substring(0, 50) + (processedText.length > 50 ? '...' : ''),
        truncated
      });

      // Record this request for rate limiting
      this.requestTimestamps.push(Date.now());

      const response = await axios.post(SAPLING_API_URL, {
        key: SAPLING_API_KEY,
        text: processedText,
        session_id: sessionId,
        lang: 'en', // Default to English
        auto_apply: false,
        neural_spellcheck: true // Use more aggressive spellcheck
      });

      // Log response details
      logger.info('Sapling API response received', {
        status: response.status,
        editCount: response.data.edits?.length || 0
      });

      // Log first few edits for debugging
      if (response.data.edits && response.data.edits.length > 0) {
        logger.info('Sapling API found spelling/grammar errors:', {
          firstFewEdits: response.data.edits.slice(0, 3),
          totalEdits: response.data.edits.length
        });
      } else {
        logger.info('Sapling API found no errors in the text');
      }

      // Store the result for potential reuse
      this.storeRecentQuery(processedText, response.data);

      return response.data as SaplingResponse;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('Sapling API request error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        });
      } else {
        logger.error('Sapling API unexpected error:', error);
      }

      // Return empty result to allow graceful fallback
      return { edits: [] };
    }
  }

  // Accept an edit suggestion (helps Sapling learn)
  async acceptEdit(editId: string, sessionId: string = 'default-session') {
    try {
      if (!SAPLING_API_KEY) {
        logger.warn('Sapling API Key is missing. Check your environment variables.');
        return false;
      }

      // Check for rate limiting - less strict for feedback
      if (this.isRateLimited()) {
        logger.warn('Sapling API feedback request was rate limited');
        return false;
      }

      const url = `https://api.sapling.ai/api/v1/edits/${editId}/accept`;
      await axios.post(url, {
        key: SAPLING_API_KEY,
        session_id: sessionId
      });

      // Record this request for rate limiting
      this.requestTimestamps.push(Date.now());

      return true;
    } catch (error) {
      logger.error('Error accepting Sapling edit:', error);
      return false;
    }
  }

  // Reject an edit suggestion (helps Sapling not recommend it again)
  async rejectEdit(editId: string, sessionId: string = 'default-session') {
    try {
      if (!SAPLING_API_KEY) {
        logger.warn('Sapling API Key is missing. Check your environment variables.');
        return false;
      }

      // Check for rate limiting - less strict for feedback
      if (this.isRateLimited()) {
        logger.warn('Sapling API feedback request was rate limited');
        return false;
      }

      const url = `https://api.sapling.ai/api/v1/edits/${editId}/reject`;
      await axios.post(url, {
        key: SAPLING_API_KEY,
        session_id: sessionId
      });

      // Record this request for rate limiting
      this.requestTimestamps.push(Date.now());

      return true;
    } catch (error) {
      logger.error('Error rejecting Sapling edit:', error);
      return false;
    }
  }
}

export default SaplingApiService; 