import { useLocation, Link } from 'react-router-dom'
import { useProjectStore } from '../store/projectStore'
import { useChatStore } from '../store/chatStore'
import { ArrowLeft } from 'lucide-react'

const routeLabels = {
  'dashboard': 'Dashboard',
  'my-dashboard': 'My Dashboard',
  'projects': 'Projects',
  'chat': 'Chat',
  'settings': 'Settings',
  'admin': 'Admin',
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

  const parentCrumb = crumbs[crumbs.length - 2]

  return (
    <nav className="text-sm mb-4">
      <Link
        to={parentCrumb.path}
        className="inline-flex items-center gap-1.5 text-text-secondary dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
      >
        <ArrowLeft size={14} />
        Back to {parentCrumb.label}
      </Link>
    </nav>
  )
}
