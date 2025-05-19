import dotenv from 'dotenv';
import logger from '../utils/logger';
import Anthropic from '@anthropic-ai/sdk';

dotenv.config();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MAX_TOKENS = 64000;

// Interface for SEO insights
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

// Interface for suggestions
interface ContentSuggestion {
  original: string;
  improved: string;
  explanation: string;
}

class AnthropicApiService {
  private client: Anthropic;

  constructor() {
    if (!ANTHROPIC_API_KEY) {
      throw new Error('Anthropic API key is not configured');
    }

    this.client = new Anthropic({
      apiKey: ANTHROPIC_API_KEY,
    });
  }

  async suggestContentRewrites(
    content: string,
    targetKeywords: string[],
    seoInsights?: SeoInsights
  ): Promise<any> {
    const MAX_ATTEMPTS = 3;
    let attempts = 0;
    let lastError: any = null;

    while (attempts < MAX_ATTEMPTS) {
      attempts++;
      try {
        logger.info(`Requesting content rewrite suggestions from Anthropic API (attempt ${attempts}/${MAX_ATTEMPTS})`);

        const keywordsText = targetKeywords.join(', ');

        // Determine the number of suggestions to request based on content length
        // For longer content, we want more suggestions
        const contentWords = content.split(/\s+/).length;
        const minSuggestions = contentWords > 1000 ? 8 : contentWords > 500 ? 6 : 4;
        // const maxSuggestions = contentWords > 1000 ? 12 : contentWords > 500 ? 8 : 6;

        // Build a more detailed prompt with SEO insights if available
        let insightsText = '';

        if (seoInsights) {
          insightsText = '\n\nHere are some additional insights about the content:';

          if (seoInsights.analyzedKeywords && seoInsights.analyzedKeywords.length > 0) {
            insightsText += `\n• Main topics/keywords found in the content: ${seoInsights.analyzedKeywords.join(', ')}`;
          }

          if (seoInsights.relatedKeywords && seoInsights.relatedKeywords.length > 0) {
            const topRelatedKeywords = seoInsights.relatedKeywords
              .slice(0, 5)
              .map(k => k.keyword)
              .join(', ');
            insightsText += `\n• Related keywords that could be incorporated: ${topRelatedKeywords}`;
          }

          if (seoInsights.readabilityLevel) {
            insightsText += `\n• Current readability level: ${seoInsights.readabilityLevel}`;
          }

          // Add insights about keyword density if available
          if (seoInsights.textSummary?.keyword_density) {
            const keywordDensity = seoInsights.textSummary.keyword_density;
            const topKeywords = Object.entries(keywordDensity)
              .sort(([, a]: any, [, b]: any) => b - a)
              .slice(0, 5)
              .map(([keyword, density]: any) => `${keyword} (${density.toFixed(2)}%)`)
              .join(', ');

            insightsText += `\n• Current top keywords by density: ${topKeywords}`;
          }
        }

        const prompt = `
I have a piece of content that I would like to optimize for the following target keyword(s): ${keywordsText}.

Here's the content:
"""
${content}
"""${insightsText}

I need you to suggest specific sentence rewrites to better incorporate these target keywords and improve SEO. Focus on:
1. Naturally incorporating the target keywords and their semantic variations without making the text sound repetitive or forced
2. Maintaining a natural flow and conversational tone that reads like a professional article
3. Enhancing readability while maintaining the content's meaning and authenticity
4. Using some related keywords only where they fit naturally into the context

IMPORTANT: 
- Prioritize readability and natural flow over keyword density. The content should never sound like "keyword stuffing"
- Vary sentence structure and word choice to avoid repetition
- The text should read as if written by a skilled human writer who understands SEO but prioritizes the reader experience
- For each suggestion, you MUST preserve the exact HTML/markdown tags and formatting of the original text. For example:
  - If the original is a heading like "<h1>Welcome to our site</h1>", your improved version must also use "<h1>" tags
  - If there's formatting like <strong>, <em>, or other tags, keep those intact in your improved version
  - Do not add or remove any HTML tags that weren't in the original

Please prioritize optimizing the following types of sentences, as they have the most SEO impact:
- Title and headings (h1, h2, h3, etc.)
- Introduction sentences and first paragraphs
- Topic sentences at the beginning of paragraphs
- Sentences that already contain related keywords that could be improved
- Conclusion sentences that can summarize key points with keywords

Please provide as many individual suggestions as possible without repeating yourself, focusing on the most impactful changes. For longer content like this (${contentWords} words), focus on the most important passages.

RESPONSE FORMAT: Please return your response as a valid JSON array where each item is an object with the following fields:
- "original": The exact original text/element with all HTML tags intact
- "improved": Your improved version with all the same HTML tags preserved
- "explanation": Brief explanation of why this change helps

Example JSON response format:
\`\`\`json
[
  {
    "original": "<h1>Welcome to our website</h1>",
    "improved": "<h1>Welcome to our SEO optimization website</h1>",
    "explanation": "Incorporates the primary keyword 'SEO optimization' in the main heading for better relevance."
  },
  {
    "original": "We offer services to help businesses.",
    "improved": "We offer content marketing services to help businesses improve their online visibility.",
    "explanation": "Includes the target keywords 'content marketing' and adds 'online visibility' for semantic relevance."
  }
]
\`\`\`

Your response should be valid JSON that can be parsed. Do not include any text before or after the JSON array.
`;

        // Use streaming for long-running operations
        let responseText = '';

        // Create a streaming request
        const stream = await this.client.messages.create({
          model: 'claude-3-7-sonnet-20250219',
          max_tokens: MAX_TOKENS,
          thinking: {
            budget_tokens: Math.floor(MAX_TOKENS / 3),
            type: 'enabled',
          },
          messages: [
            { role: 'user', content: prompt }
          ],
          stream: true,
        });

        // Process the streamed response chunks
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' &&
            chunk.delta &&
            'text' in chunk.delta) {
            responseText += chunk.delta.text;
          }
        }

        logger.info('Successfully received content rewrite suggestions from Anthropic API');

        // Try to parse the response to verify it's valid
        const result = {
          suggestions: responseText,
          raw_response: responseText // Store the raw text since we don't have the full response object in streaming mode
        };

        // Verify the response can be parsed before returning
        const testParse = this.processSuggestions(responseText);
        if (testParse.length === 0) {
          // If we couldn't parse any suggestions, throw an error to trigger a retry
          logger.warn(`Received unparseable response on attempt ${attempts}/${MAX_ATTEMPTS}, retrying...`);
          throw new Error('Failed to parse Anthropic response as valid JSON');
        }

        // If we got here, the response was successfully parsed
        logger.info(`Successfully parsed ${testParse.length} suggestions on attempt ${attempts}/${MAX_ATTEMPTS}`);
        return result;
      } catch (error) {
        lastError = error;
        logger.error(`Error on attempt ${attempts}/${MAX_ATTEMPTS}:`, error);

        // If we've reached max attempts, throw the last error
        if (attempts >= MAX_ATTEMPTS) {
          logger.error(`Failed after ${MAX_ATTEMPTS} attempts to get valid content rewrite suggestions`);
          throw error;
        }

        // Wait a short time before retrying (exponential backoff)
        const delay = Math.min(100 * Math.pow(2, attempts), 1000);
        logger.info(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // This should never be reached due to the throw in the catch block above,
    // but TypeScript doesn't know that
    throw lastError;
  }

  // Format the raw response into a structured format for the frontend
  processSuggestions(rawSuggestions: string): ContentSuggestion[] {
    try {
      logger.info('Processing Anthropic suggestions');

      // Extract JSON from the response
      let jsonStr = rawSuggestions;

      // If the response contains markdown code blocks, extract just the JSON part
      const jsonMatch = rawSuggestions.match(/```(?:json)?\s*([\s\S]+?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      // Attempt to parse the JSON
      const suggestions: ContentSuggestion[] = JSON.parse(jsonStr);

      // Validate that we have the expected structure
      if (!Array.isArray(suggestions)) {
        logger.warn('Received non-array JSON response from Anthropic');
        return [];
      }

      // Ensure each suggestion has the required fields
      const validSuggestions = suggestions.filter(suggestion =>
        suggestion &&
        typeof suggestion.original === 'string' &&
        typeof suggestion.improved === 'string'
      );

      // Log the parsed results
      logger.info(`Parsed ${validSuggestions.length} suggestions from Anthropic JSON response`);

      return validSuggestions;
    } catch (error) {
      logger.error('Error processing Anthropic suggestions:', error);

      // Fallback to the old text parsing method if JSON parsing fails
      try {
        logger.info('Attempting fallback text parsing method');

        // If we can't parse JSON, extract any array-like text and try again
        const jsonMatch = rawSuggestions.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
          try {
            const extractedJson = JSON.parse(jsonMatch[0]);
            if (Array.isArray(extractedJson)) {
              logger.info(`Successfully extracted ${extractedJson.length} suggestions using fallback method`);
              return extractedJson;
            }
          } catch (innerError) {
            logger.error('Fallback JSON extraction failed:', innerError);
          }
        }

        return [];
      } catch (fallbackError) {
        logger.error('Fallback parsing failed:', fallbackError);
        return [];
      }
    }
  }
}

export default new AnthropicApiService();
