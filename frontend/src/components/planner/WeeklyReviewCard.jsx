import { useState } from 'react'
import { BarChart3, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'

export default function WeeklyReviewCard({ review, onGenerate, isGenerating }) {
  const [expanded, setExpanded] = useState(false)
  const stats = review?.stats || {}

  if (!review) {
    return (
      <button
        onClick={onGenerate}
        disabled={isGenerating}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 transition-colors disabled:opacity-50"
      >
        {isGenerating ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            Generating...
          </>
        ) : (
          <>
            <BarChart3 size={16} />
            Weekly Review
          </>
        )}
      </button>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-violet-500" />
          <span className="font-display font-semibold text-text-primary dark:text-gray-100">
            Weekly Review
          </span>
          {stats.completion_rate != null && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
              {stats.completion_rate}% completion
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onGenerate() }}
            disabled={isGenerating}
            className="p-1.5 rounded-lg text-text-secondary dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            title="Regenerate"
          >
            <RefreshCw size={14} className={isGenerating ? 'animate-spin' : ''} />
          </button>
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-700">
          {/* Stats row */}
          {stats.days_planned != null && (
            <div className="flex gap-4 py-3 text-xs text-text-secondary dark:text-gray-400">
              <span>{stats.days_planned} days planned</span>
              <span>{stats.completed_steps}/{stats.total_steps} steps done</span>
              <span>{stats.tasks_completed} tasks completed</span>
            </div>
          )}

          {/* Markdown content */}
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
            {review.ai_summary?.split('\n').map((line, i) => {
              if (line.startsWith('## ')) {
                return <h4 key={i} className="text-sm font-semibold text-text-primary dark:text-gray-100 mt-4 mb-2">{line.replace('## ', '')}</h4>
              }
              if (line.startsWith('- ')) {
                return <p key={i} className="text-text-secondary dark:text-gray-400 pl-4 my-0.5">&bull; {line.replace('- ', '')}</p>
              }
              if (line.startsWith('**') && line.endsWith('**')) {
                return <p key={i} className="font-medium text-text-primary dark:text-gray-200 mt-2">{line.replace(/\*\*/g, '')}</p>
              }
              if (line.trim()) {
                return <p key={i} className="text-text-secondary dark:text-gray-400 my-0.5">{line}</p>
              }
              return null
            })}
          </div>
        </div>
      )}
    </div>
  )
}
