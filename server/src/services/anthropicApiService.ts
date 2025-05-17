import dotenv from 'dotenv';
import logger from '../utils/logger';
import Anthropic from '@anthropic-ai/sdk';

dotenv.config();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MAX_TOKENS = 2000;

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
    try {
      logger.info('Requesting content rewrite suggestions from Anthropic API');

      const keywordsText = targetKeywords.join(', ');

      // Determine the number of suggestions to request based on content length
      // For longer content, we want more suggestions
      const contentWords = content.split(/\s+/).length;
      const minSuggestions = contentWords > 1000 ? 8 : contentWords > 500 ? 6 : 4;
      const maxSuggestions = contentWords > 1000 ? 12 : contentWords > 500 ? 8 : 6;

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
1. Naturally incorporating the target keywords and their semantic variations
2. Improving the keyword density where appropriate (aim for 1-2% for primary keywords)
3. Enhancing readability while maintaining the content's meaning
4. Using some related keywords where they fit naturally

IMPORTANT: For each suggestion, you MUST preserve the exact HTML/markdown tags and formatting of the original text. For example:
- If the original is a heading like "<h1>Welcome to our site</h1>", your improved version must also use "<h1>" tags
- If there's formatting like <strong>, <em>, or other tags, keep those intact in your improved version
- Do not add or remove any HTML tags that weren't in the original

Please prioritize optimizing the following types of sentences, as they have the most SEO impact:
- Title and headings (h1, h2, h3, etc.)
- Introduction sentences and first paragraphs
- Topic sentences at the beginning of paragraphs
- Sentences that already contain related keywords that could be improved
- Conclusion sentences that can summarize key points with keywords

Please provide ${minSuggestions}-${maxSuggestions} individual suggestions, focusing on the most impactful changes. For longer content like this (${contentWords} words), focus on the most important passages.

For each suggestion, format your response exactly as follows:
---
Original: [paste the exact original text/element here with all HTML tags intact]
Improved: [your improved version here with all the same HTML tags preserved]
Explanation: [brief explanation of why this helps]
---

Do not include any introduction or conclusion text. Just provide the individual suggestions in the exact format above, separated by blank lines.
`;

      const response = await this.client.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: MAX_TOKENS,
        temperature: 0.7,
        messages: [
          { role: 'user', content: prompt }
        ],
      });

      logger.info('Successfully received content rewrite suggestions from Anthropic API');

      // Process response
      const responseText = response.content[0].type === 'text'
        ? response.content[0].text
        : 'No text response received';

      return {
        suggestions: responseText,
        raw_response: response
      };
    } catch (error) {
      logger.error('Error calling Anthropic API for content rewrites:', error);
      throw error;
    }
  }

  // Format the raw response into a structured format for the frontend
  processSuggestions(rawSuggestions: string): ContentSuggestion[] {
    try {
      logger.info('Processing Anthropic suggestions');

      // Skip any introductory text by splitting on the first occurrence of 'Original:' or '---'
      let processableText = rawSuggestions;
      const introEndIndex = Math.min(
        rawSuggestions.indexOf('Original:') >= 0 ? rawSuggestions.indexOf('Original:') : Infinity,
        rawSuggestions.indexOf('---') >= 0 ? rawSuggestions.indexOf('---') : Infinity
      );

      if (introEndIndex !== Infinity) {
        processableText = rawSuggestions.substring(introEndIndex);
      }

      // Split the text by suggestion blocks (either by '---' or by double newlines)
      const suggestions: ContentSuggestion[] = [];

      // Try splitting by '---' first
      const blocksBySeparator = processableText.split(/---+/).filter(Boolean);

      if (blocksBySeparator.length > 1) {
        // Process blocks separated by '---'
        for (const block of blocksBySeparator) {
          // Use a more careful regex that preserves HTML tags
          // We look for content between labels, allowing for multiline content with HTML tags
          const originalMatch = block.match(/Original:?\s*([\s\S]+?)(?=\s*Improved:|\s*$)/i);
          const improvedMatch = block.match(/Improved:?\s*([\s\S]+?)(?=\s*Explanation:|\s*Why:|\s*$)/i);
          const explanationMatch = block.match(/(?:Explanation|Why):?\s*([\s\S]+?)$/i);

          if (originalMatch?.[1] && improvedMatch?.[1]) {
            // Log what we're extracting to help with debugging
            logger.debug('Extracted suggestion:', {
              original: originalMatch[1].trim().substring(0, 50) + '...',
              improved: improvedMatch[1].trim().substring(0, 50) + '...'
            });

            suggestions.push({
              original: originalMatch[1].trim(),
              improved: improvedMatch[1].trim(),
              explanation: explanationMatch?.[1]?.trim() || ''
            });
          }
        }
      } else {
        // Alternative: try to find blocks that have Original/Improved/Explanation pattern
        // First, check for numbered suggestions with explicit labels
        const suggestionsBlocks = processableText.split(/\n\s*\d+[\.)]\s*/).filter(Boolean);

        for (const block of suggestionsBlocks) {
          // Use the same improved regex pattern here
          const originalMatch = block.match(/Original:?\s*([\s\S]+?)(?=\s*Improved:|\s*$)/i);
          const improvedMatch = block.match(/Improved:?\s*([\s\S]+?)(?=\s*Explanation:|\s*Why:|\s*$)/i);
          const explanationMatch = block.match(/(?:Explanation|Why):?\s*([\s\S]+?)$/i);

          if (originalMatch?.[1] && improvedMatch?.[1]) {
            suggestions.push({
              original: originalMatch[1].trim(),
              improved: improvedMatch[1].trim(),
              explanation: explanationMatch?.[1]?.trim() || ''
            });
          }
        }

        // If we still don't have suggestions, try looking for "Rewrite:" pattern
        if (suggestions.length === 0) {
          const lines = processableText.split('\n').filter(line => line.trim().length > 0);

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.includes('Rewrite:') && i > 0) {
              const original = lines[i - 1].trim();
              const improved = line.replace(/Rewrite:\s*/, '').trim();
              const explanation = i + 1 < lines.length ? lines[i + 1].trim() : '';

              suggestions.push({
                original,
                improved,
                explanation
              });
            }
          }
        }
      }

      // Log the parsed results
      logger.info(`Parsed ${suggestions.length} suggestions from Anthropic response`);

      return suggestions;
    } catch (error) {
      logger.error('Error processing Anthropic suggestions:', error);
      return [];
    }
  }
}

export default new AnthropicApiService();
