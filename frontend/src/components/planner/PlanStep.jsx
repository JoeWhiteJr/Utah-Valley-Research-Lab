import { CheckCircle2, Circle, Clock, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'

const priorityStyles = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-blue-500',
  low: 'bg-gray-400',
}

export default function PlanStep({ step, onToggle }) {
  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-lg transition-colors ${
      step.completed
        ? 'bg-green-50/50 dark:bg-green-900/10'
        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
    }`}>
      <button
        onClick={() => onToggle(step.id)}
        className="flex-shrink-0 mt-0.5"
      >
        {step.completed ? (
          <CheckCircle2 size={20} className="text-green-500" />
        ) : (
          <Circle size={20} className="text-gray-300 dark:text-gray-600 hover:text-primary-400 transition-colors" />
        )}
      </button>

      {step.priority_label && (
        <span className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${priorityStyles[step.priority_label] || priorityStyles.low}`} />
      )}

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${
          step.completed
            ? 'line-through text-text-secondary dark:text-gray-500'
            : 'text-text-primary dark:text-gray-100'
        }`}>
          {step.title}
        </p>
        {step.description && (
          <p className="text-xs text-text-secondary dark:text-gray-400 mt-0.5 line-clamp-2">
            {step.description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {step.estimated_minutes && (
          <span className="inline-flex items-center gap-1 text-xs text-text-secondary dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
            <Clock size={10} />
            ~{step.estimated_minutes}m
          </span>
        )}
        {step.source_type === 'action_item' && step.source_id && (
          <Link
            to={`/dashboard/projects`}
            className="text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300"
            title="View source task"
          >
            <ExternalLink size={14} />
          </Link>
        )}
      </div>
    </div>
  )
}
