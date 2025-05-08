import './App.css'
import Login from './pages/Login/Login'
import { ThemeProvider } from './components/theme-provider'
import { BrowserRouter, Route, Routes, Navigate, useLocation } from 'react-router'
import Dashboard from './pages/Dashboard/Dashboard'
import { Provider } from 'react-redux'
import { store } from './store'
import { useEffect, ReactNode } from 'react'
import { useAppDispatch, useAppSelector } from './store/hooks'
import { fetchCurrentUser } from './store/slices/authSlice'

// Protected route component
const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isLoading } = useAppSelector(state => state.auth);
  const location = useLocation();
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(fetchCurrentUser());
  }, [dispatch]);

  if (isLoading) {
    // You could return a loading spinner here
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!isAuthenticated) {
    // Redirect to login page with return URL
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

// App component that wraps everything with Redux
function App() {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
}

// Separate component to use Redux hooks
function AppContent() {
  const dispatch = useAppDispatch();

  // Check for user authentication when app loads
  useEffect(() => {
    if (localStorage.getItem('token')) {
      dispatch(fetchCurrentUser());
    }
  }, [dispatch]);

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
