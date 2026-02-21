import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import socket from './services/socket'
import ErrorBoundary from './components/ErrorBoundary'

// Joe's existing components (protected app)
import Layout from './components/Layout'
import ToastContainer from './components/Toast'
import RecommendationButton from './components/RecommendationButton'

// Lazy-loaded pages
const Login = lazy(() => import('./pages/Login'))
const LabDashboard = lazy(() => import('./pages/LabDashboard'))
const MyDashboard = lazy(() => import('./pages/MyDashboard'))
const Projects = lazy(() => import('./pages/Projects'))
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'))
const Settings = lazy(() => import('./pages/Settings'))
const Admin = lazy(() => import('./pages/Admin'))
const Chat = lazy(() => import('./pages/Chat'))
const Apply = lazy(() => import('./pages/Apply'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const AccessRevoked = lazy(() => import('./pages/AccessRevoked'))
const NotFound = lazy(() => import('./pages/NotFound'))
const BookClub = lazy(() => import('./pages/BookClub'))

// Jared's public site components
import PublicLayout from './components/public/layout/PublicLayout'
import HomePage from './components/public/pages/HomePage'
import AboutPage from './components/public/pages/AboutPage'
import PublicProjectsPage from './components/public/pages/PublicProjectsPage'
import TeamPage from './components/public/pages/TeamPage'
import BlogPage from './components/public/pages/BlogPage'
import ContactPage from './components/public/pages/ContactPage'
import DonatePage from './components/public/pages/DonatePage'

// Legal pages
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'))
const TermsOfService = lazy(() => import('./pages/TermsOfService'))

function LoadingFallback() {
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

function ProtectedRoute({ children }) {
  const { token, user, isLoading } = useAuthStore()

  useEffect(() => {
    if (user?.id && token) {
      socket.connect(token)
    }
    // Don't disconnect on cleanup - only disconnect on logout
  }, [user?.id, token])

  useEffect(() => {
    if (!user) {
      socket.disconnect()
    }
  }, [user])

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
  const { user, isLoading } = useAuthStore()
  if (isLoading) return null
  if (user?.role !== 'admin') return <Navigate to="/" replace />
  return children
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ToastContainer />
        <RecommendationButton />
        <Suspense fallback={<LoadingFallback />}>
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
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
            </Route>

            {/* Auth Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Navigate to="/apply" replace />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
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
              <Route path="book-club" element={<BookClub />} />
              <Route path="admin" element={<AdminRoute><Admin /></AdminRoute>} />
            </Route>

            {/* Redirect old root to dashboard for logged-in users - optional fallback */}
            <Route path="/app" element={<Navigate to="/dashboard" replace />} />

            {/* Catch-all: show 404 for unknown routes */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
