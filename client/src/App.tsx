import './App.css'
import Login from './pages/Login/Login'
import Register from './pages/Register/Register'
import { ThemeProvider } from './components/theme-provider'
import { BrowserRouter, Route, Routes, Navigate, useLocation } from 'react-router'
import { useEffect, ReactNode } from 'react'
import { useAuthStore } from './store/useAuthStore'
import AppLayout from './pages/App/AppLayout'
import DashboardOverview from './pages/Dashboard/DashboardOverview'
import NotFound from './pages/NotFound'
import ContentHubPage from './pages/ContentHub/ContentHubPage'
import { TooltipProvider } from './components/ui/tooltip'

// Protected route component
const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isLoading, fetchCurrentUser } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

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

// App component
function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/app/dashboard/overview" />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected app routes */}
            <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              {/* Dashboard */}
              <Route path="dashboard" element={<Navigate to="/app/dashboard/overview" replace />} />
              <Route path="dashboard/overview" element={<DashboardOverview />} />

              {/* Content Creation Hub */}
              <Route path="content" element={<Navigate to="/app/content/editor" replace />} />
              <Route path="content/editor" element={<ContentHubPage />} />

              {/* Other sections will follow the same pattern */}
              {/* <Route path="strategy/*" element={<StrategyRoutes />} /> */}
              {/* <Route path="creation/*" element={<CreationRoutes />} /> */}
              {/* <Route path="analytics/*" element={<AnalyticsRoutes />} /> */}
              {/* <Route path="tools/*" element={<ToolsRoutes />} /> */}
              {/* <Route path="settings/*" element={<SettingsRoutes />} /> */}
              {/* <Route path="support" element={<Support />} /> */}
              {/* <Route path="feedback" element={<Feedback />} /> */}

              {/* Catch-all route for non-existent app pages */}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  );
}

// Check for user authentication when app loads
if (localStorage.getItem('token')) {
  useAuthStore.getState().fetchCurrentUser();
}

export default App;