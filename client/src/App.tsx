import './App.css'
import Login from './pages/Login/Login'
import Register from './pages/Register/Register'
import { ThemeProvider } from './components/theme-provider'
import { BrowserRouter, Route, Routes, Navigate, useLocation } from 'react-router'
import { Provider } from 'react-redux'
import { store } from './store'
import { useEffect, ReactNode } from 'react'
import { useAppDispatch, useAppSelector } from './store/hooks'
import { fetchCurrentUser } from './store/slices/authSlice'
import DashboardLayout from './pages/Dashboard/DashboardLayout'
import DashboardOverview from './pages/Dashboard/DashboardOverview'

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
          <Route path="/" element={<Navigate to="/dashboard/overview" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard/overview" replace />} />
            <Route path="overview" element={<DashboardOverview />} />
            {/* Add other dashboard routes here, like: */}
            {/* <Route path="strategy" element={<DashboardStrategy />} /> */}
            {/* <Route path="creation" element={<DashboardCreation />} /> */}
            {/* <Route path="analytics" element={<DashboardAnalytics />} /> */}
            {/* etc. */}
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;