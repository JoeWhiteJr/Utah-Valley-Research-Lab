import { Link } from 'react-router-dom'
import { CheckCircle2, Circle, Calendar } from 'lucide-react'
import { format } from 'date-fns'

export default function ProjectCard({ project, showActions = true }) {
  const statusColors = {
    active: 'bg-secondary-100 text-secondary-700',
    completed: 'bg-green-100 text-green-700',
    archived: 'bg-gray-100 text-gray-600',
    inactive: 'bg-amber-100 text-amber-700'
  }

  const isInactive = project.status === 'inactive'

  return (
    <Link
      to={`/dashboard/projects/${project.id}`}
      className={`block rounded-xl border transition-all overflow-hidden group ${
        isInactive
          ? 'bg-gray-50 border-gray-200 hover:border-gray-300 opacity-75'
          : 'bg-white border-gray-200 hover:border-primary-300 hover:shadow-md'
      }`}
    >
      {/* Header image */}
      <div className="h-32 bg-gradient-to-br from-primary-100 to-secondary-100 relative overflow-hidden">
        {project.header_image ? (
          <img
            src={project.header_image}
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
            ? 'text-text-secondary'
            : 'text-text-primary group-hover:text-primary-600'
        }`}>
          {project.title}
        </h3>

        {project.description && (
          <p className="mt-2 text-sm text-text-secondary line-clamp-2">
            {project.description}
          </p>
        )}

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-text-secondary">Progress</span>
            <span className="font-medium text-text-primary">{project.progress || 0}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-400 to-primary-500 rounded-full transition-all duration-500"
              style={{ width: `${project.progress || 0}%` }}
            />
          </div>
        </div>

        {/* Action items preview */}
        {showActions && project.total_actions > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <CheckCircle2 size={14} className="text-secondary-500" />
              <span>
                {project.completed_actions || 0} of {project.total_actions} tasks done
              </span>
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 text-xs text-text-secondary">
          <Calendar size={14} />
          <span>Updated {format(new Date(project.updated_at), 'MMM d, yyyy')}</span>
        </div>
      </div>
    </Link>
  )
}
