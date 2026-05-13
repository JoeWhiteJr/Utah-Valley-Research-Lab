import { useLocation, Link } from 'react-router-dom'
import { useProjectStore } from '../store/projectStore'
import { useChatStore } from '../store/chatStore'
import { ChevronRight } from 'lucide-react'

const routeLabels = {
  'dashboard': 'Dashboard',
  'my-dashboard': 'My Dashboard',
  'projects': 'Projects',
  'chat': 'Chat',
  'settings': 'Settings',
  'admin': 'Admin',
  'book-club': 'Book Club',
  'vvc': 'VVC',
}

export default function Breadcrumbs() {
  const location = useLocation()
  const { currentProject } = useProjectStore()
  const { currentRoom } = useChatStore()

  const pathSegments = location.pathname.split('/').filter(Boolean)

  // Don't show breadcrumbs on the main dashboard
  if (pathSegments.length <= 1) return null

  const crumbs = []

  // Build breadcrumb trail
  let currentPath = ''
  for (let i = 0; i < pathSegments.length; i++) {
    const segment = pathSegments[i]
    currentPath += `/${segment}`

    if (segment === 'dashboard') {
      crumbs.push({ label: 'Dashboard', path: '/dashboard' })
      continue
    }

    // Named route
    if (routeLabels[segment]) {
      crumbs.push({ label: routeLabels[segment], path: currentPath })
      continue
    }

    // Dynamic project ID
    if (pathSegments[i - 1] === 'projects' && segment !== 'projects') {
      crumbs.push({
        label: currentProject?.title || 'Project',
        path: currentPath
      })
      continue
    }

    // Dynamic chat room ID
    if (pathSegments[i - 1] === 'chat' && segment !== 'chat') {
      crumbs.push({
        label: currentRoom?.name || 'Chat Room',
        path: currentPath
      })
      continue
    }
  }

  if (crumbs.length <= 1) return null

  return (
    <nav aria-label="Breadcrumb" className="text-sm mb-4">
      <ol className="inline-flex items-center gap-1.5 flex-wrap">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1
          return (
            <li key={crumb.path} className="inline-flex items-center gap-1.5">
              {index > 0 && (
                <ChevronRight size={14} className="text-text-tertiary dark:text-gray-500" aria-hidden="true" />
              )}
              {isLast ? (
                <span aria-current="page" className="text-text-primary dark:text-gray-200 font-medium">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  to={crumb.path}
                  className="text-text-secondary dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
