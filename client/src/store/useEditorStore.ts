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
  clearTextSummary: () => void;
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
  }
}));

// Initialize by loading drafts
useEditorStore.getState().loadDrafts();
// Start auto-save
useEditorStore.getState().startAutoSave(); 