import { format } from 'date-fns'
import { RefreshCw, Sparkles } from 'lucide-react'
import PlanStep from './PlanStep'

export default function DailyPlanCard({ plan, steps, onToggleStep, onRegenerate, isGenerating, embedded }) {
  const completedCount = steps.filter(s => s.completed).length
  const totalCount = steps.length
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const totalMinutes = steps.reduce((sum, s) => sum + (s.estimated_minutes || 0), 0)
  const completedMinutes = steps.filter(s => s.completed).reduce((sum, s) => sum + (s.estimated_minutes || 0), 0)

  const content = (
    <>
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-violet-500" />
            <h3 className="font-display font-semibold text-text-primary dark:text-gray-100">
              Daily Plan
            </h3>
            <span className="text-xs text-text-secondary dark:text-gray-400">
              {format(new Date(plan.plan_date), 'EEEE, MMM d')}
            </span>
          </div>
          <button
            onClick={onRegenerate}
            disabled={isGenerating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-text-secondary dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={isGenerating ? 'animate-spin' : ''} />
            {isGenerating ? 'Regenerating...' : 'Regenerate'}
          </button>
        </div>

        {/* AI Summary */}
        {plan.ai_summary && (
          <p className="text-sm text-text-secondary dark:text-gray-400 mb-3">
            {plan.ai_summary}
          </p>
        )}

        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-primary-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs font-medium text-text-secondary dark:text-gray-400 whitespace-nowrap">
            {completedCount}/{totalCount} done
          </span>
          <span className="text-xs text-text-secondary dark:text-gray-400 whitespace-nowrap">
            {completedMinutes}/{totalMinutes}m
          </span>
        </div>
      </div>

      {/* Steps */}
      <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
        {steps.map(step => (
          <PlanStep key={step.id} step={step} onToggle={onToggleStep} />
        ))}
      </div>
    </>
  )

  if (embedded) return content

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {content}
    </div>
  )
}
