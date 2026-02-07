import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FileQuestion, Home, LayoutDashboard } from 'lucide-react'

export default function NotFound() {
  useEffect(() => {
    document.title = 'Page Not Found - Stats Lab'
  }, [])

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-display font-bold text-3xl text-primary-600">Stats Lab</h1>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
              <FileQuestion className="w-7 h-7 text-primary-500" />
            </div>
          </div>

          <h2 className="font-display text-5xl font-bold text-text-primary dark:text-gray-100 mb-2">404</h2>
          <p className="text-lg font-medium text-text-primary dark:text-gray-100 mb-1">Page not found</p>
          <p className="text-text-secondary dark:text-gray-400 text-sm mb-8">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>

          <div className="space-y-3">
            <Link
              to="/"
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors"
            >
              <Home size={18} />
              Back to Home
            </Link>
            <Link
              to="/dashboard"
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-text-primary dark:text-gray-100 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <LayoutDashboard size={18} />
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
