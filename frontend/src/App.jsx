import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import socket from './services/socket'

// Joe's existing components (protected app)
import Layout from './components/Layout'
import ToastContainer from './components/Toast'
import Login from './pages/Login'
import Register from './pages/Register'
import LabDashboard from './pages/LabDashboard'
import MyDashboard from './pages/MyDashboard'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Settings from './pages/Settings'
import Admin from './pages/Admin'
import Chat from './pages/Chat'
import Apply from './pages/Apply'
import AccessRevoked from './pages/AccessRevoked'

// Jared's public site components
import PublicLayout from './components/public/layout/PublicLayout'
import HomePage from './components/public/pages/HomePage'
import AboutPage from './components/public/pages/AboutPage'
import PublicProjectsPage from './components/public/pages/PublicProjectsPage'
import TeamPage from './components/public/pages/TeamPage'
import BlogPage from './components/public/pages/BlogPage'
import ContactPage from './components/public/pages/ContactPage'
import DonatePage from './components/public/pages/DonatePage'

function ProtectedRoute({ children }) {
  const { token, user, isLoading } = useAuthStore()

  useEffect(() => {
    if (token && user) socket.connect(token)
    else socket.disconnect()
    return () => socket.disconnect()
  }, [token, user])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-4 border-primary-100"></div>
            <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-text-secondary font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  if (!token) return <Navigate to="/login" replace />
  return children
}

function AdminRoute({ children }) {
  const { user } = useAuthStore()
  if (user?.role !== 'admin') return <Navigate to="/" replace />
  return children
}

function App() {
  return (
    <BrowserRouter>
      <ToastContainer />
      <Routes>
        {/* Public Routes - Jared's public-facing pages */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/projects" element={<PublicProjectsPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/donate" element={<DonatePage />} />
        </Route>

        {/* Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/apply" element={<Apply />} />
        <Route path="/access-revoked" element={<AccessRevoked />} />

        {/* Protected Routes - Joe's app */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<LabDashboard />} />
          <Route path="my-dashboard" element={<MyDashboard />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="settings" element={<Settings />} />
          <Route path="chat" element={<Chat />} />
          <Route path="chat/:roomId" element={<Chat />} />
          <Route path="admin" element={<AdminRoute><Admin /></AdminRoute>} />
        </Route>

        {/* Redirect old root to dashboard for logged-in users - optional fallback */}
        <Route path="/app" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
