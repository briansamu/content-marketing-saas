import './App.css'
import Login from './pages/Login/Login'
import { ThemeProvider } from './components/theme-provider'

function App() {

  return (
    <>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <Login />
      </ThemeProvider>
    </>
  )
}

export default App
