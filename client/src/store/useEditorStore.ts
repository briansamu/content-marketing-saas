import { create } from 'zustand';
import { TextSummaryResult, RelatedKeyword, MonthlySearch } from '../types';

// Interface for the keyword item in the API response
interface KeywordResponseItem {
  keyword: string;
  competition?: string;
  competition_index?: number;
  search_volume?: number;
  location_code?: number;
  language_code?: string | null;
  search_partners?: boolean;
  low_top_of_page_bid?: number | null;
  high_top_of_page_bid?: number | null;
  cpc?: number | null;
  monthly_searches?: MonthlySearch[];
  [key: string]: unknown; // For any other properties
}

// Interface for content rewrite suggestions
export interface ContentRewriteSuggestion {
  original: string;
  improved: string;
  explanation: string;
}

// Interface for content rewrite insights
export interface ContentRewriteInsights {
  analyzedKeywords?: string[];
  relatedKeywords?: string[];
  readabilityLevel?: string;
}

// Types
export interface ContentDraft {
  id?: string;
  title: string;
  content: string;
  wordCount: number;
  lastSaved: string;
  status: 'draft' | 'published' | 'archived';
  storageLocation: 'local' | 'cloud' | 'both';
}

interface EditorState {
  currentDraft: ContentDraft;
  savedDrafts: ContentDraft[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  isDirty: boolean;
  autoSaveInterval: number | null;
  textSummary: TextSummaryResult | null;
  analyzedText: string;
  isAnalyzing: boolean;
  contentSuggestions: {
    analyzedKeywords: string[];
    relatedKeywords: RelatedKeyword[];
    isLoading: boolean;
  }
  contentRewrites: {
    suggestions: ContentRewriteSuggestion[];
    rawSuggestions: string;
    isLoading: boolean;
    insights?: ContentRewriteInsights;
  }

  // Actions
  updateContent: (content: string) => void;
  updateTitle: (title: string) => void;
  newDraft: () => void;
  setDraftStatus: (status: 'draft' | 'published' | 'archived') => void;
  clearEditorError: () => void;
  saveDraft: () => Promise<void>;
  loadDrafts: () => Promise<void>;
  loadDraft: (draftId: string) => Promise<void>;
  deleteDraft: (draftId: string) => Promise<void>;
  startAutoSave: () => void;
  stopAutoSave: () => void;
  generateTextSummary: (text: string) => Promise<void>;
  generateContentSuggestions: (text: string) => Promise<void>;
  analyzeKeyword: (text: string, keyword: string) => Promise<void>;
  suggestContentRewrites: (content: string, targetKeywords: string[]) => Promise<void>;
  optimizeContent: (content: string, targetKeyword: string) => Promise<void>;
  clearTextSummary: () => void;
  clearContentRewrites: () => void;
  applyRewriteSuggestion: (original: string, improved: string) => void;
  applyMultipleRewriteSuggestions: (suggestionsToApply: Array<{ original: string, improved: string }>) => void;
}

// Helper function to get drafts from localStorage
const getLocalDrafts = (): ContentDraft[] => {
  const draftsJson = localStorage.getItem('content_drafts');
  if (draftsJson) {
    try {
      return JSON.parse(draftsJson);
    } catch (e) {
      console.error('Failed to parse drafts from localStorage', e);
    }
  }
  return [];
};

// Helper function to save drafts to localStorage
const saveLocalDrafts = (drafts: ContentDraft[]) => {
  localStorage.setItem('content_drafts', JSON.stringify(drafts));
};

// API base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export const useEditorStore = create<EditorState>((set, get) => ({
  currentDraft: {
    title: '',
    content: '',
    wordCount: 0,
    lastSaved: new Date().toISOString(),
    status: 'draft',
    storageLocation: 'local'
  },
  savedDrafts: [],
  isLoading: false,
  isSaving: false,
  error: null,
  isDirty: false,
  autoSaveInterval: null,
  textSummary: null,
  analyzedText: '',
  isAnalyzing: false,
  contentSuggestions: {
    analyzedKeywords: [],
    relatedKeywords: [],
    isLoading: false
  },
  contentRewrites: {
    suggestions: [],
    rawSuggestions: '',
    isLoading: false
  },

  updateContent: (content) => {
    set(state => {
      // Calculate word count
      const text = content.replace(/<[^>]*>/g, ' ');
      const words = text.split(/\s+/).filter(word => word.length > 0);

      return {
        currentDraft: {
          ...state.currentDraft,
          content,
          wordCount: words.length
        },
        isDirty: true
      };
    });
  },

  updateTitle: (title) => {
    set(state => ({
      currentDraft: {
        ...state.currentDraft,
        title
      },
      isDirty: true
    }));
  },

  newDraft: () => {
    set({
      currentDraft: {
        title: '',
        content: '',
        wordCount: 0,
        lastSaved: new Date().toISOString(),
        status: 'draft',
        storageLocation: 'local'
      },
      isDirty: false
    });
  },

  setDraftStatus: (status) => {
    set(state => ({
      currentDraft: {
        ...state.currentDraft,
        status
      },
      isDirty: true
    }));
  },

  clearEditorError: () => {
    set({ error: null });
  },

  startAutoSave: () => {
    const { autoSaveInterval } = get();

    // Clear any existing interval
    if (autoSaveInterval) {
      clearInterval(autoSaveInterval);
    }

    // Set up a new auto-save interval (every 60 seconds)
    const intervalId = window.setInterval(() => {
      const { isDirty, currentDraft } = get();

      // Only auto-save if there are unsaved changes and we have content
      if (isDirty && (currentDraft.content.trim() || currentDraft.title.trim())) {
        console.log('Auto-saving draft...');
        get().saveDraft();
      }
    }, 60000); // 60 seconds

    set({ autoSaveInterval: intervalId });
  },

  stopAutoSave: () => {
    const { autoSaveInterval } = get();
    if (autoSaveInterval) {
      clearInterval(autoSaveInterval);
      set({ autoSaveInterval: null });
    }
  },

  saveDraft: async () => {
    const { currentDraft, savedDrafts } = get();

    set({ isSaving: true, error: null });

    try {
      // Generate a local ID if it doesn't exist
      const draftToSave: ContentDraft = {
        ...currentDraft,
        id: currentDraft.id || `draft-${Date.now()}`,
        lastSaved: new Date().toISOString()
      };

      // Try to save to the backend first
      let savedToCloud = false;
      let cloudId: string | undefined = undefined;

      try {
        // Determine if this is a cloud draft (has numeric ID) or a new/local draft
        const isCloudDraft = draftToSave.id && !draftToSave.id.startsWith('draft-');
        const cloudEndpoint = `${API_BASE_URL}/api/content/drafts`;

        const response = await fetch(cloudEndpoint, {
          method: isCloudDraft ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // Include cookies for session
          body: JSON.stringify({
            ...draftToSave,
            // Only send the ID if it's a cloud ID (not client-generated)
            id: isCloudDraft ? draftToSave.id : undefined
          }),
        });

        if (response.ok) {
          const data = await response.json();
          // Update with server data
          cloudId = data.draft.id;
          savedToCloud = true;
        }
      } catch (cloudError) {
        console.error('Failed to save to cloud, falling back to local storage', cloudError);
        // Continue to local storage fallback
      }

      // Important: Start with the current savedDrafts from state to preserve cloud-only drafts
      // Clone the array to avoid direct state mutation
      const updatedDrafts = [...savedDrafts];

      // Get local drafts to update in localStorage
      const localDrafts = getLocalDrafts();

      // If we saved to cloud and got a cloud ID, we need to handle ID mapping
      if (savedToCloud && cloudId) {
        // Find if we have a local version with the same client-generated ID
        const localDraftIndex = localDrafts.findIndex(d => d.id === draftToSave.id);
        const stateDraftIndex = updatedDrafts.findIndex(d => d.id === draftToSave.id);

        // Update or add to local storage
        if (localDraftIndex >= 0) {
          localDrafts[localDraftIndex] = {
            ...draftToSave,
            id: cloudId,
            storageLocation: 'both'
          } as ContentDraft;
        } else {
          localDrafts.push({
            ...draftToSave,
            id: cloudId,
            storageLocation: 'both'
          } as ContentDraft);
        }

        // Update or add to state
        if (stateDraftIndex >= 0) {
          updatedDrafts[stateDraftIndex] = {
            ...draftToSave,
            id: cloudId,
            storageLocation: 'both'
          } as ContentDraft;
        } else {
          updatedDrafts.push({
            ...draftToSave,
            id: cloudId,
            storageLocation: 'both'
          } as ContentDraft);
        }

        // Update the current draft with the cloud ID
        draftToSave.id = cloudId;
        draftToSave.storageLocation = 'both';
      } else {
        // Regular local storage update
        const localDraftExists = localDrafts.some(d => d.id === draftToSave.id);
        const stateDraftExists = updatedDrafts.some(d => d.id === draftToSave.id);

        // Update local storage
        if (localDraftExists) {
          for (let i = 0; i < localDrafts.length; i++) {
            if (localDrafts[i].id === draftToSave.id) {
              localDrafts[i] = {
                ...draftToSave,
                storageLocation: savedToCloud ? 'both' : 'local'
              } as ContentDraft;
              break;
            }
          }
        } else {
          localDrafts.push({
            ...draftToSave,
            storageLocation: savedToCloud ? 'both' : 'local'
          } as ContentDraft);
        }

        // Update state
        if (stateDraftExists) {
          for (let i = 0; i < updatedDrafts.length; i++) {
            if (updatedDrafts[i].id === draftToSave.id) {
              updatedDrafts[i] = {
                ...draftToSave,
                storageLocation: savedToCloud ? 'both' : 'local'
              } as ContentDraft;
              break;
            }
          }
        } else {
          updatedDrafts.push({
            ...draftToSave,
            storageLocation: savedToCloud ? 'both' : 'local'
          } as ContentDraft);
        }
      }

      // Save to localStorage
      saveLocalDrafts(localDrafts);

      set({
        currentDraft: draftToSave,
        savedDrafts: updatedDrafts,
        isSaving: false,
        isDirty: false
      });

    } catch (error) {
      console.error('Save draft error:', error);
      set({
        isSaving: false,
        error: error instanceof Error ? error.message : 'Failed to save draft. Please try again.'
      });
    }
  },

  loadDrafts: async () => {
    set({ isLoading: true, error: null });

    try {
      const localDrafts = getLocalDrafts();
      let cloudDrafts: ContentDraft[] = [];

      // Try to fetch cloud drafts using session auth
      try {
        const response = await fetch(`${API_BASE_URL}/api/content/drafts`, {
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // Include cookies for session
        });

        if (response.ok) {
          const data = await response.json();
          cloudDrafts = data.drafts || [];
        }
      } catch (cloudError) {
        console.error('Failed to fetch cloud drafts', cloudError);
        // Continue with local drafts only
      }

      // Create a map of drafts by ID for easier merging
      const draftsMap = new Map<string, ContentDraft>();

      // Add local drafts to the map
      localDrafts.forEach(draft => {
        draftsMap.set(draft.id!, {
          ...draft,
          storageLocation: 'local'
        });
      });

      // Merge cloud drafts, preferring cloud versions but marking as 'both' if local exists
      cloudDrafts.forEach(cloudDraft => {
        const localDraft = draftsMap.get(cloudDraft.id!);

        if (localDraft) {
          // If exists in both places, mark as 'both' but prefer cloud data
          draftsMap.set(cloudDraft.id!, {
            ...cloudDraft,
            storageLocation: 'both'
          });
        } else {
          // Cloud-only draft
          draftsMap.set(cloudDraft.id!, {
            ...cloudDraft,
            storageLocation: 'cloud'
          });
        }
      });

      // Convert map back to array
      const mergedDrafts = Array.from(draftsMap.values());
      console.log('Total merged drafts:', mergedDrafts.length);

      set({
        savedDrafts: mergedDrafts,
        isLoading: false
      });

    } catch (error) {
      console.error('Load drafts error:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load drafts. Please try again.'
      });
    }
  },

  loadDraft: async (draftId) => {
    set({ isLoading: true, error: null });

    try {
      // Determine if this is a cloud draft (has numeric ID) or a local draft
      const isCloudDraft = !draftId.startsWith('draft-');
      let draftData: ContentDraft | null = null;

      // Try to load from cloud if it's a cloud draft
      if (isCloudDraft) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/content/drafts/${draftId}`, {
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include', // Include cookies for session
          });

          if (response.ok) {
            const data = await response.json();
            draftData = data.draft;
          }
        } catch (cloudError) {
          console.error('Failed to load cloud draft', cloudError);
          // Continue to local fallback
        }
      }

      // If not found in cloud or cloud fetch failed, try local storage
      if (!draftData) {
        const drafts = getLocalDrafts();
        draftData = drafts.find(d => d.id === draftId) || null;
      }

      if (!draftData) {
        throw new Error('Draft not found in cloud or local storage');
      }

      // If we found it in the cloud but also have a local copy, mark as both
      if (isCloudDraft) {
        const localDrafts = getLocalDrafts();
        const localDraft = localDrafts.find(d => d.id === draftId);
        if (localDraft) {
          draftData.storageLocation = 'both';
        }
      }

      set({
        currentDraft: draftData,
        isLoading: false,
        isDirty: false
      });

    } catch (error) {
      console.error('Load draft error:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load draft. Please try again.'
      });
    }
  },

  deleteDraft: async (draftId) => {
    set({ isLoading: true, error: null });

    try {
      const { savedDrafts } = get();
      const draftToDelete = savedDrafts.find(d => d.id === draftId);

      if (!draftToDelete) {
        throw new Error('Draft not found');
      }

      // Determine if this is a cloud draft that needs to be deleted from the server
      const isCloudDraft = draftToDelete.storageLocation === 'cloud' || draftToDelete.storageLocation === 'both';

      // Try to delete from backend if it's a cloud draft
      if (isCloudDraft) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/content/drafts/${draftId}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include', // Include cookies for session
          });

          if (!response.ok) {
            console.error('Failed to delete from cloud, but continuing with local deletion');
          }
        } catch (cloudError) {
          console.error('Failed to delete from cloud', cloudError);
        }
      }

      // Determine if we need to delete from local storage
      const isLocalDraft = draftToDelete.storageLocation === 'local' || draftToDelete.storageLocation === 'both';

      // Delete from localStorage if it's a local draft
      if (isLocalDraft) {
        const localDrafts = getLocalDrafts();
        const updatedLocalDrafts = localDrafts.filter(d => d.id !== draftId);
        saveLocalDrafts(updatedLocalDrafts);
      }

      // Update state with filtered drafts
      const updatedDrafts = savedDrafts.filter(d => d.id !== draftId);

      // Check if we're deleting the current draft
      const { currentDraft } = get();
      const isCurrentDraft = currentDraft.id === draftId;

      set({
        savedDrafts: updatedDrafts,
        isLoading: false,
        // If the deleted draft was the current draft, reset to a new draft
        ...(isCurrentDraft && {
          currentDraft: {
            title: '',
            content: '',
            wordCount: 0,
            lastSaved: new Date().toISOString(),
            status: 'draft',
            storageLocation: 'local'
          },
          isDirty: false
        })
      });

    } catch (error) {
      console.error('Delete draft error:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to delete draft. Please try again.'
      });
    }
  },

  generateTextSummary: async (text) => {
    if (!text || text.trim().length === 0) {
      console.warn('No text to analyze');
      return;
    }

    set({ isAnalyzing: true, error: null });

    try {
      const response = await fetch(`${API_BASE_URL}/api/content/seo/text-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Text Summary Results:', data);

      if (data.success && data.data.tasks && data.data.tasks[0]?.result?.[0]) {
        set({
          textSummary: data.data.tasks[0].result[0],
          analyzedText: data.data.tasks[0].data.text,
          isAnalyzing: false
        });
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Error generating text summary:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to analyze text. Please try again.',
        isAnalyzing: false
      });
    }
  },

  generateContentSuggestions: async (text) => {
    if (!text || text.trim().length === 0) {
      console.warn('No text to analyze');
      return;
    }

    set({
      contentSuggestions: {
        ...get().contentSuggestions,
        isLoading: true
      },
      error: null
    });

    try {
      // Call the content suggestions API with debug flag
      console.log('Calling content suggestions API with text:', text.substring(0, 100) + '...');
      const response = await fetch(`${API_BASE_URL}/api/content/seo/content-suggestions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          text,
          debug: true // Always request debug info for now
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API error (${response.status}):`, errorText);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Content Suggestions API Response:', data);

      // Log debug info if available
      if (data.debug) {
        console.log('API Debug Info:', data.debug);
      }

      if (data.success) {
        // Extract related keywords from the response
        let relatedKeywords: RelatedKeyword[] = [];
        const analyzedKeywords = data.data.analyzedKeywords || [];

        // Log detailed API response structure for debugging
        console.log('API response analyzedKeywords:', analyzedKeywords);
        console.log('API relatedKeywords structure:', data.data.relatedKeywords);

        // First check if the server already extracted the keywords for us
        if (Array.isArray(data.data.extractedKeywords) && data.data.extractedKeywords.length > 0) {
          console.log('Using server-extracted keywords:', data.data.extractedKeywords.length);

          // Map the extracted keywords to our RelatedKeyword interface
          relatedKeywords = data.data.extractedKeywords
            .filter((item: unknown): item is KeywordResponseItem =>
              item !== null && typeof item === 'object' && 'keyword' in item)
            .map((item: KeywordResponseItem) => ({
              keyword: item.keyword,
              competition: item.competition || 'LOW',
              competition_index: item.competition_index || 0,
              search_volume: item.search_volume || 0,
              location_code: item.location_code || 0,
              language_code: item.language_code || null,
              search_partners: item.search_partners || false,
              low_top_of_page_bid: item.low_top_of_page_bid || null,
              high_top_of_page_bid: item.high_top_of_page_bid || null,
              cpc: item.cpc || null,
              monthly_searches: item.monthly_searches || []
            }))
            .slice(0, 10);
        }
        // Check if there's an API error response from DataForSEO
        else if (data.data.relatedKeywords?.tasks_error > 0 &&
          data.data.relatedKeywords?.tasks?.[0]?.status_code !== 20000) {
          // Log the error for debugging
          const errorCode = data.data.relatedKeywords.tasks[0].status_code;
          const errorMessage = data.data.relatedKeywords.tasks[0].status_message;
          console.error(`DataForSEO API error (${errorCode}): ${errorMessage}`);

          // You could set an error message in the UI here if needed
          console.warn(`Failed to get keyword suggestions: ${errorMessage}`);
        }
        // Try different paths to find keywords in the response
        else if (data.data.relatedKeywords?.tasks?.[0]?.result) {
          const results = data.data.relatedKeywords.tasks[0].result;
          console.log('Found results in standard path:', results.length);

          // Process the results as before
          if (results && results.length > 0) {
            // Case 1: Direct keywords array (each item has a keyword property)
            if (typeof results[0] === 'object' && 'keyword' in results[0]) {
              console.log('Found direct keyword structure');

              // Map the keyword items to our RelatedKeyword interface
              relatedKeywords = results
                .filter((item: unknown): item is KeywordResponseItem =>
                  item !== null && typeof item === 'object' && 'keyword' in item)
                .map((item: KeywordResponseItem) => ({
                  keyword: item.keyword,
                  competition: item.competition || 'LOW',
                  competition_index: item.competition_index || 0,
                  search_volume: item.search_volume || 0,
                  location_code: item.location_code || 0,
                  language_code: item.language_code || null,
                  search_partners: item.search_partners || false,
                  low_top_of_page_bid: item.low_top_of_page_bid || null,
                  high_top_of_page_bid: item.high_top_of_page_bid || null,
                  cpc: item.cpc || null,
                  monthly_searches: item.monthly_searches || []
                }))
                .slice(0, 10);
            }
            // Case 2: Nested keyword_data structure with related_keywords array
            else if (typeof results[0] === 'object' &&
              'keyword_data' in results[0] &&
              results[0].keyword_data &&
              'related_keywords' in results[0].keyword_data &&
              Array.isArray(results[0].keyword_data.related_keywords)) {

              console.log('Found nested keyword_data structure');

              const keywordItems = results[0].keyword_data.related_keywords;
              if (keywordItems && keywordItems.length > 0) {
                // Map the nested keyword items to our RelatedKeyword interface
                relatedKeywords = keywordItems
                  .filter((item: unknown): item is KeywordResponseItem =>
                    item !== null && typeof item === 'object' && 'keyword' in item)
                  .map((item: KeywordResponseItem) => ({
                    keyword: item.keyword,
                    competition: item.competition || 'LOW',
                    competition_index: item.competition_index || 0,
                    search_volume: item.search_volume || 0,
                    location_code: item.location_code || 0,
                    language_code: item.language_code || null,
                    search_partners: item.search_partners || false,
                    low_top_of_page_bid: item.low_top_of_page_bid || null,
                    high_top_of_page_bid: item.high_top_of_page_bid || null,
                    cpc: item.cpc || null,
                    monthly_searches: item.monthly_searches || []
                  }))
                  .slice(0, 10);
              }
            }
            else {
              console.warn('Unknown or unsupported API response structure:', results[0]);
            }
          } else {
            console.warn('API returned empty results array');
          }
        }
        // Try alternative path - the API might directly include keyword items
        else if (Array.isArray(data.data.relatedKeywords)) {
          console.log('Found keywords in direct array:', data.data.relatedKeywords.length);

          relatedKeywords = data.data.relatedKeywords
            .filter((item: unknown): item is KeywordResponseItem =>
              item !== null && typeof item === 'object' && 'keyword' in item)
            .map((item: KeywordResponseItem) => ({
              keyword: item.keyword,
              competition: item.competition || 'LOW',
              competition_index: item.competition_index || 0,
              search_volume: item.search_volume || 0,
              location_code: item.location_code || 0,
              language_code: item.language_code || null,
              search_partners: item.search_partners || false,
              low_top_of_page_bid: item.low_top_of_page_bid || null,
              high_top_of_page_bid: item.high_top_of_page_bid || null,
              cpc: item.cpc || null,
              monthly_searches: item.monthly_searches || []
            }))
            .slice(0, 10);
        }
        else {
          console.warn('No results found in API response');
          console.log('Actual response structure:', JSON.stringify(data.data));
        }

        console.log(`Extracted ${relatedKeywords.length} related keywords:`,
          relatedKeywords.map(k => k.keyword));

        // Update the store with the processed data
        set({
          textSummary: data.data.summary.tasks[0].result[0],
          analyzedText: data.data.summary.tasks[0].data.text,
          contentSuggestions: {
            analyzedKeywords: analyzedKeywords,
            relatedKeywords: relatedKeywords,
            isLoading: false
          }
        });
      } else {
        throw new Error(`API returned success: false - ${data.message || 'No error message provided'}`);
      }
    } catch (error) {
      console.error('Error generating content suggestions:', error);
      set({
        contentSuggestions: {
          ...get().contentSuggestions,
          isLoading: false
        },
        error: error instanceof Error ? error.message : 'Failed to generate content suggestions. Please try again.'
      });
    }
  },

  analyzeKeyword: async (text: string, keyword: string) => {
    if (!text || text.trim().length === 0) {
      console.warn('No text to analyze');
      return;
    }

    if (!keyword || keyword.trim().length === 0) {
      console.warn('No keyword specified');
      return;
    }

    set({
      contentSuggestions: {
        ...get().contentSuggestions,
        isLoading: true
      },
      error: null
    });

    try {
      // Call the content suggestions API with specific keyword
      console.log(`Analyzing content for specific keyword: "${keyword}"`);
      const response = await fetch(`${API_BASE_URL}/api/content/seo/keyword-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          text,
          keyword,
          debug: true
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API error (${response.status}):`, errorText);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Keyword Analysis Response:', data);

      // Log debug info if available
      if (data.debug) {
        console.log('API Debug Info:', data.debug);
      }

      if (data.success) {
        // Extract related keywords from the response
        let relatedKeywords: RelatedKeyword[] = [];
        const analyzedKeywords = [keyword, ...(data.data.analyzedKeywords || []).filter((k: string) => k !== keyword)];

        // Process the data the same way as in generateContentSuggestions
        if (Array.isArray(data.data.extractedKeywords) && data.data.extractedKeywords.length > 0) {
          console.log('Using server-extracted keywords:', data.data.extractedKeywords.length);

          relatedKeywords = data.data.extractedKeywords
            .filter((item: unknown): item is KeywordResponseItem =>
              item !== null && typeof item === 'object' && 'keyword' in item)
            .map((item: KeywordResponseItem) => ({
              keyword: item.keyword,
              competition: item.competition || 'LOW',
              competition_index: item.competition_index || 0,
              search_volume: item.search_volume || 0,
              location_code: item.location_code || 0,
              language_code: item.language_code || null,
              search_partners: item.search_partners || false,
              low_top_of_page_bid: item.low_top_of_page_bid || null,
              high_top_of_page_bid: item.high_top_of_page_bid || null,
              cpc: item.cpc || null,
              monthly_searches: item.monthly_searches || []
            }))
            .slice(0, 10);
        }

        // Update the store with the processed data
        set({
          textSummary: data.data.summary.tasks[0].result[0],
          analyzedText: data.data.summary.tasks[0].data.text,
          contentSuggestions: {
            analyzedKeywords: analyzedKeywords,
            relatedKeywords: relatedKeywords,
            isLoading: false
          }
        });
      } else {
        throw new Error(`API returned success: false - ${data.message || 'No error message provided'}`);
      }
    } catch (error) {
      console.error('Error analyzing keyword:', error);
      set({
        contentSuggestions: {
          ...get().contentSuggestions,
          isLoading: false
        },
        error: error instanceof Error ? error.message : 'Failed to analyze keyword. Please try again.'
      });
    }
  },

  suggestContentRewrites: async (content: string, targetKeywords: string[]) => {
    if (!content || content.trim().length === 0) {
      console.warn('No content to analyze');
      return;
    }

    if (!targetKeywords || targetKeywords.length === 0) {
      console.warn('No target keywords specified');
      return;
    }

    set({
      contentRewrites: {
        ...get().contentRewrites,
        isLoading: true
      },
      error: null
    });

    try {
      // Call the content rewrite suggestions API
      console.log(`Requesting content rewrites for keywords: ${targetKeywords.join(', ')}`);

      const response = await fetch(`${API_BASE_URL}/api/content/ai/suggest-rewrites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          content,
          targetKeywords
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API error (${response.status}):`, errorText);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Content Rewrite Suggestions Response:', data);

      if (data.success) {
        set({
          contentRewrites: {
            suggestions: data.suggestions,
            rawSuggestions: data.rawSuggestions,
            insights: data.insights,
            isLoading: false
          }
        });

        console.log(`Received ${data.suggestions.length} rewrite suggestions`);
      } else {
        throw new Error(`API returned success: false - ${data.message || 'No error message provided'}`);
      }
    } catch (error) {
      console.error('Error suggesting content rewrites:', error);
      set({
        contentRewrites: {
          ...get().contentRewrites,
          isLoading: false
        },
        error: error instanceof Error ? error.message : 'Failed to suggest content rewrites. Please try again.'
      });
    }
  },

  optimizeContent: async (content: string, targetKeyword: string) => {
    if (!content || content.trim().length === 0) {
      console.warn('No content to analyze');
      return;
    }

    if (!targetKeyword || targetKeyword.trim().length === 0) {
      console.warn('No keyword specified');
      return;
    }

    // First set loading states for both SEO analysis and content rewrites
    set({
      isAnalyzing: true,
      contentSuggestions: {
        ...get().contentSuggestions,
        isLoading: true
      },
      contentRewrites: {
        ...get().contentRewrites,
        isLoading: true
      },
      error: null
    });

    try {
      // Remove HTML tags for cleaner text
      const plainText = content.replace(/<[^>]*>/g, ' ').trim();

      // First, analyze the keyword to get SEO insights
      console.log(`Analyzing content for keyword: "${targetKeyword}"`);

      // Call the analyzeKeyword API
      const keywordResponse = await fetch(`${API_BASE_URL}/api/content/seo/keyword-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          text: plainText,
          keyword: targetKeyword
        })
      });

      if (!keywordResponse.ok) {
        throw new Error(`Keyword analysis failed: ${keywordResponse.status}`);
      }

      const keywordData = await keywordResponse.json();
      console.log('Keyword Analysis Response:', keywordData);

      if (!keywordData.success) {
        throw new Error(`API returned success: false - ${keywordData.message || 'No error message provided'}`);
      }

      // Process the keyword analysis results
      let relatedKeywords: RelatedKeyword[] = [];
      const analyzedKeywords = [targetKeyword, ...(keywordData.data.analyzedKeywords || []).filter((k: string) => k !== targetKeyword)];

      if (Array.isArray(keywordData.data.extractedKeywords) && keywordData.data.extractedKeywords.length > 0) {
        console.log('Using server-extracted keywords:', keywordData.data.extractedKeywords.length);

        relatedKeywords = keywordData.data.extractedKeywords
          .filter((item: unknown): item is KeywordResponseItem =>
            item !== null && typeof item === 'object' && 'keyword' in item)
          .map((item: KeywordResponseItem) => ({
            keyword: item.keyword,
            competition: item.competition || 'LOW',
            competition_index: item.competition_index || 0,
            search_volume: item.search_volume || 0,
            location_code: item.location_code || 0,
            language_code: item.language_code || null,
            search_partners: item.search_partners || false,
            low_top_of_page_bid: item.low_top_of_page_bid || null,
            high_top_of_page_bid: item.high_top_of_page_bid || null,
            cpc: item.cpc || null,
            monthly_searches: item.monthly_searches || []
          }))
          .slice(0, 10);
      }

      // Extract readability level from the text summary
      const readabilityLevel = keywordData.data.summary.tasks?.[0]?.result?.[0]?.coleman_liau_index
        ? getReadabilityLevelFromIndex(keywordData.data.summary.tasks[0].result[0].coleman_liau_index)
        : 'Unknown';

      // Update the SEO analysis results
      set({
        textSummary: keywordData.data.summary.tasks[0].result[0],
        analyzedText: keywordData.data.summary.tasks[0].data.text,
        contentSuggestions: {
          analyzedKeywords: analyzedKeywords,
          relatedKeywords: relatedKeywords,
          isLoading: false
        },
        isAnalyzing: false
      });

      // Prepare existing analysis to pass to the content optimization endpoint
      const existingAnalysis = {
        analyzedKeywords,
        relatedKeywords: relatedKeywords.map(k => ({
          keyword: k.keyword,
          search_volume: k.search_volume,
          competition: k.competition
        })),
        readabilityLevel,
        textSummary: keywordData.data.summary.tasks[0].result[0]
      };

      // Now that we have SEO insights, request content optimization
      console.log(`Requesting content rewrites for keyword: ${targetKeyword}`);

      const rewriteResponse = await fetch(`${API_BASE_URL}/api/content/ai/suggest-rewrites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          content,
          targetKeywords: [targetKeyword],
          existingAnalysis // Pass the existing analysis to avoid duplicate API calls
        })
      });

      if (!rewriteResponse.ok) {
        throw new Error(`Content rewrite failed: ${rewriteResponse.status}`);
      }

      const rewriteData = await rewriteResponse.json();
      console.log('Content Rewrite Suggestions Response:', rewriteData);

      if (!rewriteData.success) {
        throw new Error(`API returned success: false - ${rewriteData.message || 'No error message provided'}`);
      }

      // Update the content rewrite results
      set({
        contentRewrites: {
          suggestions: rewriteData.suggestions,
          rawSuggestions: rewriteData.rawSuggestions,
          insights: rewriteData.insights,
          isLoading: false
        }
      });
    } catch (error) {
      console.error('Error optimizing content:', error);
      set({
        isAnalyzing: false,
        contentSuggestions: {
          ...get().contentSuggestions,
          isLoading: false
        },
        contentRewrites: {
          ...get().contentRewrites,
          isLoading: false
        },
        error: error instanceof Error ? error.message : 'Failed to optimize content. Please try again.'
      });
    }
  },

  clearTextSummary: () => {
    set({
      textSummary: null,
      analyzedText: '',
      contentSuggestions: {
        analyzedKeywords: [],
        relatedKeywords: [],
        isLoading: false
      }
    });
  },

  clearContentRewrites: () => {
    set({
      contentRewrites: {
        suggestions: [],
        rawSuggestions: '',
        isLoading: false,
        insights: undefined
      }
    });
  },

  applyRewriteSuggestion: (original: string, improved: string) => {
    set(state => {
      try {
        // Get the current content
        const currentContent = state.currentDraft.content;

        // HTML could be different in the suggestion vs. the original content
        // Try both the raw string and a sanitized version
        let updatedContent = currentContent;
        let success = false;

        // Helper function for fuzzy matching
        const tryFuzzyMatching = (content: string, original: string, improved: string): string | false => {
          try {
            // Split content by paragraph or similar blocks
            const paragraphElements = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote'];
            const paragraphRegex = new RegExp(`<(${paragraphElements.join('|')})[^>]*>(.*?)<\\/\\1>`, 'gi');
            const paragraphs = [...content.matchAll(paragraphRegex)];

            // Strip HTML from original for comparison
            const stripHtml = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            const plainOriginal = stripHtml(original);

            // Fuzzy similarity function (using Levenshtein distance simplified)
            const similarity = (a: string, b: string): number => {
              const longer = a.length > b.length ? a : b;
              const shorter = a.length > b.length ? b : a;

              if (longer.length === 0) return 1.0;

              // Simple check if one string contains the other
              if (longer.includes(shorter)) return 0.8;

              // Check if they share significant words
              const longerWords = longer.toLowerCase().split(/\s+/);
              const shorterWords = shorter.toLowerCase().split(/\s+/);
              const commonWords = shorterWords.filter(w => longerWords.includes(w));

              return commonWords.length / shorterWords.length;
            };

            // Try to find the most similar paragraph
            let bestMatch: { fullMatch: string; tagName: string; innerContent: string } | null = null;
            let bestScore = 0.6; // Threshold for considering a match
            let replacedContent = content;

            for (const paragraph of paragraphs) {
              const fullMatch = paragraph[0];
              const tagName = paragraph[1];
              const innerText = paragraph[2];
              const plainParagraph = stripHtml(innerText);

              const score = similarity(plainParagraph, plainOriginal);

              if (score > bestScore) {
                bestScore = score;
                bestMatch = { fullMatch, tagName, innerContent: innerText };
              }
            }

            if (bestMatch) {
              // Replace the content inside the matched tag while preserving the tag
              const { fullMatch, tagName } = bestMatch;

              // Extract the HTML structure from the original improved text if possible
              const improvedContent = improved.replace(/<[^>]*>/g, '').trim();
              const newHtml = `<${tagName}>${improvedContent}</${tagName}>`;

              replacedContent = content.replace(fullMatch, newHtml);
              return replacedContent;
            }

            return false;
          } catch (error) {
            console.error('Error in fuzzy matching:', error);
            return false;
          }
        };

        // Log the full contents we're trying to replace for debugging
        console.log('Attempting to replace:', {
          originalLength: original.length,
          improvedLength: improved.length,
          currentContentLength: currentContent.length,
          originalText: original.substring(0, 30) + '...',
          improvedText: improved.substring(0, 30) + '...'
        });

        // SPECIAL CASE: Check if this is an H1 heading suggestion
        if (original.includes('<h1') || improved.includes('<h1') ||
          /^(The|A|An)\s.{5,}/.test(original) || // Common title patterns
          /^(Introduction|Overview|Getting Started)/i.test(original)) {
          console.log('Detected potential H1 heading, using specialized handling');

          // Find ALL H1 tags in the document
          const h1Regex = /<h1[^>]*>(.*?)<\/h1>/gi;
          const h1Tags = [...currentContent.matchAll(h1Regex)];

          if (h1Tags.length > 0) {
            console.log(`Found ${h1Tags.length} H1 tags in document`);

            // Extract plain text from original
            const getPlainText = (html: string) => html.replace(/<[^>]*>/g, '').trim();
            const originalPlainText = getPlainText(original);

            // Try to match each H1 by plain text similarity
            for (const h1Match of h1Tags) {
              const fullH1Tag = h1Match[0];
              const h1Content = h1Match[1];
              const h1PlainText = getPlainText(h1Content);

              // Check plain text similarity with various methods
              const isMatch =
                h1PlainText.includes(originalPlainText) ||
                originalPlainText.includes(h1PlainText) ||
                // Check word overlap
                originalPlainText.split(' ').some(word =>
                  word.length > 4 && h1PlainText.includes(word)) ||
                h1PlainText.toLowerCase().includes(originalPlainText.toLowerCase().substring(0, 15));

              if (isMatch) {
                console.log('Found matching H1:', {
                  h1: h1PlainText,
                  original: originalPlainText
                });

                // Preserve H1 tag attributes
                const openingTagMatch = fullH1Tag.match(/<h1[^>]*>/i);
                const openingTag = openingTagMatch ? openingTagMatch[0] : '<h1>';

                // Extract improved content and build new H1
                const improvedContent = getPlainText(improved);
                const newH1 = `${openingTag}${improvedContent}</h1>`;

                // Replace the H1 tag
                updatedContent = currentContent.replace(fullH1Tag, newH1);
                success = true;
                console.log('Successfully replaced H1 with specialized handling');
                break;
              }
            }
          }
        }

        // SPECIAL CASE: <p> to <h2> transformation
        if (!success && original.includes('<h2>') && improved.includes('<h2>')) {
          // Extract the plain text from heading tags
          const originalText = original.replace(/<[^>]*>/g, '').trim();
          const improvedText = improved.replace(/<[^>]*>/g, '').trim();

          // Look for this text in paragraphs, especially with a <br> after it
          const paragraphRegex = new RegExp(`<p[^>]*>\\s*(${originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\s*(<br[^>]*>|<br\\s*/>)`, 'i');
          const paragraphMatch = currentContent.match(paragraphRegex);

          if (paragraphMatch) {
            console.log('Found heading text in paragraph with br:', paragraphMatch[0]);

            // Find the full paragraph
            const paragraphStartIndex = currentContent.lastIndexOf('<p', paragraphMatch.index || 0);
            const paragraphEndIndex = currentContent.indexOf('</p>', paragraphMatch.index || 0) + 4;

            if (paragraphStartIndex >= 0 && paragraphEndIndex > paragraphStartIndex) {
              const fullParagraph = currentContent.substring(paragraphStartIndex, paragraphEndIndex);

              // Split the paragraph at the <br> tag
              const brIndex = fullParagraph.indexOf('<br', fullParagraph.indexOf(originalText));

              if (brIndex > 0) {
                // Extract content before and after the <br>
                const beforeBr = fullParagraph.substring(0, brIndex);
                const afterBr = fullParagraph.substring(brIndex);

                // Replace the original heading text with empty string in the "before" part
                const cleanedBeforeBr = beforeBr.replace(originalText, '').replace(/<p[^>]*>\s*/, '').trim();

                // Create new content with h2 and modified paragraph
                const newContent =
                  `<h2>${improvedText}</h2>` +
                  (cleanedBeforeBr || afterBr ? `<p>${cleanedBeforeBr ? cleanedBeforeBr + ' ' : ''}${afterBr.replace(/<br[^>]*>|<br\s*\/>\s*/, '')}` : '');

                // Replace the entire paragraph with our new structure
                updatedContent = currentContent.replace(fullParagraph, newContent);
                success = true;
                console.log('Transformed paragraph text into h2 heading');
              } else {
                // If there's no <br>, check if the heading text is at the beginning of the paragraph
                const paragraphContent = fullParagraph.replace(/<p[^>]*>|<\/p>/g, '').trim();

                if (paragraphContent.startsWith(originalText)) {
                  // Replace the full paragraph with h2 + new paragraph
                  const remainingContent = paragraphContent.substring(originalText.length).trim();
                  const newContent =
                    `<h2>${improvedText}</h2>` +
                    (remainingContent ? `<p>${remainingContent}</p>` : '');

                  updatedContent = currentContent.replace(fullParagraph, newContent);
                  success = true;
                  console.log('Transformed paragraph text into h2 heading (no br)');
                }
              }
            }
          } else {
            // Try simpler matching without <br>
            const simpleParagraphRegex = new RegExp(`<p[^>]*>\\s*(${originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'i');
            const simpleMatch = currentContent.match(simpleParagraphRegex);

            if (simpleMatch) {
              console.log('Found heading text at start of paragraph:', simpleMatch[0]);

              // Find full paragraph 
              const paragraphStartIndex = currentContent.lastIndexOf('<p', simpleMatch.index || 0);
              const paragraphEndIndex = currentContent.indexOf('</p>', simpleMatch.index || 0) + 4;

              if (paragraphStartIndex >= 0 && paragraphEndIndex > paragraphStartIndex) {
                const fullParagraph = currentContent.substring(paragraphStartIndex, paragraphEndIndex);
                // Extract paragraph content without tags
                const paragraphContent = fullParagraph.replace(/<p[^>]*>|<\/p>/g, '').trim();

                // Create a regex to find the heading text followed by remaining content
                const contentRegex = new RegExp(`^\\s*(${originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\s*(.*)$`, 's');
                const contentMatch = paragraphContent.match(contentRegex);

                if (contentMatch) {
                  const remainingContent = contentMatch[2].trim();
                  // Create new content with h2 and modified paragraph
                  const newContent =
                    `<h2>${improvedText}</h2>` +
                    (remainingContent ? `<p>${remainingContent}</p>` : '');

                  updatedContent = currentContent.replace(fullParagraph, newContent);
                  success = true;
                  console.log('Transformed paragraph text into h2 heading (simple match)');
                }
              }
            }
          }
        }

        // 1. Try exact match if specialized handling didn't work
        if (!success && currentContent.includes(original)) {
          updatedContent = currentContent.replace(original, improved);
          success = true;
          console.log('Applied suggestion with exact match');
        }
        // 2. Try with heading tag patterns
        else if (!success && (original.includes('The Art and Science') || original.includes('Introduction') ||
          /^<h[1-6][^>]*>.*<\/h[1-6]>$/i.test(original.trim()))) {
          // Special handling for heading tags which often have different formatting
          const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h\1>/gi;
          const originalTextMatch = original.match(/>(.*?)</);
          const originalHeadingText = originalTextMatch ? originalTextMatch[1] : original.replace(/<[^>]*>/g, '').trim();

          console.log('Looking for heading with text:', originalHeadingText);

          // SPECIAL CASE: Handle when heading text appears in a paragraph
          // Extract the plain text from the improved suggestion
          const improvedMatch = improved.match(/>(.*?)</);
          const improvedHeadingText = improvedMatch ? improvedMatch[1] : improved.replace(/<[^>]*>/g, '').trim();

          // Look for the heading text in paragraph tags
          const paragraphWithHeadingRegex = new RegExp(`<p[^>]*>\\s*(${originalHeadingText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'i');
          const paragraphMatch = currentContent.match(paragraphWithHeadingRegex);

          if (paragraphMatch) {
            console.log('Found heading text in paragraph:', paragraphMatch[0]);

            // Find the entire paragraph
            const paragraphStart = currentContent.lastIndexOf('<p', paragraphMatch.index || 0);
            if (paragraphStart >= 0) {
              // Find the matching closing tag or <br> that might follow the heading text
              const closingTagIndex = currentContent.indexOf('</p>', paragraphMatch.index || 0);
              const brTagIndex = currentContent.indexOf('<br', paragraphMatch.index || 0);

              // Determine if there's a <br> before the paragraph ends
              const hasBrAfterHeading = brTagIndex > 0 && brTagIndex < closingTagIndex;

              if (hasBrAfterHeading) {
                // If there's a <br>, only replace the text before the <br>
                const textBeforeBr = currentContent.substring(paragraphStart, brTagIndex);
                const updatedText = textBeforeBr.replace(originalHeadingText, improvedHeadingText);
                updatedContent = currentContent.replace(textBeforeBr, updatedText);
                success = true;
                console.log('Replaced heading text before <br> tag');
              } else if (closingTagIndex > 0) {
                // Replace within the full paragraph
                const fullParagraph = currentContent.substring(paragraphStart, closingTagIndex + 4);
                const updatedParagraph = fullParagraph.replace(originalHeadingText, improvedHeadingText);
                updatedContent = currentContent.replace(fullParagraph, updatedParagraph);
                success = true;
                console.log('Replaced heading text in full paragraph');
              }
            }
          }

          // If heading wasn't found in a paragraph, continue with normal heading detection
          if (!success) {
            // Create a pattern that finds headings containing the core text
            const headingMatches = [...currentContent.matchAll(headingRegex)];

            // Also check for TipTap-specific heading formats
            const tiptapHeadingRegex = /<[^>]*?data-type=['"]heading['"][^>]*?>(.*?)<\/[^>]*?>/gi;
            const tiptapHeadingMatches = [...currentContent.matchAll(tiptapHeadingRegex)];

            // Combine all heading matches
            const allHeadingMatches = [...headingMatches, ...tiptapHeadingMatches];

            // If no standard or TipTap headings found, try plain text match
            if (allHeadingMatches.length === 0) {
              // Try to find by plain text
              const plainTextPattern = new RegExp(`>(\\s*${originalHeadingText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*)<`, 'i');
              const plainTextMatch = currentContent.match(plainTextPattern);

              if (plainTextMatch) {
                console.log('Found heading by plain text search:', plainTextMatch[0]);
                // Find the surrounding element
                const startPos = currentContent.lastIndexOf('<', plainTextMatch.index || 0);
                const endPos = currentContent.indexOf('>', (plainTextMatch.index || 0) + plainTextMatch[0].length) + 1;

                if (startPos >= 0 && endPos > startPos) {
                  const surroundingElement = currentContent.substring(startPos, endPos);
                  const tagMatch = surroundingElement.match(/<([a-z0-9]+)[^>]*>/i);

                  if (tagMatch) {
                    const tagName = tagMatch[1];
                    const fullElement = currentContent.substring(
                      startPos,
                      currentContent.indexOf(`</${tagName}>`, plainTextMatch.index) + tagName.length + 3
                    );

                    // Create a new heading with the improved text
                    const improvedHeadingText = improved.replace(/<[^>]*>/g, '').trim();
                    const newElement = fullElement.replace(originalHeadingText, improvedHeadingText);

                    updatedContent = currentContent.replace(fullElement, newElement);
                    success = true;
                  }
                }
              }
            }

            // Try to find a matching heading if not found by plain text
            if (!success) {
              for (const match of allHeadingMatches) {
                const headingText = match[2] || match[1]; // Different group indices for standard vs TipTap
                const fullHeadingTag = match[0];

                // Different heading matching strategies
                const matches =
                  headingText.includes(originalHeadingText) ||
                  originalHeadingText.includes(headingText) ||
                  // Check word-by-word similarity for more fuzzy matching
                  headingText.split(/\s+/).some(word =>
                    word.length > 4 && originalHeadingText.includes(word)) ||
                  // Case insensitive match
                  headingText.toLowerCase().includes(originalHeadingText.toLowerCase());

                if (matches) {
                  // Found a matching heading, now replace it
                  console.log('Found matching heading:', {
                    originalHeading: fullHeadingTag,
                    originalHeadingText: originalHeadingText,
                    matchedHeadingText: headingText
                  });

                  // Preserve any attributes in the original tag
                  const openingTagMatch = fullHeadingTag.match(/<[^>]*>/i);
                  const closingTagMatch = fullHeadingTag.match(/<\/[^>]*>/i);

                  const openingTag = openingTagMatch ? openingTagMatch[0] : `<h2>`;
                  const closingTag = closingTagMatch ? closingTagMatch[0] : `</h2>`;

                  // Create the new heading with preserved tag structure
                  const newHeadingContent = improved.replace(/<[^>]*>/g, '').trim();
                  const newFullHeading = `${openingTag}${newHeadingContent}${closingTag}`;

                  console.log('Creating new heading:', newFullHeading);
                  updatedContent = currentContent.replace(fullHeadingTag, newFullHeading);
                  success = true;
                  break;
                }
              }
            }
          }
        }

        // 3. Try with stripped HTML
        else {
          // Escape special regex characters in the original text
          const escapedOriginal = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

          // Create a regex that can match the text with or without surrounding HTML tags
          // This handles cases where text might be split across multiple nodes
          const originalRegex = new RegExp(
            `(${escapedOriginal}|${escapedOriginal.replace(/\s+/g, '\\s+')})`,
            'gi'
          );

          // Replace the text while preserving HTML structure
          const tempContent = currentContent.replace(originalRegex, improved);

          // Check if replacement actually happened
          if (tempContent !== currentContent) {
            updatedContent = tempContent;
            success = true;
            console.log('Applied suggestion with regex match');
          } else {
            // 4. Try with stripped inner HTML as last resort
            // Remove HTML tags from both strings for comparison
            const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '');
            const plainOriginal = stripHtml(original);
            const plainContent = stripHtml(currentContent);
            const escapedPlainOriginal = plainOriginal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            // Find the text position in the stripped content
            const plainRegex = new RegExp(`(${escapedPlainOriginal})`, 'gi');
            const matches = [...plainContent.matchAll(plainRegex)];

            if (matches.length > 0) {
              // For each match, try to find the corresponding position in the HTML content
              for (const match of matches) {
                const startPos = match.index;
                const endPos = startPos + match[0].length;

                // Find the substring in the original HTML that contains this text
                let plainPos = 0;
                let htmlStartPos = 0;
                let htmlEndPos = 0;

                // Scan through the HTML to find the position
                for (let i = 0; i < currentContent.length; i++) {
                  if (currentContent[i] === '<') {
                    // Skip until the closing '>'
                    while (i < currentContent.length && currentContent[i] !== '>') i++;
                  } else {
                    if (plainPos === startPos) htmlStartPos = i;
                    if (plainPos === endPos) {
                      htmlEndPos = i;
                      break;
                    }
                    plainPos++;
                  }
                }

                if (htmlStartPos < htmlEndPos) {
                  const replacedContent = currentContent.substring(0, htmlStartPos) +
                    improved +
                    currentContent.substring(htmlEndPos);
                  updatedContent = replacedContent;
                  success = true;
                  console.log('Applied suggestion with HTML position match');
                  break;
                }
              }
            }

            // 5. FALLBACK: Advanced fuzzy matching when all other methods fail
            if (!success) {
              console.log('All standard methods failed, trying fuzzy matching as fallback');

              // Try paragraph-level fuzzy matching
              const fuzzyResult = tryFuzzyMatching(currentContent, original, improved);
              if (fuzzyResult !== false) {
                console.log('Applied suggestion using fuzzy matching');
                updatedContent = fuzzyResult;
                success = true;
              } else {
                // 6. FINAL FALLBACK: Chunk-based replacement strategy
                console.log('Trying chunk-based replacement as final fallback');
                const chunkResult = tryChunkReplacement(currentContent, original, improved);
                if (chunkResult !== false) {
                  console.log('Applied suggestion using chunk-based replacement');
                  updatedContent = chunkResult;
                  success = true;
                }
              }
            }
          }
        }

        console.log('Applied suggestion:', { original, improved, success });

        // Only update if we successfully made a replacement
        if (!success) {
          console.warn('Could not find the text to replace in the content');
          return state;
        }

        // Post-processing: Check for duplicate phrases that might have been introduced
        try {
          const stripHtml = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

          // Extract the improved text without HTML
          const improvedPlainText = stripHtml(improved);

          // Skip short phrases or if no replacement happened
          if (improvedPlainText.length > 15 && success) {
            // SAFER APPROACH: Only look for exact duplicates in the same paragraph
            const paragraphs = updatedContent.match(/<p[^>]*>.*?<\/p>/gs) || [];
            for (const paragraph of paragraphs) {
              // Extract plain text content of paragraph
              const paragraphText = paragraph.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

              // Only process paragraphs with substantial content
              if (paragraphText.length > 50) {
                // Extract text content from HTML without DOM
                const innerText = paragraph.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

                // Find sentences of 5+ words that appear twice in the paragraph
                const sentenceRegex = /[^.!?]+[.!?]+/g;
                const sentenceMatches = [...innerText.matchAll(sentenceRegex)];

                for (const sentenceMatch of sentenceMatches) {
                  const sentence = sentenceMatch[0].trim();

                  // Only check substantial sentences (5+ words)
                  if (sentence.split(/\s+/).length >= 5) {
                    // Count occurrences of this sentence in the paragraph
                    const sentenceCount = (innerText.match(new RegExp(
                      sentence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'
                    )) || []).length;

                    // If sentence appears multiple times in same paragraph
                    if (sentenceCount > 1) {
                      console.log('Found duplicate in paragraph:', sentence.substring(0, 40) + '...');
                      // Just remove the second instance of this exact sentence
                      const cleanedParagraph = paragraph.replace(
                        new RegExp(
                          `(${sentence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(.*?)(${sentence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
                          'i'
                        ),
                        '$1$2' // Keep first instance and content between, remove second instance
                      );
                      // Only update if we didn't remove too much content
                      const cleanedLength = cleanedParagraph.length;
                      const originalLength = paragraph.length;

                      if (cleanedLength > originalLength * 0.7) { // Ensure we didn't remove more than 30% of content
                        updatedContent = updatedContent.replace(paragraph, cleanedParagraph);
                        console.log('Safely removed duplicate sentence');
                      } else {
                        console.log('Skipped removal - would remove too much content');
                      }
                    }
                  }
                }
              }
            }

            // Split the improved text into meaningful chunks (8+ words)
            const improvedWords = improvedPlainText.split(/\s+/);

            if (improvedWords.length >= 8) {
              // Create chunks of 8 words that might repeat
              for (let i = 0; i <= improvedWords.length - 8; i++) {
                const chunk = improvedWords.slice(i, i + 8).join(' ');

                // Look for this chunk appearing twice in close proximity
                const chunkEscaped = chunk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const duplicateRegex = new RegExp(`(${chunkEscaped}[^<]{0,50}){2,}`, 'i');
                const duplicateMatch = updatedContent.match(duplicateRegex);

                if (duplicateMatch) {
                  console.log('Found duplicate content:', chunk);

                  // Find the surrounding paragraph
                  let startPos = updatedContent.lastIndexOf('<p', duplicateMatch.index || 0);
                  if (startPos < 0) startPos = updatedContent.lastIndexOf('<div', duplicateMatch.index || 0);

                  if (startPos >= 0) {
                    const endPos = updatedContent.indexOf('</p>', duplicateMatch.index || 0);
                    if (endPos > startPos) {
                      const paragraphWithDuplicates = updatedContent.substring(startPos, endPos + 4);

                      // Create a regex to match the second occurrence
                      const secondInstanceRegex = new RegExp(`(${chunkEscaped})([^<]{0,50}${chunkEscaped})`, 'i');
                      const cleanedParagraph = paragraphWithDuplicates.replace(secondInstanceRegex, '$1');

                      // Replace the paragraph with the cleaned version
                      updatedContent = updatedContent.replace(paragraphWithDuplicates, cleanedParagraph);
                      console.log('Removed duplicate content');
                    }
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error('Error in duplicate detection:', error);
          // Continue with the update even if deduplication fails
        }

        // Update word count and content
        const text = updatedContent.replace(/<[^>]*>/g, ' ');
        const words = text.split(/\s+/).filter(word => word.length > 0);

        return {
          currentDraft: {
            ...state.currentDraft,
            content: updatedContent,
            wordCount: words.length
          },
          isDirty: true
        };
      } catch (error) {
        console.error('Error applying suggestion:', error, { original, improved });
        return state; // Return unchanged state on error
      }
    });
  },

  // New method to apply multiple suggestions at once
  applyMultipleRewriteSuggestions: (suggestionsToApply: Array<{ original: string, improved: string }>) => {
    set(state => {
      try {
        let updatedContent = state.currentDraft.content;
        let appliedCount = 0;

        // Apply all replacements one by one using the improved single suggestion function
        for (const { original, improved } of suggestionsToApply) {
          // Create a temporary state object that mimics the real state
          const tempState = {
            ...state,
            currentDraft: {
              ...state.currentDraft,
              content: updatedContent
            }
          };

          // Apply the suggestion to the temporary state using our detailed logic
          // Helper function for fuzzy matching (simplified version for batch processing)
          const tryFuzzyMatching = (content: string, original: string, improved: string): string | false => {
            try {
              // Split content by paragraph or similar blocks
              const paragraphElements = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote'];
              const paragraphRegex = new RegExp(`<(${paragraphElements.join('|')})[^>]*>(.*?)<\\/\\1>`, 'gi');
              const paragraphs = [...content.matchAll(paragraphRegex)];

              // Strip HTML from original for comparison
              const stripHtml = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
              const plainOriginal = stripHtml(original);

              // Simplified similarity function
              const similarity = (a: string, b: string): number => {
                if (a.includes(b) || b.includes(a)) return 0.8;

                // Check if they share significant words
                const aWords = a.toLowerCase().split(/\s+/);
                const bWords = b.toLowerCase().split(/\s+/);
                const commonWords = bWords.filter(w => aWords.includes(w));

                return commonWords.length / Math.min(aWords.length, bWords.length);
              };

              // Try to find the most similar paragraph
              let bestMatch: { fullMatch: string; tagName: string; } | null = null;
              let bestScore = 0.6; // Threshold for considering a match

              for (const paragraph of paragraphs) {
                const fullMatch = paragraph[0];
                const tagName = paragraph[1];
                const innerText = paragraph[2];
                const plainParagraph = stripHtml(innerText);

                const score = similarity(plainParagraph, plainOriginal);

                if (score > bestScore) {
                  bestScore = score;
                  bestMatch = { fullMatch, tagName };
                }
              }

              if (bestMatch) {
                // Replace the content inside the matched tag while preserving the tag
                const { fullMatch, tagName } = bestMatch;

                // Extract the HTML structure from the original improved text if possible
                const improvedContent = improved.replace(/<[^>]*>/g, '').trim();
                const newHtml = `<${tagName}>${improvedContent}</${tagName}>`;

                return content.replace(fullMatch, newHtml);
              }

              return false;
            } catch (error) {
              console.error('Error in fuzzy matching during batch processing:', error);
              return false;
            }
          };

          // Helper function for chunk-based replacement (simplified version)
          const tryChunkReplacement = (content: string, original: string, improved: string): string | false => {
            try {
              const stripHtml = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
              const plainOriginal = stripHtml(original);
              const plainImproved = stripHtml(improved);

              if (plainOriginal.length < 10) return false;

              // Extract key phrases
              const originalWords = plainOriginal.split(/\s+/);
              const firstPhrase = originalWords.slice(0, Math.min(3, originalWords.length)).join(' ');
              const lastPhrase = originalWords.slice(Math.max(0, originalWords.length - 3)).join(' ');

              // Try to match with simple regex
              try {
                const fuzzyPattern = new RegExp(`[^>]*(${firstPhrase}[\\s\\S]*?${lastPhrase})[^<]*`, 'i');
                const match = content.match(fuzzyPattern);

                if (match && match[1]) {
                  const matchedText = match[0];
                  return content.replace(matchedText, plainImproved);
                }
              } catch (regexError) {
                console.error('Error in regex for batch chunk replacement:', regexError);
              }

              return false;
            } catch (error) {
              console.error('Error in chunk replacement during batch processing:', error);
              return false;
            }
          };

          // Main replacement logic
          const newState = (() => {
            try {
              let tempContent = tempState.currentDraft.content;
              let success = false;

              // 1. Try exact match first
              if (tempContent.includes(original)) {
                tempContent = tempContent.replace(original, improved);
                success = true;
              }
              // 2. Try with regex match
              else {
                const escapedOriginal = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const originalRegex = new RegExp(
                  `(${escapedOriginal}|${escapedOriginal.replace(/\s+/g, '\\s+')})`,
                  'gi'
                );

                const tempUpdatedContent = tempContent.replace(originalRegex, improved);
                if (tempUpdatedContent !== tempContent) {
                  tempContent = tempUpdatedContent;
                  success = true;
                }
                // 3. Try fuzzy matching
                else {
                  const fuzzyResult = tryFuzzyMatching(tempContent, original, improved);
                  if (fuzzyResult !== false) {
                    tempContent = fuzzyResult;
                    success = true;
                  }
                  // 4. Last resort: chunk-based replacement
                  else {
                    const chunkResult = tryChunkReplacement(tempContent, original, improved);
                    if (chunkResult !== false) {
                      tempContent = chunkResult;
                      success = true;
                    }
                  }
                }
              }

              // Return the updated state with modified content
              if (success) {
                appliedCount++;
                return {
                  ...tempState,
                  currentDraft: {
                    ...tempState.currentDraft,
                    content: tempContent
                  }
                };
              }

              return tempState;
            } catch (error) {
              console.error('Error in batch suggestion processing:', error);
              return tempState;
            }
          })();

          // Update the working content for the next suggestion
          updatedContent = newState.currentDraft.content;
        }

        console.log(`Applied ${appliedCount} of ${suggestionsToApply.length} suggestions`);

        // Update content and word count
        const text = updatedContent.replace(/<[^>]*>/g, ' ');
        const words = text.split(/\s+/).filter(word => word.length > 0);

        return {
          currentDraft: {
            ...state.currentDraft,
            content: updatedContent,
            wordCount: words.length
          },
          isDirty: true
        };
      } catch (error) {
        console.error('Error applying multiple suggestions:', error);
        return state; // Return unchanged state on error
      }
    });
  }
}));

// Initialize by loading drafts
useEditorStore.getState().loadDrafts();
// Start auto-save
useEditorStore.getState().startAutoSave();

// Helper function to get readability level description from Coleman-Liau index
const getReadabilityLevelFromIndex = (index: number): string => {
  if (index < 6) return "Elementary";
  if (index < 10) return "Middle School";
  if (index < 14) return "High School";
  if (index < 18) return "College";
  return "Professional";
};

// Helper function for chunk-based text replacement when other methods fail
const tryChunkReplacement = (content: string, original: string, improved: string): string | false => {
  try {
    // Clean HTML tags for text comparison
    const stripHtml = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const plainOriginal = stripHtml(original);
    const plainImproved = stripHtml(improved);

    // Skip for very short text (too risky)
    if (plainOriginal.length < 8) return false;

    // SPECIAL CASE: Heading matching for Tiptap
    // Check if this is a heading replacement
    const headingMatch = original.match(/<h([1-6])[^>]*>(.*?)<\/h\1>/i);
    if (headingMatch) {
      const headingLevel = headingMatch[1];
      const headingText = stripHtml(headingMatch[0]);

      console.log(`Trying to match heading: "${headingText}" (level ${headingLevel})`);

      // TipTap might store headings with different attributes
      // Try to find headings that contain the same text but might have different attributes
      const possibleHeadingPatterns = [
        // Standard heading tag
        new RegExp(`<h${headingLevel}[^>]*>\\s*${headingText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*</h${headingLevel}>`, 'i'),

        // Heading with any level that contains the text
        new RegExp(`<h[1-6][^>]*>\\s*${headingText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*</h[1-6]>`, 'i'),

        // TipTap might use data attributes or other structures
        new RegExp(`<[^>]*?data-type=['"]heading['"][^>]*?>${headingText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<`, 'i'),

        // Plain text search as fallback
        new RegExp(`>${headingText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<`, 'i')
      ];

      for (const pattern of possibleHeadingPatterns) {
        const match = content.match(pattern);
        if (match) {
          console.log('Found heading match:', match[0]);

          // Extract the tag structure to preserve attributes
          const openingTagMatch = match[0].match(/<[^>]*>/);
          const closingTagMatch = match[0].match(/<\/[^>]*>$/);

          const openingTag = openingTagMatch ? openingTagMatch[0] : `<h${headingLevel}>`;
          const closingTag = closingTagMatch ? closingTagMatch[0] : `</h${headingLevel}>`;

          // Create the improved heading with preserved tag structure
          const improvedText = stripHtml(improved);
          const replacementHeading = `${openingTag}${improvedText}${closingTag}`;

          // Replace just this heading
          return content.replace(match[0], replacementHeading);
        }
      }
    }

    // For non-heading content or if heading match failed

    // Extract key phrases from the beginning and end of the original
    const originalWords = plainOriginal.split(/\s+/);
    const firstPhrase = originalWords.slice(0, Math.min(3, originalWords.length)).join(' ');
    const lastPhrase = originalWords.slice(Math.max(0, originalWords.length - 3)).join(' ');

    // If we have enough text to work with
    if (firstPhrase.length > 5 && lastPhrase.length > 5) {
      try {
        // Try to find the text between the first and last phrases
        const escapedFirst = firstPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escapedLast = lastPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Look for the content between paragraph/block-level tags
        const blockLevelTags = ['p', 'div', 'li', 'blockquote', 'section', 'article'];

        for (const tag of blockLevelTags) {
          const blockPattern = new RegExp(`(<${tag}[^>]*>[\\s\\S]*?${escapedFirst}[\\s\\S]*?${escapedLast}[\\s\\S]*?</${tag}>)`, 'i');
          const blockMatch = content.match(blockPattern);

          if (blockMatch) {
            const matchedBlock = blockMatch[1];
            const tagMatch = matchedBlock.match(new RegExp(`<${tag}[^>]*>`, 'i'));
            const closingTag = `</${tag}>`;

            if (tagMatch) {
              // Preserve the opening tag structure
              const openingTag = tagMatch[0];
              // Create a replacement with the same tag structure
              const replacement = `${openingTag}${plainImproved}${closingTag}`;
              return content.replace(matchedBlock, replacement);
            }
          }
        }

        // Simpler pattern as fallback
        const contentPattern = new RegExp(`([^>]*${escapedFirst}[\\s\\S]{0,500}?${escapedLast}[^<]*)`, 'i');
        const contentMatch = content.match(contentPattern);

        if (contentMatch) {
          return content.replace(contentMatch[1], plainImproved);
        }
      } catch (e) {
        console.error('Error in chunk replacement regex:', e);
      }
    }

    // Last resort: word overlap detection
    try {
      // Extract meaningful words (longer than 4 chars)
      const meaningfulWords = plainOriginal
        .split(/\s+/)
        .filter(word => word.length > 4)
        .map(word => word.toLowerCase());

      if (meaningfulWords.length > 1) {
        // Look for paragraphs containing at least 2 of these words
        const paragraphElements = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote'];
        const paragraphRegex = new RegExp(`<(${paragraphElements.join('|')})[^>]*>(.*?)<\\/\\1>`, 'gi');
        const paragraphs = [...content.matchAll(paragraphRegex)];

        let bestParagraph = null;
        let bestMatchCount = 1; // Require at least 2 matching words

        for (const paragraph of paragraphs) {
          const fullMatch = paragraph[0];
          const innerContent = paragraph[2];
          const plainText = stripHtml(innerContent).toLowerCase();

          let matchCount = 0;
          for (const word of meaningfulWords) {
            if (plainText.includes(word)) matchCount++;
          }

          if (matchCount > bestMatchCount) {
            bestMatchCount = matchCount;
            bestParagraph = fullMatch;
          }
        }

        if (bestParagraph) {
          // Extract tag structure
          const tagMatch = bestParagraph.match(/<([a-z0-9]+)[^>]*>/i);
          if (tagMatch) {
            const tagName = tagMatch[1];
            const openingTagMatch = bestParagraph.match(new RegExp(`<${tagName}[^>]*>`, 'i'));
            const openingTag = openingTagMatch ? openingTagMatch[0] : `<${tagName}>`;
            const closingTag = `</${tagName}>`;

            // Create replacement with preserved tag structure
            const replacement = `${openingTag}${plainImproved}${closingTag}`;
            return content.replace(bestParagraph, replacement);
          }
        }
      }
    } catch (e) {
      console.error('Error in word overlap detection:', e);
    }

    return false;
  } catch (error) {
    console.error('Error in chunk replacement:', error);
    return false;
  }
}; 