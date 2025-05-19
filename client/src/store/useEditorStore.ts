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
  contentType: 'social' | 'blog' | 'video' | 'article' | string;
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
  setContentType: (contentType: string) => void;
  clearCurrentDraftFromStorage: () => void;
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

// Helper function to get current draft from localStorage
const getCurrentDraftFromStorage = (): ContentDraft | null => {
  const currentDraftJson = localStorage.getItem('current_draft');
  if (currentDraftJson) {
    try {
      return JSON.parse(currentDraftJson);
    } catch (e) {
      console.error('Failed to parse current draft from localStorage', e);
    }
  }
  return null;
};

// Helper function to save current draft to localStorage
const saveCurrentDraftToStorage = (draft: ContentDraft) => {
  localStorage.setItem('current_draft', JSON.stringify(draft));
};

// API base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// Get the default current draft - either from localStorage or a new empty one
const getDefaultCurrentDraft = (): ContentDraft => {
  const storedDraft = getCurrentDraftFromStorage();

  if (storedDraft) {
    return storedDraft;
  }

  return {
    title: '',
    content: '',
    wordCount: 0,
    lastSaved: new Date().toISOString(),
    status: 'draft' as const,
    storageLocation: 'local' as const,
    contentType: 'social'
  };
};

export const useEditorStore = create<EditorState>((set, get) => ({
  currentDraft: getDefaultCurrentDraft(),
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

      const updatedDraft = {
        ...state.currentDraft,
        content,
        wordCount: words.length
      };

      // Save to localStorage for persistence across refreshes
      saveCurrentDraftToStorage(updatedDraft);

      return {
        currentDraft: updatedDraft,
        isDirty: true
      };
    });
  },

  updateTitle: (title) => {
    set(state => {
      const updatedDraft = {
        ...state.currentDraft,
        title
      };

      // Save to localStorage for persistence across refreshes
      saveCurrentDraftToStorage(updatedDraft);

      return {
        currentDraft: updatedDraft,
        isDirty: true
      };
    });
  },

  setContentType: (contentType) => {
    set(state => {
      const updatedDraft = {
        ...state.currentDraft,
        contentType
      };

      // Save to localStorage for persistence across refreshes
      saveCurrentDraftToStorage(updatedDraft);

      return {
        currentDraft: updatedDraft,
        isDirty: true
      };
    });
  },

  newDraft: () => {
    const newEmptyDraft: ContentDraft = {
      title: '',
      content: '',
      wordCount: 0,
      lastSaved: new Date().toISOString(),
      status: 'draft',
      storageLocation: 'local',
      contentType: 'social'
    };

    // Save to localStorage
    saveCurrentDraftToStorage(newEmptyDraft);

    set({
      currentDraft: newEmptyDraft,
      isDirty: false
    });
  },

  setDraftStatus: (status) => {
    set(state => {
      const updatedDraft = {
        ...state.currentDraft,
        status
      };

      // Save to localStorage for persistence
      saveCurrentDraftToStorage(updatedDraft);

      return {
        currentDraft: updatedDraft,
        isDirty: true
      };
    });
  },

  clearEditorError: () => {
    set({ error: null });
  },

  // Function to explicitly clear the current draft from localStorage
  clearCurrentDraftFromStorage: () => {
    localStorage.removeItem('current_draft');
    set({
      currentDraft: {
        title: '',
        content: '',
        wordCount: 0,
        lastSaved: new Date().toISOString(),
        status: 'draft',
        storageLocation: 'local',
        contentType: 'social'
      },
      isDirty: false
    });
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

      // Save the current draft to localStorage for persistence across refreshes
      saveCurrentDraftToStorage(draftToSave);

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

      // Always save the draft to localStorage when loaded, even if no changes are made
      // This ensures that when the user refreshes, we can recover the last opened draft
      saveCurrentDraftToStorage(draftData);

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
            storageLocation: 'local',
            contentType: 'social'
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
        // If suggestions is already an array of objects with the right structure, use it directly
        let processedSuggestions = data.suggestions;

        // If suggestions is a JSON string, try to parse it
        if (typeof data.suggestions === 'string' && data.suggestions.trim().startsWith('[')) {
          try {
            const parsedSuggestions = JSON.parse(data.suggestions);
            if (Array.isArray(parsedSuggestions)) {
              processedSuggestions = parsedSuggestions;
              console.log('Successfully parsed JSON string suggestions');
            }
          } catch (parseError) {
            console.error('Error parsing suggestions JSON string:', parseError);
            // Keep using original data.suggestions if parsing fails
          }
        }

        // If rawSuggestions contains valid JSON, try to extract suggestions
        if (typeof data.rawSuggestions === 'string' && data.suggestions.length === 0) {
          try {
            // Look for JSON array in the raw response
            const jsonMatch = data.rawSuggestions.match(/\[\s*\{[\s\S]*\}\s*\]/);
            if (jsonMatch) {
              const extractedJson = JSON.parse(jsonMatch[0]);
              if (Array.isArray(extractedJson) && extractedJson.length > 0) {
                processedSuggestions = extractedJson;
                console.log('Successfully extracted suggestions from raw response');
              }
            }
          } catch (extractError) {
            console.error('Error extracting suggestions from raw response:', extractError);
            // Continue with original data if extraction fails
          }
        }

        set({
          contentRewrites: {
            suggestions: processedSuggestions,
            rawSuggestions: data.rawSuggestions,
            insights: data.insights,
            isLoading: false
          }
        });

        console.log(`Received ${processedSuggestions.length} rewrite suggestions`);
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

      // Process suggestions from rewriteData similar to suggestContentRewrites method
      let processedSuggestions = rewriteData.suggestions;

      // If suggestions is a JSON string, try to parse it
      if (typeof rewriteData.suggestions === 'string' && rewriteData.suggestions.trim().startsWith('[')) {
        try {
          const parsedSuggestions = JSON.parse(rewriteData.suggestions);
          if (Array.isArray(parsedSuggestions)) {
            processedSuggestions = parsedSuggestions;
            console.log('Successfully parsed JSON string suggestions in optimizeContent');
          }
        } catch (parseError) {
          console.error('Error parsing suggestions JSON string in optimizeContent:', parseError);
          // Keep using original rewriteData.suggestions if parsing fails
        }
      }

      // If rawSuggestions contains valid JSON, try to extract suggestions
      if (typeof rewriteData.rawSuggestions === 'string' && rewriteData.suggestions.length === 0) {
        try {
          // Look for JSON array in the raw response
          const jsonMatch = rewriteData.rawSuggestions.match(/\[\s*\{[\s\S]*\}\s*\]/);
          if (jsonMatch) {
            const extractedJson = JSON.parse(jsonMatch[0]);
            if (Array.isArray(extractedJson) && extractedJson.length > 0) {
              processedSuggestions = extractedJson;
              console.log('Successfully extracted suggestions from raw response in optimizeContent');
            }
          }
        } catch (extractError) {
          console.error('Error extracting suggestions from raw response in optimizeContent:', extractError);
          // Continue with original data if extraction fails
        }
      }

      // Update the content rewrite results
      set({
        contentRewrites: {
          suggestions: processedSuggestions,
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

        // Helper function to strip HTML tags
        const stripHtml = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

        // Get plain text versions for matching
        const plainOriginal = stripHtml(original);
        const plainImproved = stripHtml(improved);

        // Helper function for text similarity - defined at the top level so it can be used throughout
        const getTextSimilarity = (text1: string, text2: string): number => {
          // 1. Direct inclusion check
          if (text1.includes(text2) || text2.includes(text1)) {
            return 0.9;
          }

          // 2. First words matching (useful for headings and intro sentences)
          const words1 = text1.split(/\s+/);
          const words2 = text2.split(/\s+/);

          // Check if first 2-3 words match (when content is long enough)
          if (words1.length >= 3 && words2.length >= 3) {
            const firstThreeWords1 = words1.slice(0, 3).join(' ').toLowerCase();
            const firstThreeWords2 = words2.slice(0, 3).join(' ').toLowerCase();

            if (firstThreeWords1 === firstThreeWords2) {
              return 0.85;
            }
          }

          // 3. Key distinctive words matching
          // Extract words longer than 4 chars (likely meaningful)
          const meaningfulWords1 = words1.filter(w => w.length > 4).map(w => w.toLowerCase());
          const meaningfulWords2 = words2.filter(w => w.length > 4).map(w => w.toLowerCase());

          if (meaningfulWords1.length > 0 && meaningfulWords2.length > 0) {
            // Count common words
            const commonWords = meaningfulWords1.filter(w => meaningfulWords2.includes(w));
            const matchRatio = commonWords.length / Math.min(meaningfulWords1.length, meaningfulWords2.length);

            if (matchRatio > 0.5) {
              return 0.7 + (matchRatio * 0.2); // Score between 0.7 and 0.9 based on match ratio
            }
          }

          // 4. Sentence structure similarity (length and punctuation)
          const sentenceStructure1 = text1.replace(/[a-zA-Z0-9]/g, 'x');
          const sentenceStructure2 = text2.replace(/[a-zA-Z0-9]/g, 'x');

          if (sentenceStructure1 === sentenceStructure2) {
            return 0.6;
          }

          return 0;
        };

        // Log the full contents we're trying to replace for debugging
        console.log('Attempting to replace:', {
          originalLength: original.length,
          improvedLength: improved.length,
          currentContentLength: currentContent.length,
          originalText: original.substring(0, 30) + '...',
          improvedText: improved.substring(0, 30) + '...',
          plainOriginalLength: plainOriginal.length,
          plainOriginalText: plainOriginal.substring(0, 30) + '...'
        });

        // DETECT HTML TAG DIFFERENCES: Check if Anthropic changed the HTML tags
        const extractTagInfo = (html: string) => {
          const tagMatches = html.match(/<([a-z0-9]+)[^>]*>/gi) || [];
          return tagMatches.map(tag => tag.match(/<([a-z0-9]+)/i)?.[1] || '').filter(Boolean);
        };

        const originalTags = extractTagInfo(original);
        const improvedTags = extractTagInfo(improved);

        // If tags are different between original and improved, handle specially
        const hasDifferentTags = originalTags.length > 0 &&
          improvedTags.length > 0 &&
          JSON.stringify(originalTags) !== JSON.stringify(improvedTags);

        if (hasDifferentTags) {
          console.log('Detected HTML tag differences between original and improved versions:', {
            originalTags,
            improvedTags
          });

          // For now, we'll proceed with plain text replacement in these cases
          // and preserve the original HTML structure
        }

        // GENERIC CONTENT BLOCK MATCHING - works with any type of content
        if (!success) {
          console.log('Trying generic content block matching');

          // Find all block elements that could contain our content
          const blockElements = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'section', 'article'];
          const blockRegex = new RegExp(`<(${blockElements.join('|')})[^>]*>(.*?)<\\/\\1>`, 'gi');
          const blocks = [...currentContent.matchAll(blockRegex)];

          // Find the best matching block
          let bestMatch = null;
          let bestScore = 0.6; // Threshold for considering a match

          for (const block of blocks) {
            const fullMatch = block[0];
            const tagName = block[1];
            const content = block[2];
            const plainContent = stripHtml(content);

            // Skip very short blocks or blocks with dramatically different lengths
            if (plainContent.length < 5 ||
              plainContent.length < plainOriginal.length * 0.5 ||
              plainContent.length > plainOriginal.length * 2) {
              continue;
            }

            const similarity = getTextSimilarity(plainContent, plainOriginal);

            if (similarity > bestScore) {
              bestScore = similarity;
              bestMatch = { fullMatch, tagName, content, similarity };
            }
          }

          if (bestMatch) {
            console.log(`Found matching content block with ${bestMatch.similarity.toFixed(2)} similarity:`,
              bestMatch.fullMatch.substring(0, 50) + '...');

            // Create replacement preserving the tag structure
            const tagStart = bestMatch.fullMatch.substring(0, bestMatch.fullMatch.indexOf('>') + 1);
            const tagEnd = `</${bestMatch.tagName}>`;

            // Use the improved text for the replacement, but handle potential tag differences
            // If the improved text already contains appropriate HTML tags, use those
            let replacementContent;

            if (hasDifferentTags && improved.trim().startsWith('<') && improved.trim().endsWith('>')) {
              // Extract just the inner content from improved text if it has its own tags
              const innerImproved = improved.replace(/<[^>]*>/g, '').trim();
              replacementContent = `${tagStart}${innerImproved}${tagEnd}`;
            } else {
              // Otherwise use the plain text
              replacementContent = `${tagStart}${plainImproved}${tagEnd}`;
            }

            updatedContent = currentContent.replace(bestMatch.fullMatch, replacementContent);
            success = true;
          }
        }

        // SENTENCE FRAGMENT MATCHING - for cases where the text spans across multiple elements
        if (!success && plainOriginal.length > 15) {
          console.log('Trying sentence fragment matching');

          // Extract a unique fragment from the original (at least 15 chars)
          const fragments = plainOriginal.split(/[.!?]+/);

          for (const fragment of fragments) {
            if (fragment.trim().length >= 15) {
              const cleanFragment = fragment.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

              // Look for this fragment in the HTML content
              const fragmentRegex = new RegExp(`([^>]*${cleanFragment}[^<]*)`, 'i');
              const fragmentMatch = currentContent.match(fragmentRegex);

              if (fragmentMatch) {
                console.log('Found matching sentence fragment:', fragmentMatch[0].substring(0, 30) + '...');

                // Carefully replace just this fragment
                const matchedText = fragmentMatch[0];

                // Find corresponding fragment in the improved text
                const improvedFragments = plainImproved.split(/[.!?]+/);
                let bestImprovedFragment = '';
                let bestFragmentSimilarity = 0;

                for (const improvedFragment of improvedFragments) {
                  const similarity = getTextSimilarity(fragment, improvedFragment.trim());
                  if (similarity > bestFragmentSimilarity) {
                    bestFragmentSimilarity = similarity;
                    bestImprovedFragment = improvedFragment.trim();
                  }
                }

                if (bestImprovedFragment) {
                  updatedContent = currentContent.replace(matchedText, bestImprovedFragment);
                  success = true;
                  break;
                }
              }
            }
          }
        }

        // CONTENT WITH DIFFERENT TAG STRUCTURE
        // For cases where Anthropic completely changed the HTML structure
        if (!success && hasDifferentTags) {
          console.log('Attempting replacement with different tag structures');

          // Try to find elements that contain similar plain text
          const plainTextPattern = new RegExp(`>(\\s*${plainOriginal.substring(0, 30).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^<]*)`, 'i');
          const plainTextMatch = currentContent.match(plainTextPattern);

          if (plainTextMatch) {
            console.log('Found matching plain text within tags:', plainTextMatch[0]);

            // Find the surrounding element
            const startPos = currentContent.lastIndexOf('<', plainTextMatch.index || 0);
            const endPos = currentContent.indexOf('>', (plainTextMatch.index || 0) + plainTextMatch[0].length) + 1;

            if (startPos >= 0 && endPos > startPos) {
              // Find the full element including its closing tag
              const surroundingElement = currentContent.substring(startPos, endPos);
              const tagMatch = surroundingElement.match(/<([a-z0-9]+)[^>]*>/i);

              if (tagMatch) {
                const tagName = tagMatch[1];
                const closeTagPos = currentContent.indexOf(`</${tagName}>`, plainTextMatch.index || 0);

                if (closeTagPos > 0) {
                  const fullElement = currentContent.substring(
                    startPos,
                    closeTagPos + tagName.length + 3
                  );

                  // Replace the inner content but preserve the original tag structure
                  const openTag = fullElement.substring(0, fullElement.indexOf('>') + 1);
                  const closingTag = `</${tagName}>`;
                  const newElement = `${openTag}${plainImproved}${closingTag}`;

                  updatedContent = currentContent.replace(fullElement, newElement);
                  success = true;
                }
              }
            }
          }
        }

        // 1. Try exact match if our advanced matching didn't work
        if (!success && currentContent.includes(original)) {
          updatedContent = currentContent.replace(original, improved);
          success = true;
          console.log('Applied suggestion with exact match');
        }
        // 2. Try with heading tag patterns - keep this for backward compatibility
        else if (!success && (original.includes('<h1') || improved.includes('<h1') ||
          /^<h[1-6][^>]*>.*<\/h[1-6]>$/i.test(original.trim()))) {

          // Special handling for heading tags which often have different formatting
          const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h\1>/gi;
          const originalTextMatch = original.match(/>(.*?)</);
          const originalHeadingText = originalTextMatch ? originalTextMatch[1] : stripHtml(original);

          console.log('Looking for heading with text:', originalHeadingText);

          // Create a pattern that finds headings containing the core text
          const headingMatches = [...currentContent.matchAll(headingRegex)];

          // Also check for TipTap-specific heading formats
          const tiptapHeadingRegex = /<[^>]*?data-type=['"]heading['"][^>]*?>(.*?)<\/[^>]*?>/gi;
          const tiptapHeadingMatches = [...currentContent.matchAll(tiptapHeadingRegex)];

          // Combine all heading matches
          const allHeadingMatches = [...headingMatches, ...tiptapHeadingMatches];

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
              const newHeadingContent = stripHtml(improved);
              const newFullHeading = `${openingTag}${newHeadingContent}${closingTag}`;

              console.log('Creating new heading:', newFullHeading);
              updatedContent = currentContent.replace(fullHeadingTag, newFullHeading);
              success = true;
              break;
            }
          }
        }
        // 3. Try with stripped HTML for generic content
        else if (!success) {
          // Escape special regex characters in the original text
          const escapedOriginal = plainOriginal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

          // Create a regex that can match the text with or without surrounding HTML tags
          // This handles cases where text might be split across multiple nodes
          const originalRegex = new RegExp(
            `(${escapedOriginal}|${escapedOriginal.replace(/\s+/g, '\\s+')})`,
            'gi'
          );

          // Replace the text while preserving HTML structure
          const tempContent = currentContent.replace(originalRegex, plainImproved);

          // Check if replacement actually happened
          if (tempContent !== currentContent) {
            updatedContent = tempContent;
            success = true;
            console.log('Applied suggestion with regex match');
          }
        }

        console.log('Applied suggestion:', { original, improved, success });

        // Only update if we successfully made a replacement
        if (!success) {
          console.warn('Could not find the text to replace in the content');
          return state;
        }

        // Update word count and content
        const text = updatedContent.replace(/<[^>]*>/g, ' ');
        const words = text.split(/\s+/).filter(word => word.length > 0);

        // Save to localStorage for persistence across refreshes
        saveCurrentDraftToStorage({
          ...state.currentDraft,
          content: updatedContent,
          wordCount: words.length
        });

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
          const closingTagMatch = match[0].match(/<\/[^>]*>/);

          const openingTag = openingTagMatch ? openingTagMatch[0] : `<h${headingLevel}>`;
          const closingTag = closingTagMatch ? closingTagMatch[0] : `</h${headingLevel}>`;

          // Create the improved heading with preserved tag structure
          const newHeadingContent = stripHtml(improved);
          const newFullHeading = `${openingTag}${newHeadingContent}${closingTag}`;

          // Replace just this heading
          return content.replace(match[0], newFullHeading);
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