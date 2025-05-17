// Add or update the TextSummaryResult interface to match the API response
export interface TextSummaryResult {
  sentences: number;
  paragraphs: number;
  words: number;
  characters_without_spaces: number;
  characters_with_spaces: number;
  words_per_sentence: number;
  characters_per_word: number;
  vocabulary_density: number;
  keyword_density: Record<string, number>;
  automated_readability_index: number;
  coleman_liau_index: number;
  flesch_kincaid_grade_level: number;
  smog_readability_index: number;
  spelling_errors: number;
  grammar_errors: number;
}

export interface TextSummaryResponse {
  success: boolean;
  data: {
    tasks: Array<{
      result: TextSummaryResult[];
      data: {
        text: string;
      };
    }>;
  };
}

export interface MonthlySearch {
  year: number;
  month: number;
  search_volume: number;
}

export interface RelatedKeyword {
  keyword: string;
  location_code: number;
  language_code: string | null;
  search_partners: boolean;
  competition: string;
  competition_index: number;
  search_volume: number;
  low_top_of_page_bid: number | null;
  high_top_of_page_bid: number | null;
  cpc: number | null;
  monthly_searches?: MonthlySearch[];
  keyword_annotations?: {
    concepts: Record<string, unknown> | null;
  };
}

export interface ContentSuggestionsResponse {
  success: boolean;
  data: {
    summary: TextSummaryResponse;
    relatedKeywords: {
      tasks: Array<{
        result: Array<{
          keyword_data: {
            keyword: string;
            related_keywords: RelatedKeyword[];
          }
        }>
      }>
    };
    analyzedKeywords: string[];
  };
} 