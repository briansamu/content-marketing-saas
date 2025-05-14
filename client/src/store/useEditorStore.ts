import { create } from 'zustand';

// Types
export interface ContentDraft {
  id?: string;
  title: string;
  content: string;
  wordCount: number;
  lastSaved: string;
  status: 'draft' | 'published' | 'archived';
}

interface EditorState {
  currentDraft: ContentDraft;
  savedDrafts: ContentDraft[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  isDirty: boolean;

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

export const useEditorStore = create<EditorState>((set, get) => ({
  currentDraft: {
    title: '',
    content: '',
    wordCount: 0,
    lastSaved: new Date().toISOString(),
    status: 'draft',
  },
  savedDrafts: [],
  isLoading: false,
  isSaving: false,
  error: null,
  isDirty: false,

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

  saveDraft: async () => {
    const { currentDraft } = get();

    set({ isSaving: true, error: null });

    try {
      // Generate unique ID if it doesn't exist
      const draftToSave: ContentDraft = {
        ...currentDraft,
        id: currentDraft.id || `draft-${Date.now()}`,
        lastSaved: new Date().toISOString()
      };

      // Store in localStorage (temporary solution until backend is ready)
      const existingDrafts = getLocalDrafts();
      const updatedDrafts = draftToSave.id && existingDrafts.some(d => d.id === draftToSave.id)
        ? existingDrafts.map(d => d.id === draftToSave.id ? draftToSave : d)
        : [...existingDrafts, draftToSave];

      saveLocalDrafts(updatedDrafts);

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      set({
        currentDraft: draftToSave,
        savedDrafts: updatedDrafts,
        isSaving: false,
        isDirty: false
      });

      // FUTURE INTEGRATION: Uncomment when backend is ready
      /*
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${API_BASE_URL}/api/content/drafts`, {
        method: draftToSave.id ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(draftToSave),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to save draft');
      }
      
      set({
        currentDraft: data.draft,
        savedDrafts: data.allDrafts,
        isSaving: false,
        isDirty: false
      });
      */

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
      // Load from localStorage (temporary solution until backend is ready)
      const drafts = getLocalDrafts();

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      set({
        savedDrafts: drafts,
        isLoading: false
      });

      // FUTURE INTEGRATION: Uncomment when backend is ready
      /*
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${API_BASE_URL}/api/content/drafts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to load drafts');
      }

      set({
        savedDrafts: data.drafts,
        isLoading: false
      });
      */

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
      // Load from localStorage (temporary solution until backend is ready)
      const drafts = getLocalDrafts();
      const draft = drafts.find(d => d.id === draftId);

      if (!draft) {
        throw new Error('Draft not found');
      }

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      set({
        currentDraft: draft,
        isLoading: false,
        isDirty: false
      });

      // FUTURE INTEGRATION: Uncomment when backend is ready
      /*
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${API_BASE_URL}/api/content/drafts/${draftId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to load draft');
      }

      set({
        currentDraft: data.draft,
        isLoading: false,
        isDirty: false
      });
      */

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
      // Delete from localStorage (temporary solution until backend is ready)
      const existingDrafts = getLocalDrafts();
      const updatedDrafts = existingDrafts.filter(d => d.id !== draftId);

      // Check if we're deleting the current draft
      const { currentDraft } = get();
      const isCurrentDraft = currentDraft.id === draftId;

      saveLocalDrafts(updatedDrafts);

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      set(state => ({
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
          },
          isDirty: false
        })
      }));

      // FUTURE INTEGRATION: Uncomment when backend is ready
      /*
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${API_BASE_URL}/api/content/drafts/${draftId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete draft');
      }

      // If we're deleting the current draft, clear it
      if (isCurrentDraft) {
        set({
          currentDraft: {
            title: '',
            content: '',
            wordCount: 0,
            lastSaved: new Date().toISOString(),
            status: 'draft',
          },
          isDirty: false,
          isLoading: false,
          savedDrafts: updatedDrafts
        });
      } else {
        set({
          savedDrafts: updatedDrafts,
          isLoading: false
        });
      }
      */

    } catch (error) {
      console.error('Delete draft error:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to delete draft. Please try again.'
      });
    }
  }
}));

// Initialize by loading drafts
useEditorStore.getState().loadDrafts(); 