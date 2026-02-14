import { Sparkles, ListChecks, Clock, TrendingUp } from 'lucide-react'

export default function PlannerEmptyState({
  onGenerate,
  isGenerating,
  title = 'AI Daily Planner',
  description = 'Get an AI-generated daily plan based on your tasks, calendar, and project priorities. Your plan adapts to deadlines and follows up on incomplete work.',
  buttonLabel = 'Generate My Daily Plan',
}) {
  return (
    <div className="p-8 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-100 dark:from-violet-900/30 to-primary-100 dark:to-primary-900/30 flex items-center justify-center">
        <Sparkles size={28} className="text-violet-500" />
      </div>
      <h3 className="font-display font-semibold text-lg text-text-primary dark:text-gray-100 mb-2">
        {title}
      </h3>
      <p className="text-text-secondary dark:text-gray-400 max-w-md mx-auto mb-6">
        {description}
      </p>

      <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto mb-6">
        <div className="text-center">
          <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <ListChecks size={18} className="text-blue-600 dark:text-blue-300" />
          </div>
          <p className="text-xs text-text-secondary dark:text-gray-400">Bite-sized steps</p>
        </div>
        <div className="text-center">
          <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Clock size={18} className="text-amber-600 dark:text-amber-300" />
          </div>
          <p className="text-xs text-text-secondary dark:text-gray-400">Time estimates</p>
        </div>
        <div className="text-center">
          <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <TrendingUp size={18} className="text-green-600 dark:text-green-300" />
          </div>
          <p className="text-xs text-text-secondary dark:text-gray-400">Weekly reviews</p>
        </div>
      </div>

      <button
        onClick={onGenerate}
        disabled={isGenerating}
        className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-violet-600 to-primary-600 text-white font-medium rounded-xl hover:from-violet-700 hover:to-primary-700 transition-all shadow-lg shadow-violet-200 dark:shadow-violet-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isGenerating ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles size={16} />
            {buttonLabel}
          </>
        )}
      </button>
    </div>
  )
}
