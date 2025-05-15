import { create } from 'zustand';

// API URL from environment variable with fallback
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  company_id?: number;
  avatar?: string;
  first_name?: string;
  last_name?: string;
  company?: {
    name: string;
    [key: string]: unknown;
  };
}

interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
  company_name?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
  register: (userData: RegisterCredentials) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  updateUserAvatar: (avatarUrl: string) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        set({ isLoading: false, error: data.message || 'Login failed' });
        return;
      }

      // Store token in localStorage
      localStorage.setItem('token', data.data.token);

      set({ isLoading: false });

      // Fetch current user data
      const { fetchCurrentUser } = useAuthStore.getState();
      await fetchCurrentUser();

    } catch (error) {
      set({ isLoading: false, error: 'Network error. Please try again.' });
    }
  },

  fetchCurrentUser: async () => {
    const token = localStorage.getItem('token');

    if (!token) {
      set({
        user: null,
        isAuthenticated: false,
        error: 'No token found'
      });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      const data = await response.json();

      if (!response.ok) {
        // If token is invalid, clear it
        if (response.status === 401) {
          localStorage.removeItem('token');
        }

        set({
          isLoading: false,
          error: data.message || 'Failed to get user data',
          user: null,
          isAuthenticated: false
        });
        return;
      }

      // Format user data to match our interface
      const formattedUser: User = {
        id: data.user.id,
        name: `${data.user.first_name} ${data.user.last_name}`,
        email: data.user.email,
        role: data.user.role,
        company_id: data.user.company_id,
        avatar: data.user.avatar,
        first_name: data.user.first_name,
        last_name: data.user.last_name,
        company: data.user.company,
      };

      set({
        user: formattedUser,
        isAuthenticated: true,
        isLoading: false
      });

    } catch (error) {
      set({
        isLoading: false,
        error: 'Network error. Please try again.',
        user: null,
        isAuthenticated: false
      });
    }
  },

  register: async (userData) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (!response.ok) {
        set({ isLoading: false, error: data.message || 'Registration failed' });
        return;
      }

      set({ isLoading: false });
      // Registration successful, but user still needs to login

    } catch (error) {
      set({ isLoading: false, error: 'Network error. Please try again.' });
    }
  },

  uploadAvatar: async (file) => {
    const token = localStorage.getItem('token');

    if (!token) {
      set({ error: 'Authentication required' });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch(`${API_BASE_URL}/api/users/avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        set({ isLoading: false, error: data.message || 'Failed to upload avatar' });
        return;
      }

      set(state => ({
        isLoading: false,
        user: state.user ? { ...state.user, avatar: data.avatarUrl } : null
      }));

    } catch (error) {
      set({ isLoading: false, error: 'Network error. Please try again.' });
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({
      user: null,
      isAuthenticated: false,
      error: null
    });
  },

  clearError: () => {
    set({ error: null });
  },

  updateUserAvatar: (avatarUrl) => {
    set(state => ({
      user: state.user ? { ...state.user, avatar: avatarUrl } : null
    }));
  }
}));

// Initialize by loading user data if a token exists
if (localStorage.getItem('token')) {
  useAuthStore.getState().fetchCurrentUser();
} 