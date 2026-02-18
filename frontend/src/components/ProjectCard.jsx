import { memo } from 'react'
import { Users, Pin } from 'lucide-react'
import { getUploadUrl } from '../services/api'
import { PROJECT_STATUS_COLORS } from '../constants'

const ProjectCard = memo(function ProjectCard({ project, onClick, pendingJoinRequests = 0, isPinned = false, onTogglePin }) {
  const statusColors = PROJECT_STATUS_COLORS

  const isInactive = project.status === 'inactive'

  const membersPreview = project.members_preview || []
  const displayMembers = membersPreview.slice(0, 5)
  const overflowCount = (parseInt(project.member_count) || 0) - 5

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } }}
      className={`block rounded-xl border transition-all overflow-hidden group cursor-pointer ${
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
            className={`absolute top-3 left-3 p-1.5 rounded-full transition-all ${
              isPinned
                ? 'bg-white/90 dark:bg-gray-800/90 text-primary-600 dark:text-primary-400'
                : 'bg-white/70 dark:bg-gray-800/70 text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100'
            }`}
            title={isPinned ? 'Unpin project' : 'Pin project'}
          >
            <Pin size={14} className={isPinned ? 'fill-current' : ''} />
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
      </div>

      <div className="p-5">
        <div className="flex gap-3">
          {/* Left: title + subtitle + footer */}
          <div className="flex-1 min-w-0">
            <h3 className={`font-display font-semibold text-lg transition-colors line-clamp-1 ${
              isInactive
                ? 'text-text-secondary dark:text-gray-400'
                : 'text-text-primary dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400'
            }`} title={project.title}>
              {project.title}
            </h3>

            {project.important_info && (
              <p className="mt-1 text-sm text-text-secondary dark:text-gray-400 line-clamp-1" title={project.important_info}>
                {project.important_info}
              </p>
            )}

            <div className="mt-3 flex items-center gap-1 text-xs text-text-secondary dark:text-gray-400">
              <Users size={14} />
              {project.lead_name && <span>Lead: {project.lead_name} &middot; </span>}
              <span>{project.member_count || 0} member{parseInt(project.member_count) !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Right: member avatars */}
          {displayMembers.length > 0 && (
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              {displayMembers.map((member) => (
                <div key={member.user_id} title={member.name} className="w-7 h-7 rounded-full flex-shrink-0 overflow-hidden bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-medium text-primary-600 dark:text-primary-300">
                      {member.name?.split(' ')[0]?.[0]?.toUpperCase() || '?'}
                    </span>
                  )}
                </div>
              ))}
              {overflowCount > 0 && (
                <div className="w-7 h-7 rounded-full flex-shrink-0 bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                  <span className="text-[10px] font-medium text-text-secondary dark:text-gray-300">+{overflowCount}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

export default ProjectCard
