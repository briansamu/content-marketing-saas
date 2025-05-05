import './App.css'
import Login from './pages/Login/Login'
import { ThemeProvider } from './components/theme-provider'
import { BrowserRouter, Route, Routes, Navigate } from 'react-router'
import Dashboard from './pages/Dashboard/Dashboard'

function App() {

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
