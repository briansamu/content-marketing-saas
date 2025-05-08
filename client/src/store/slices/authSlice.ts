import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  company_id?: number;
  avatar?: string;
  first_name?: string;
  last_name?: string;
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
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue, dispatch }) => {
    try {
      const response = await fetch('http://localhost:8080/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return rejectWithValue(data.message || 'Login failed');
      }

      // Store token in localStorage
      localStorage.setItem('token', data.data.token);

      // Immediately fetch current user after login
      dispatch(fetchCurrentUser());

      return data;
    } catch {
      return rejectWithValue('Network error. Please try again.');
    }
  }
);

export const fetchCurrentUser = createAsyncThunk(
  'auth/fetchCurrentUser',
  async (_, { rejectWithValue }) => {
    const token = localStorage.getItem('token');

    if (!token) {
      return rejectWithValue('No token found');
    }

    try {
      const response = await fetch('http://localhost:8080/api/auth/me', {
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
        return rejectWithValue(data.message || 'Failed to get user data');
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
      };

      return { user: formattedUser };
    } catch {
      return rejectWithValue('Network error. Please try again.');
    }
  }
);

export const register = createAsyncThunk(
  'auth/register',
  async (userData: RegisterCredentials, { rejectWithValue }) => {
    try {
      const response = await fetch('http://localhost:8080/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (!response.ok) {
        return rejectWithValue(data.message || 'Registration failed');
      }

      return data;
    } catch {
      return rejectWithValue('Network error. Please try again.');
    }
  }
);

export const uploadAvatar = createAsyncThunk(
  'auth/uploadAvatar',
  async (file: File, { rejectWithValue }) => {
    const token = localStorage.getItem('token');

    if (!token) {
      return rejectWithValue('Authentication required');
    }

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch('http://localhost:8080/api/users/avatar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        return rejectWithValue(data.message || 'Failed to upload avatar');
      }

      return data;
    } catch {
      return rejectWithValue('Network error. Please try again.');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      localStorage.removeItem('token');
      state.user = null;
      state.isAuthenticated = false;
      state.error = null;
    },
    clearError: (state) => {
      state.error = null;
    },
    updateUserAvatar: (state, action: PayloadAction<string>) => {
      if (state.user) {
        state.user.avatar = action.payload;
      }
    }
  },
  extraReducers: (builder) => {
    // Login
    builder.addCase(login.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(login.fulfilled, (state) => {
      state.isLoading = false;
      // We'll get the user data in the fetchCurrentUser call
    });
    builder.addCase(login.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });

    // Fetch current user
    builder.addCase(fetchCurrentUser.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(fetchCurrentUser.fulfilled, (state, action: PayloadAction<{ user: User }>) => {
      state.isLoading = false;
      state.user = action.payload.user;
      state.isAuthenticated = true;
    });
    builder.addCase(fetchCurrentUser.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
      state.user = null;
      state.isAuthenticated = false;
    });

    // Register
    builder.addCase(register.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(register.fulfilled, (state) => {
      state.isLoading = false;
      // Registration successful, but user still needs to login
    });
    builder.addCase(register.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });

    // Upload avatar
    builder.addCase(uploadAvatar.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(uploadAvatar.fulfilled, (state, action: PayloadAction<{ avatarUrl: string }>) => {
      state.isLoading = false;
      if (state.user) {
        state.user.avatar = action.payload.avatarUrl;
      }
    });
    builder.addCase(uploadAvatar.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
  },
});

export const { logout, clearError, updateUserAvatar } = authSlice.actions;
export default authSlice.reducer; 