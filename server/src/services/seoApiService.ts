import axios from 'axios';
import dotenv from 'dotenv';
import logger from '../utils/logger';

dotenv.config();

const DATAFORSEO_API_LOGIN = process.env.DATAFORSEO_API_LOGIN;
const DATAFORSEO_API_PASSWORD = process.env.DATAFORSEO_API_PASSWORD;
const DATAFORSEO_API_URL = 'https://api.dataforseo.com/v3';

class SeoApiService {
  private getAuthHeader() {
    if (!DATAFORSEO_API_LOGIN || !DATAFORSEO_API_PASSWORD) {
      throw new Error('DataForSEO API credentials are not properly configured');
    }

    const credentials = `${DATAFORSEO_API_LOGIN}:${DATAFORSEO_API_PASSWORD}`;
    const encodedCredentials = Buffer.from(credentials).toString('base64');
    return `Basic ${encodedCredentials}`;
  }

  async generateTextSummary(text: string, languageCode: string = "en-US") {
    try {
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

      return response.data;
    } catch (error) {
      logger.error('Error calling DataForSEO text summary:', error);
      throw error;
    }
  }

  async getRelatedKeywords(keyword: string, locationCode: string = "2840", languageCode: string = "en") {
    try {
      const postData = [{
        "keywords": [keyword], // DataForSEO expects an array of keywords
        "location_code": locationCode, // 2840 is USA
        "language_code": languageCode,
        "include_seed_keyword": true,
        "sort_by": "search_volume",
        "limit": 15
      }];

      logger.info(`Making DataForSEO API request for keyword "${keyword}"`);
      logger.info(`API URL: ${DATAFORSEO_API_URL}/keywords_data/google_ads/keywords_for_keywords/live`);

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

      // Extract top keywords (up to 3)
      const keywordDensity = summaryResponse.tasks[0].result[0].keyword_density as Record<string, number>;
      logger.info('getContentSuggestions: Keyword density from summary:', keywordDensity);

      const topKeywords = Object.entries(keywordDensity)
        .filter(([keyword]) => keyword.length > 2) // Filter out short keywords like "a", "the", etc.
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([keyword]) => keyword);

      logger.info('getContentSuggestions: Top keywords extracted:', topKeywords);

      if (topKeywords.length === 0) {
        logger.warn('getContentSuggestions: No significant keywords found in the text');
        throw new Error('No significant keywords found in the text');
      }

      // Get related keywords for the top keyword
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

      // Return both the summary, the full API response, and the extracted keywords
      return {
        summary: summaryResponse,
        relatedKeywords: relatedKeywordsResponse,
        analyzedKeywords: topKeywords,
        extractedKeywords: extractedKeywords // Add the extracted keywords directly
      };
    } catch (error) {
      logger.error('Error generating content suggestions:', error);
      throw error;
    }
  }
}

export default new SeoApiService();