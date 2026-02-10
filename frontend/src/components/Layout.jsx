import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { getUploadUrl } from '../services/api'
import { useThemeStore } from '../store/themeStore'
import { useNotificationStore } from '../store/notificationStore'
import { LayoutDashboard, User, FolderKanban, Settings, LogOut, Menu, X, MessageCircle, Shield, ExternalLink, Search, Sun, Moon, WifiOff } from 'lucide-react'
import { useState, useEffect } from 'react'
import socket from '../services/socket'
import NotificationBell from './NotificationBell'
import SearchModal from './SearchModal'
import ShortcutsHelpModal from './ShortcutsHelpModal'
import Breadcrumbs from './Breadcrumbs'
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts'

export default function Layout() {
  const { user, logout } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const { unreadCountsByType, fetchUnreadCountsByType } = useNotificationStore()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [socketStatus, setSocketStatus] = useState(socket.getConnectionStatus())

  useEffect(() => {
    fetchUnreadCountsByType()
  }, [fetchUnreadCountsByType])

  useEffect(() => {
    const unsub = socket.subscribeToConnectionStatus((status) => {
      setSocketStatus(status)
    })
    return unsub
  }, [])

  useKeyboardShortcuts({
    onSearch: () => setSearchOpen(true),
    onShortcutsHelp: () => setShortcutsOpen(true),
  })

  // Cmd+K / Ctrl+K to open search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(prev => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const dashboardBadge = (unreadCountsByType.task_assigned || 0)
  const projectsBadge = (unreadCountsByType.join_request || 0) + (unreadCountsByType.member_accepted || 0)
  const adminBadge = (unreadCountsByType.application || 0)

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Lab Dashboard' },
    { to: '/dashboard/my-dashboard', icon: User, label: 'My Dashboard', badge: dashboardBadge },
    { to: '/dashboard/projects', icon: FolderKanban, label: 'Projects', badge: projectsBadge },
    { to: '/dashboard/chat', icon: MessageCircle, label: 'Chat' },
    ...(user?.role === 'admin' ? [{ to: '/dashboard/admin', icon: Shield, label: 'Admin', badge: adminBadge }] : []),
    { to: '/dashboard/settings', icon: Settings, label: 'Settings' },
  ]

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900">
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 z-50">
        <div className="flex items-center">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {sidebarOpen ? <X size={24} className="dark:text-gray-200" /> : <Menu size={24} className="dark:text-gray-200" />}
          </button>
          <span className="ml-3 font-display font-semibold text-lg text-primary-600 dark:text-primary-400">Stats Lab</span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
        </div>
      </div>

      {/* Desktop header */}
      <div className="hidden lg:flex fixed top-0 left-64 right-0 h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 items-center justify-between px-6 z-40">
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          <Search size={16} />
          <span>Search...</span>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-text-secondary dark:text-gray-400"
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <NotificationBell />
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-40 transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <h1 className="font-display font-bold text-xl text-primary-600 dark:text-primary-400">Stats Lab</h1>
          <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">Research Manager</p>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/dashboard' || to === '/dashboard/my-dashboard'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-organic text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'text-text-secondary dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-text-primary dark:hover:text-gray-200'
                }`
              }
            >
              <Icon size={20} />
              {label}
              {badge > 0 && (
                <span className="ml-auto w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-20 left-0 right-0 px-4">
          <a
            href="/"
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-organic transition-colors"
          >
            <ExternalLink size={16} />
            View Public Site
          </a>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center overflow-hidden">
              {user?.avatar_url ? (
                <img src={getUploadUrl(user.avatar_url)} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-primary-700 dark:text-primary-300 font-medium text-sm">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary dark:text-gray-200 truncate">{user?.name}</p>
              <p className="text-xs text-text-secondary dark:text-gray-400 capitalize">{user?.role?.replace(/_/g, ' ')}</p>
            </div>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-text-secondary dark:text-gray-400 lg:hidden"
              title={theme === 'light' ? 'Dark mode' : 'Light mode'}
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-text-secondary dark:text-gray-400 hover:text-red-600"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Socket disconnection banner */}
      {socketStatus === 'reconnecting' && (
        <div className="fixed top-16 left-0 lg:left-64 right-0 z-50 bg-amber-500 text-amber-950 text-sm text-center py-1.5 px-4 flex items-center justify-center gap-2">
          <WifiOff size={14} />
          Connection lost. Reconnecting...
        </div>
      )}

      {/* Main content */}
      <main className={`lg:ml-64 pt-16 min-h-screen ${socketStatus === 'reconnecting' ? 'mt-8' : ''}`}>
        <div className="p-6 lg:p-8">
          <Breadcrumbs />
          <Outlet />
        </div>
      </main>

      {/* Search Modal */}
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Shortcuts Help Modal */}
      <ShortcutsHelpModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  )
}
