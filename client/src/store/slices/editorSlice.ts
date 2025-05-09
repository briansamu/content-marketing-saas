import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

// API URL from environment variable with fallback
// const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// Types
export interface ContentDraft {
  id?: string;
  title: string;
  content: string;
  wordCount: number;
  lastSaved: string;
  status: 'draft' | 'published' | 'archived';
}

export interface EditorState {
  currentDraft: ContentDraft;
  savedDrafts: ContentDraft[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  isDirty: boolean;
}

// Initial state
const initialState: EditorState = {
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
};

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

// Async thunks
export const saveDraft = createAsyncThunk(
  'editor/saveDraft',
  async (draft: ContentDraft, { rejectWithValue }) => {
    try {
      // Generate unique ID if it doesn't exist
      const draftToSave: ContentDraft = {
        ...draft,
        id: draft.id || `draft-${Date.now()}`,
        lastSaved: new Date().toISOString()
      };

      // Store in localStorage (temporary solution until backend is ready)
      const existingDrafts = getLocalDrafts();
      const updatedDrafts = draft.id
        ? existingDrafts.map(d => d.id === draft.id ? draftToSave : d)
        : [...existingDrafts, draftToSave];

      saveLocalDrafts(updatedDrafts);

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Return the saved draft
      return {
        draft: draftToSave,
        allDrafts: updatedDrafts
      };

      // FUTURE INTEGRATION: Uncomment when backend is ready
      /*
      const token = localStorage.getItem('token');
      if (!token) {
        return rejectWithValue('Authentication required');
      }

      const response = await fetch(`${API_BASE_URL}/api/content/drafts`, {
        method: draft.id ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(draftToSave),
      });

      const data = await response.json();

      if (!response.ok) {
        return rejectWithValue(data.message || 'Failed to save draft');
      }

      return data;
      */
    } catch (error) {
      console.error('Save draft error:', error);
      return rejectWithValue('Failed to save draft. Please try again.');
    }
  }
);

export const loadDrafts = createAsyncThunk(
  'editor/loadDrafts',
  async (_, { rejectWithValue }) => {
    try {
      // Load from localStorage (temporary solution until backend is ready)
      const drafts = getLocalDrafts();

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      return { drafts };

      // FUTURE INTEGRATION: Uncomment when backend is ready
      /*
      const token = localStorage.getItem('token');
      if (!token) {
        return rejectWithValue('Authentication required');
      }

      const response = await fetch(`${API_BASE_URL}/api/content/drafts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return rejectWithValue(data.message || 'Failed to load drafts');
      }

      return data;
      */
    } catch (error) {
      console.error('Load drafts error:', error);
      return rejectWithValue('Failed to load drafts. Please try again.');
    }
  }
);

export const loadDraft = createAsyncThunk(
  'editor/loadDraft',
  async (draftId: string, { rejectWithValue }) => {
    try {
      // Load from localStorage (temporary solution until backend is ready)
      const drafts = getLocalDrafts();
      const draft = drafts.find(d => d.id === draftId);

      if (!draft) {
        return rejectWithValue('Draft not found');
      }

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      return { draft };

      // FUTURE INTEGRATION: Uncomment when backend is ready
      /*
      const token = localStorage.getItem('token');
      if (!token) {
        return rejectWithValue('Authentication required');
      }

      const response = await fetch(`${API_BASE_URL}/api/content/drafts/${draftId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return rejectWithValue(data.message || 'Failed to load draft');
      }

      return data;
      */
    } catch (error) {
      console.error('Load draft error:', error);
      return rejectWithValue('Failed to load draft. Please try again.');
    }
  }
);

export const deleteDraft = createAsyncThunk(
  'editor/deleteDraft',
  async (draftId: string, { rejectWithValue }) => {
    try {
      // Delete from localStorage (temporary solution until backend is ready)
      const existingDrafts = getLocalDrafts();
      const updatedDrafts = existingDrafts.filter(d => d.id !== draftId);

      // If we're deleting the current draft, return the ID so we can clear it
      const wasCurrentDraft = existingDrafts.find(d => d.id === draftId);

      saveLocalDrafts(updatedDrafts);

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      return {
        updatedDrafts,
        deletedDraftId: draftId,
        wasCurrentDraft: Boolean(wasCurrentDraft)
      };

      // FUTURE INTEGRATION: Uncomment when backend is ready
      /*
      const token = localStorage.getItem('token');
      if (!token) {
        return rejectWithValue('Authentication required');
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
        return rejectWithValue(data.message || 'Failed to delete draft');
      }

      return { 
        deletedDraftId: draftId,
        wasCurrentDraft
      };
      */
    } catch (error) {
      console.error('Delete draft error:', error);
      return rejectWithValue('Failed to delete draft. Please try again.');
    }
  }
);

// Slice
const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    updateContent: (state, action: PayloadAction<string>) => {
      state.currentDraft.content = action.payload;
      // Calculate word count
      const text = action.payload.replace(/<[^>]*>/g, ' ');
      const words = text.split(/\s+/).filter(word => word.length > 0);
      state.currentDraft.wordCount = words.length;
      state.isDirty = true;
    },
    updateTitle: (state, action: PayloadAction<string>) => {
      state.currentDraft.title = action.payload;
      state.isDirty = true;
    },
    newDraft: (state) => {
      state.currentDraft = {
        title: '',
        content: '',
        wordCount: 0,
        lastSaved: new Date().toISOString(),
        status: 'draft',
      };
      state.isDirty = false;
    },
    setDraftStatus: (state, action: PayloadAction<'draft' | 'published' | 'archived'>) => {
      state.currentDraft.status = action.payload;
      state.isDirty = true;
    },
    clearEditorError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Save draft
    builder.addCase(saveDraft.pending, (state) => {
      state.isSaving = true;
      state.error = null;
    });
    builder.addCase(saveDraft.fulfilled, (state, action) => {
      state.isSaving = false;
      state.currentDraft = action.payload.draft;
      state.savedDrafts = action.payload.allDrafts;
      state.isDirty = false;
    });
    builder.addCase(saveDraft.rejected, (state, action) => {
      state.isSaving = false;
      state.error = action.payload as string;
    });

    // Load drafts
    builder.addCase(loadDrafts.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(loadDrafts.fulfilled, (state, action) => {
      state.isLoading = false;
      state.savedDrafts = action.payload.drafts;
    });
    builder.addCase(loadDrafts.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });

    // Load draft
    builder.addCase(loadDraft.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(loadDraft.fulfilled, (state, action) => {
      state.isLoading = false;
      state.currentDraft = action.payload.draft;
      state.isDirty = false;
    });
    builder.addCase(loadDraft.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });

    // Delete draft
    builder.addCase(deleteDraft.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(deleteDraft.fulfilled, (state, action) => {
      state.isLoading = false;
      state.savedDrafts = action.payload.updatedDrafts;

      // If the deleted draft was the current draft, reset to a new draft
      if (action.payload.wasCurrentDraft) {
        state.currentDraft = {
          title: '',
          content: '',
          wordCount: 0,
          lastSaved: new Date().toISOString(),
          status: 'draft',
        };
        state.isDirty = false;
      }
    });
    builder.addCase(deleteDraft.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
  },
});

export const { updateContent, updateTitle, newDraft, setDraftStatus, clearEditorError } = editorSlice.actions;
export default editorSlice.reducer; 