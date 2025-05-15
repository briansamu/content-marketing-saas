// Central export file for all Zustand stores

import { useAuthStore } from './useAuthStore';
import { useEditorStore } from './useEditorStore';

// Export stores
export { useAuthStore, useEditorStore };

// For TypeScript compatibility with existing code
// These types are deprecated and should be removed when all components are migrated
export type RootState = {
  auth: ReturnType<typeof useAuthStore.getState>;
  editor: ReturnType<typeof useEditorStore.getState>;
};

export type AppDispatch = () => void; 