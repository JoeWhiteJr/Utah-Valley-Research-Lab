import { memo } from 'react'
import { Users, Pin, Eye } from 'lucide-react'
import { getUploadUrl } from '../services/api'
import { PROJECT_STATUS_COLORS } from '../constants'

const ProjectCard = memo(function ProjectCard({ project, onClick, pendingJoinRequests = 0, isPinned = false, isMember = false, onTogglePin, onPreview }) {
  const statusColors = PROJECT_STATUS_COLORS

  const isInactive = project.status === 'inactive'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } }}
      className={`block rounded-xl border transition-all overflow-hidden group cursor-pointer ${
        isMember ? 'border-l-4 border-l-primary-400 dark:border-l-primary-500' : ''
      } ${
        isInactive
          ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 opacity-75'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md'
      }`}
    >
      {/* Header image */}
      <div className="h-32 bg-gradient-to-br from-primary-100 dark:from-primary-900/30 to-secondary-100 dark:to-secondary-900/30 relative overflow-hidden">
        {project.header_image ? (
          <img
            src={getUploadUrl(project.header_image)}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-white/30 backdrop-blur-sm" />
          </div>
        )}
        {/* Pin button */}
        {onTogglePin && (
          <button
            onClick={(e) => { e.stopPropagation(); onTogglePin(project.id) }}
            className={`absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all ${
              isPinned
                ? 'bg-white/90 dark:bg-gray-800/90 text-primary-600 dark:text-primary-400'
                : 'bg-white/70 dark:bg-gray-800/70 text-gray-500 dark:text-gray-400 opacity-0 group-hover:opacity-100'
            }`}
            title={isPinned ? 'Unpin project' : 'Pin project'}
          >
            <Pin size={13} className={isPinned ? 'fill-current' : ''} />
            {isPinned ? 'Unpin' : 'Pin'}
          </button>
        )}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          {pendingJoinRequests > 0 && (
            <span className="w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center shadow-sm">
              {pendingJoinRequests}
            </span>
          )}
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[project.status]}`}>
            {project.status}
          </span>
        </div>
        {/* Preview button */}
        {onPreview && (
          <button
            onClick={(e) => { e.stopPropagation(); onPreview(project) }}
            className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full bg-white/70 dark:bg-gray-800/70 text-gray-500 dark:text-gray-400 text-xs font-medium opacity-0 group-hover:opacity-100 transition-all hover:bg-white/90 dark:hover:bg-gray-800/90 hover:text-primary-600 dark:hover:text-primary-400"
            title="Preview project"
          >
            <Eye size={13} />
            Preview
          </button>
        )}
      </div>

      <div className="p-5">
        <h3 className={`font-display font-semibold text-lg transition-colors line-clamp-1 ${
          isInactive
            ? 'text-text-secondary dark:text-gray-400'
            : 'text-text-primary dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400'
        }`} title={project.title}>
          {project.title}
        </h3>

        {project.subheader && (
          <p className="mt-1 text-sm text-text-secondary dark:text-gray-400 line-clamp-1" title={project.subheader}>
            {project.subheader}
          </p>
        )}

        <div className="mt-3 flex items-center gap-1 text-xs text-text-secondary dark:text-gray-400">
          <Users size={14} />
          {project.lead_name && <span>Lead: {project.lead_name} &middot; </span>}
          <span>{project.member_count || 0} member{parseInt(project.member_count) !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  )
})

export default ProjectCard
