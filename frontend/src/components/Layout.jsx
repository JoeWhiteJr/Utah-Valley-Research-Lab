import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { getUploadUrl } from '../services/api'
import { useThemeStore } from '../store/themeStore'
import { useNotificationStore } from '../store/notificationStore'
import { LayoutDashboard, User, FolderKanban, Settings, LogOut, Menu, X, MessageCircle, Shield, ExternalLink, Search, Sun, Moon, WifiOff, BookOpen, Code } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import socket from '../services/socket'
import NotificationBell from './NotificationBell'
import SearchModal from './SearchModal'
import ShortcutsHelpModal from './ShortcutsHelpModal'
import Breadcrumbs from './Breadcrumbs'
import AssistantToggle from './assistant/AssistantToggle'
import AssistantSidebar from './assistant/AssistantSidebar'
import { useAssistantStore } from '../store/assistantStore'
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts'

export default function Layout() {
  const { user, logout } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const { unreadCountsByType, fetchUnreadCountsByType } = useNotificationStore()
  const assistantIsOpen = useAssistantStore((s) => s.isOpen)
  const navigate = useNavigate()
  const [navOpen, setNavOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [socketStatus, setSocketStatus] = useState(socket.getConnectionStatus())
  const dropdownRef = useRef(null)

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

  const closeNav = useCallback(() => setNavOpen(false), [])

  const handleLogout = async () => {
    closeNav()
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
    { to: '/dashboard/book-club', icon: BookOpen, label: 'Book Club' },
    { to: '/dashboard/vvc', icon: Code, label: 'VVC' },
    ...(user?.role === 'admin' ? [{ to: '/dashboard/admin', icon: Shield, label: 'Admin', badge: adminBadge }] : []),
    { to: '/dashboard/settings', icon: Settings, label: 'Settings' },
  ]

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900">
      {/* Unified header */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 lg:px-6 z-50">
        {/* Left: hamburger + branding + user */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setNavOpen(!navOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
            aria-label={navOpen ? 'Close menu' : 'Open menu'}
          >
            {navOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div className="hidden sm:block">
            <h1 className="font-display font-bold text-lg leading-tight text-primary-600 dark:text-primary-400">Stats Lab</h1>
            <p className="text-xs text-text-secondary dark:text-gray-400 leading-tight">Research Manager</p>
          </div>
          <span className="sm:hidden font-display font-semibold text-lg text-primary-600 dark:text-primary-400">Stats Lab</span>
          <div className="hidden md:flex items-center gap-2 ml-2 pl-3 border-l border-gray-200 dark:border-gray-700">
            <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center overflow-hidden">
              {user?.avatar_url ? (
                <img src={getUploadUrl(user.avatar_url)} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-primary-700 dark:text-primary-300 font-medium text-xs">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              )}
            </div>
            <span className="text-sm text-text-secondary dark:text-gray-300">{user?.name}</span>
            {user?.role === 'admin' && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 rounded">
                Admin
              </span>
            )}
          </div>
        </div>

        {/* Right: search + theme + assistant + notifications */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSearchOpen(true)}
            className="hidden sm:flex items-center gap-2 w-72 px-3 py-1.5 text-sm text-text-secondary dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <Search size={16} />
            <span>Search...</span>

          </button>
          <button
            onClick={() => setSearchOpen(true)}
            className="sm:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-text-secondary dark:text-gray-400"
            aria-label="Search"
          >
            <Search size={20} />
          </button>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-text-secondary dark:text-gray-400"
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <span className="hidden lg:inline-flex">
            <AssistantToggle />
          </span>
          <NotificationBell />
        </div>
      </div>

      {/* Hamburger dropdown menu */}
      {navOpen && (
        <>
          {/* Click-outside overlay */}
          <div className="fixed inset-0 z-40" onClick={closeNav} />
          {/* Dropdown panel */}
          <div
            ref={dropdownRef}
            className="fixed top-16 left-0 z-50 w-72 m-2 rounded-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 shadow-xl"
          >
            {/* User info on mobile */}
            <div className="md:hidden px-4 pt-4 pb-3 border-b border-gray-200/50 dark:border-gray-700/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center overflow-hidden">
                  {user?.avatar_url ? (
                    <img src={getUploadUrl(user.avatar_url)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-primary-700 dark:text-primary-300 font-medium text-xs">
                      {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary dark:text-gray-200">{user?.name}</p>
                  {user?.role === 'admin' && (
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 rounded">
                      Admin
                    </span>
                  )}
                </div>
              </div>
            </div>

            <nav className="p-2 space-y-0.5">
              {navItems.map(({ to, icon: Icon, label, badge }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/dashboard' || to === '/dashboard/my-dashboard'}
                  onClick={closeNav}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-50/60 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-primary-50/80 dark:hover:bg-primary-900/40 hover:text-primary-700 dark:hover:text-primary-300'
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
              <a
                href="/"
                onClick={closeNav}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-primary-50/80 dark:hover:bg-primary-900/40 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
              >
                <ExternalLink size={20} />
                View Public Site
              </a>
            </nav>

            <div className="border-t border-gray-200/50 dark:border-gray-700/50 p-2">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-red-50/80 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              >
                <LogOut size={20} />
                Logout
              </button>
            </div>
          </div>
        </>
      )}

      {/* Socket disconnection banner */}
      {socketStatus === 'reconnecting' && (
        <div className="fixed top-16 left-0 right-0 z-50 bg-amber-500 text-amber-950 text-sm text-center py-1.5 px-4 flex items-center justify-center gap-2">
          <WifiOff size={14} />
          Connection lost. Reconnecting...
        </div>
      )}

      {/* Main content */}
      <main className={`pt-16 min-h-screen transition-[margin] ${assistantIsOpen ? 'lg:mr-96' : ''} ${socketStatus === 'reconnecting' ? 'mt-8' : ''}`}>
        <div className="p-6 lg:p-8">
          <Breadcrumbs />
          <Outlet />
        </div>
      </main>

      {/* AI Research Assistant Sidebar */}
      <AssistantSidebar />

      {/* Search Modal */}
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Shortcuts Help Modal */}
      <ShortcutsHelpModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  )
}
