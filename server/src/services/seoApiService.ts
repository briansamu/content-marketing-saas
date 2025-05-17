import axios from 'axios';
import dotenv from 'dotenv';
import logger from '../utils/logger';
import redisClient from '../config/redis';

dotenv.config();

const DATAFORSEO_API_LOGIN = process.env.DATAFORSEO_API_LOGIN;
const DATAFORSEO_API_PASSWORD = process.env.DATAFORSEO_API_PASSWORD;
const DATAFORSEO_API_URL = 'https://api.dataforseo.com/v3';

// Cache TTL in seconds
const CACHE_TTL = 24 * 60 * 60; // 24 hours

// API rate limit management
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds
const MAX_REQUESTS_PER_WINDOW = 10; // Max 10 requests per minute
let requestsInCurrentWindow = 0;
let windowStartTime = Date.now();

// Reset the rate limit counter every minute
setInterval(() => {
  requestsInCurrentWindow = 0;
  windowStartTime = Date.now();
}, RATE_LIMIT_WINDOW);

class SeoApiService {
  private getAuthHeader() {
    if (!DATAFORSEO_API_LOGIN || !DATAFORSEO_API_PASSWORD) {
      throw new Error('DataForSEO API credentials are not properly configured');
    }

    const credentials = `${DATAFORSEO_API_LOGIN}:${DATAFORSEO_API_PASSWORD}`;
    const encodedCredentials = Buffer.from(credentials).toString('base64');
    return `Basic ${encodedCredentials}`;
  }

  // Check if we're within rate limits
  private async checkRateLimit(): Promise<void> {
    // Reset counter if we're in a new window
    if (Date.now() - windowStartTime > RATE_LIMIT_WINDOW) {
      requestsInCurrentWindow = 0;
      windowStartTime = Date.now();
    }

    // If we've hit the limit, wait until the next window
    if (requestsInCurrentWindow >= MAX_REQUESTS_PER_WINDOW) {
      const timeToWait = RATE_LIMIT_WINDOW - (Date.now() - windowStartTime) + 100; // Add 100ms buffer
      logger.info(`Rate limit reached, waiting ${timeToWait}ms before next request`);
      await new Promise(resolve => setTimeout(resolve, timeToWait));

      // Reset for the new window
      requestsInCurrentWindow = 0;
      windowStartTime = Date.now();
    }

    requestsInCurrentWindow++;
  }

  // Get cached data from Redis
  private async getCachedData(key: string): Promise<any | null> {
    try {
      const cachedData = await redisClient.get(`seo:${key}`);
      if (cachedData) {
        return JSON.parse(cachedData);
      }
      return null;
    } catch (error) {
      logger.error('Error getting cached data from Redis:', error);
      return null;
    }
  }

  // Set data in Redis cache with TTL
  private async setCachedData(key: string, data: any, ttl: number = CACHE_TTL): Promise<void> {
    try {
      await redisClient.setEx(`seo:${key}`, ttl, JSON.stringify(data));
    } catch (error) {
      logger.error('Error setting cached data in Redis:', error);
      // Continue without caching - non-critical error
    }
  }

  async generateTextSummary(text: string, languageCode: string = "en-US") {
    try {
      // Check if we have a cached result
      const cacheKey = `summary_${Buffer.from(text.substring(0, 100)).toString('base64')}`;
      const cachedResult = await this.getCachedData(cacheKey);

      if (cachedResult) {
        logger.info('Using cached text summary result');
        return cachedResult;
      }

      await this.checkRateLimit();

      const postData = [{
        "text": text,
        "language_code": languageCode
      }];

      const response = await axios({
        method: 'post',
        url: `${DATAFORSEO_API_URL}/content_generation/text_summary/live`,
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json'
        },
        data: postData
      });

      // Cache the result
      await this.setCachedData(cacheKey, response.data);

      return response.data;
    } catch (error) {
      logger.error('Error calling DataForSEO text summary:', error);
      throw error;
    }
  }

  async getRelatedKeywords(keyword: string, locationCode: string = "2840", languageCode: string = "en") {
    try {
      // Generate a cache key based on parameters
      const cacheKey = `keywords_${keyword}_${locationCode}_${languageCode}`;

      // Check cache first
      const cachedResult = await this.getCachedData(cacheKey);
      if (cachedResult) {
        logger.info(`Using cached related keywords for "${keyword}"`);
        return cachedResult;
      }

      logger.info(`Making DataForSEO API request for keyword "${keyword}"`);
      logger.info(`API URL: ${DATAFORSEO_API_URL}/keywords_data/google_ads/keywords_for_keywords/live`);

      // Enforce rate limiting
      await this.checkRateLimit();

      const postData = [{
        "keywords": [keyword], // DataForSEO expects an array of keywords
        "location_code": locationCode, // 2840 is USA
        "language_code": languageCode,
        "include_seed_keyword": true,
        "sort_by": "search_volume",
        "limit": 8 // REDUCED from 10 to 8 to save on API costs for optimization workflow
      }];

      try {
        const response = await axios({
          method: 'post',
          url: `${DATAFORSEO_API_URL}/keywords_data/google_ads/keywords_for_keywords/live`,
          headers: {
            'Authorization': this.getAuthHeader(),
            'Content-Type': 'application/json'
          },
          data: postData
        });

        // Log the full response for debugging
        logger.info('DataForSEO API response status:', response.status);
        logger.info('DataForSEO API response structure:', JSON.stringify({
          status_code: response.data.status_code,
          status_message: response.data.status_message,
          tasks_count: response.data.tasks_count,
          tasks_error: response.data.tasks_error,
          task_status: response.data.tasks?.[0]?.status_code,
          task_message: response.data.tasks?.[0]?.status_message,
          result_count: response.data.tasks?.[0]?.result_count
        }));

        // If we get valid results, log the keywords for debugging
        if (response.data.tasks &&
          response.data.tasks[0] &&
          response.data.tasks[0].result &&
          response.data.tasks[0].result.length > 0) {
          const keywords = response.data.tasks[0].result.map(item => item.keyword);
          logger.info(`Found ${keywords.length} related keywords:`, keywords);

          // Cache the successful result
          await this.setCachedData(cacheKey, response.data);
        } else {
          logger.warn('No related keywords found in the API response');
          logger.info('Full API response:', JSON.stringify(response.data));
        }

        return response.data;
      } catch (axiosError) {
        // Log detailed axios error information
        if (axiosError.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          logger.error('DataForSEO API error response:', {
            status: axiosError.response.status,
            data: axiosError.response.data
          });
        } else if (axiosError.request) {
          // The request was made but no response was received
          logger.error('DataForSEO API no response received', {
            request: axiosError.request
          });
        } else {
          // Something happened in setting up the request that triggered an Error
          logger.error('Error setting up DataForSEO API request', axiosError.message);
        }
        throw axiosError;
      }
    } catch (error) {
      logger.error('Error calling DataForSEO related keywords:', error);
      throw error;
    }
  }

  async getContentSuggestions(text: string) {
    try {
      // Generate cache key
      const cacheKey = `content_suggestions_${Buffer.from(text.substring(0, 100)).toString('base64')}`;

      // Check cache first
      const cachedResult = await this.getCachedData(cacheKey);
      if (cachedResult) {
        logger.info('Using cached content suggestions');
        return cachedResult;
      }

      // First, get a summary to extract top keywords
      logger.info('getContentSuggestions: Requesting text summary');
      const summaryResponse = await this.generateTextSummary(text);
      logger.info('getContentSuggestions: Summary response status:', summaryResponse.status_code);

      if (!summaryResponse.tasks ||
        !summaryResponse.tasks[0] ||
        !summaryResponse.tasks[0].result ||
        !summaryResponse.tasks[0].result[0] ||
        !summaryResponse.tasks[0].result[0].keyword_density) {
        logger.error('getContentSuggestions: Invalid response format from text summary API:',
          JSON.stringify(summaryResponse));
        throw new Error('Invalid response format from text summary API');
      }

      // Extract top keywords (up to 2 - REDUCED from 3 to save on API costs)
      const keywordDensity = summaryResponse.tasks[0].result[0].keyword_density as Record<string, number>;
      logger.info('getContentSuggestions: Keyword density from summary:', keywordDensity);

      const topKeywords = Object.entries(keywordDensity)
        .filter(([keyword]) => keyword.length > 2) // Filter out short keywords like "a", "the", etc.
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2) // REDUCED from 3 to 2
        .map(([keyword]) => keyword);

      logger.info('getContentSuggestions: Top keywords extracted:', topKeywords);

      if (topKeywords.length === 0) {
        logger.warn('getContentSuggestions: No significant keywords found in the text');
        throw new Error('No significant keywords found in the text');
      }

      // Get related keywords for the top keyword only (instead of all keywords)
      const keywordForSearch = topKeywords[0].toLowerCase().trim();
      logger.info('getContentSuggestions: Searching for related keywords using:', keywordForSearch);

      // Get related keywords
      const relatedKeywordsResponse = await this.getRelatedKeywords(keywordForSearch);
      logger.info('getContentSuggestions: Related keywords API response:', {
        status: relatedKeywordsResponse.status_code,
        taskCount: relatedKeywordsResponse.tasks?.length,
        resultCount: relatedKeywordsResponse.tasks?.[0]?.result_count
      });

      // Extract related keywords directly to make it easier for the client
      let extractedKeywords = [];

      if (relatedKeywordsResponse.tasks?.[0]?.result) {
        const results = relatedKeywordsResponse.tasks[0].result;

        if (results.length > 0) {
          // Case 1: Check if results have the keyword property directly
          if (results[0].keyword && typeof results[0].keyword === 'string') {
            logger.info('getContentSuggestions: Found direct keyword structure');
            extractedKeywords = results;
          }
          // Case 2: Check if results have keyword_data with related_keywords
          else if (results[0].keyword_data && results[0].keyword_data.related_keywords) {
            logger.info('getContentSuggestions: Found nested keyword_data structure');
            extractedKeywords = results[0].keyword_data.related_keywords;
          }

          if (extractedKeywords.length > 0) {
            logger.info(`getContentSuggestions: Extracted ${extractedKeywords.length} keywords`);
          } else {
            logger.warn('getContentSuggestions: Could not extract keywords from results');
          }
        }
      }

      const result = {
        summary: summaryResponse,
        relatedKeywords: relatedKeywordsResponse,
        analyzedKeywords: topKeywords,
        extractedKeywords: extractedKeywords
      };

      // Cache the result
      await this.setCachedData(cacheKey, result);

      return result;
    } catch (error) {
      logger.error('Error generating content suggestions:', error);
      throw error;
    }
  }

  // Clear the entire cache or specific entries
  async clearCache(key?: string) {
    try {
      if (key) {
        await redisClient.del(`seo:${key}`);
        logger.info(`Cleared cache for key: seo:${key}`);
      } else {
        // Get all keys with the seo: prefix
        const keys = await redisClient.keys('seo:*');
        if (keys.length > 0) {
          await redisClient.del(keys);
          logger.info(`Cleared ${keys.length} keys from SEO cache`);
        } else {
          logger.info('No SEO cache keys to clear');
        }
      }
    } catch (error) {
      logger.error('Error clearing cache:', error);
    }
  }

  // Get cache stats for debugging/monitoring
  async getCacheStats() {
    try {
      const keys = await redisClient.keys('seo:*');
      const stats = {
        totalKeys: keys.length,
        keysByPrefix: {} as Record<string, number>
      };

      // Group keys by prefix
      keys.forEach(key => {
        const prefix = key.split('_')[0];
        if (!stats.keysByPrefix[prefix]) {
          stats.keysByPrefix[prefix] = 0;
        }
        stats.keysByPrefix[prefix]++;
      });

      // Get detailed info for up to 10 random keys
      const sampleKeys = keys.sort(() => 0.5 - Math.random()).slice(0, 10);
      const samples: Array<{ key: string, ttl: number, expiresIn: string }> = [];

      for (const key of sampleKeys) {
        const ttl = await redisClient.ttl(key);
        samples.push({
          key,
          ttl: ttl,
          expiresIn: `${Math.floor(ttl / 3600)}h ${Math.floor((ttl % 3600) / 60)}m`
        });
      }

      return {
        totalCacheEntries: keys.length,
        cacheKeysByType: stats.keysByPrefix,
        cacheSamples: samples
      };
    } catch (error) {
      logger.error('Error getting cache stats:', error);
      return {
        error: 'Failed to retrieve cache statistics',
        totalCacheEntries: 0
      };
    }
  }
}

export default new SeoApiService();