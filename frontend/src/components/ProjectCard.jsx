import { Link } from 'react-router-dom'
import { CheckCircle2, Calendar, Users } from 'lucide-react'
import { format } from 'date-fns'
import { getUploadUrl } from '../services/api'

export default function ProjectCard({ project, showActions = true }) {
  const statusColors = {
    active: 'bg-secondary-100 dark:bg-secondary-900/30 text-secondary-700 dark:text-secondary-300',
    completed: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    archived: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
    inactive: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
  }

  const isInactive = project.status === 'inactive'

  // Auto-calculate progress from tasks
  const totalActions = parseInt(project.total_actions) || 0
  const completedActions = parseInt(project.completed_actions) || 0
  const calculatedProgress = totalActions === 0 ? 0 : Math.round((completedActions / totalActions) * 100)

  return (
    <Link
      to={`/dashboard/projects/${project.id}`}
      className={`block rounded-xl border transition-all overflow-hidden group ${
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
        <div className="absolute top-3 right-3">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[project.status]}`}>
            {project.status}
          </span>
        </div>
      </div>

      <div className="p-5">
        <h3 className={`font-display font-semibold text-lg transition-colors line-clamp-1 ${
          isInactive
            ? 'text-text-secondary dark:text-gray-400'
            : 'text-text-primary dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400'
        }`}>
          {project.title}
        </h3>

        {project.description && (
          <p className="mt-2 text-sm text-text-secondary dark:text-gray-400 line-clamp-2">
            {project.description}
          </p>
        )}

        {/* Progress bar - auto-calculated from tasks */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-text-secondary dark:text-gray-400">Progress</span>
            <span className="font-medium text-text-primary dark:text-gray-100">{calculatedProgress}%</span>
          </div>
          <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-400 to-primary-500 rounded-full transition-all duration-500"
              style={{ width: `${calculatedProgress}%` }}
            />
          </div>
        </div>

        {/* Action items preview */}
        {showActions && project.total_actions > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 text-xs text-text-secondary dark:text-gray-400">
              <CheckCircle2 size={14} className="text-secondary-500" />
              <span>
                {project.completed_actions || 0} of {project.total_actions} tasks done
              </span>
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center gap-4 text-xs text-text-secondary dark:text-gray-400">
          {(project.member_count > 0 || project.lead_name) && (
            <span className="flex items-center gap-1">
              <Users size={14} />
              {project.member_count || 0} member{project.member_count !== 1 ? 's' : ''}
              {project.lead_name && <span className="ml-1">· Lead: {project.lead_name}</span>}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar size={14} />
            Updated {format(new Date(project.updated_at), 'MMM d, yyyy')}
          </span>
        </div>
      </div>
    </Link>
  )
}
