import { ContentDraft } from '../store/slices/editorSlice';

// API URL from environment variable with fallback
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

/**
 * Content API Service
 * 
 * This service handles all content-related API calls.
 * Currently using localStorage as a temporary storage solution
 * until the backend is ready.
 * 
 * FUTURE INTEGRATION: Replace localStorage operations with actual API calls
 */
export const contentService = {
  /**
   * Save a content draft
   */
  saveDraft: async (draft: ContentDraft): Promise<ContentDraft> => {
    // FUTURE INTEGRATION: Replace with actual API call
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Authentication required');
    }

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Return mock response
    return {
      ...draft,
      id: draft.id || `draft-${Date.now()}`,
      lastSaved: new Date().toISOString()
    };
  },

  /**
   * Get all drafts for the current user
   */
  getDrafts: async (): Promise<ContentDraft[]> => {
    // FUTURE INTEGRATION: Replace with actual API call
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Authentication required');
    }

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Return mock response
    return [];
  },

  /**
   * Get a specific draft by ID
   */
  getDraft: async (id: string): Promise<ContentDraft> => {
    // FUTURE INTEGRATION: Replace with actual API call
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Authentication required');
    }

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Return mock response
    throw new Error('Draft not found');
  },

  /**
   * Delete a draft
   */
  deleteDraft: async (id: string): Promise<void> => {
    // FUTURE INTEGRATION: Replace with actual API call
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Authentication required');
    }

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
  },

  /**
   * Publish a draft
   */
  publishDraft: async (id: string): Promise<ContentDraft> => {
    // FUTURE INTEGRATION: Replace with actual API call
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Authentication required');
    }

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Return mock response
    throw new Error('Draft not found');
  }
};

export default contentService; 