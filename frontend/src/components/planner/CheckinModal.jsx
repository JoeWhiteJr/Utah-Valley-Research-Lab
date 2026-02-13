import { useState } from 'react'
import { MessageCircle, X } from 'lucide-react'

const STATUS_OPTIONS = [
  { value: 'completed', label: 'Completed', color: 'text-green-600 dark:text-green-400' },
  { value: 'partial', label: 'Partial', color: 'text-amber-600 dark:text-amber-400' },
  { value: 'skipped', label: 'Skipped', color: 'text-gray-500 dark:text-gray-400' },
  { value: 'deferred', label: 'Deferred', color: 'text-blue-600 dark:text-blue-400' },
]

export default function CheckinModal({ checkin, onSubmit, onDismiss }) {
  const questions = checkin.questions || []
  const [responses, setResponses] = useState(
    questions.map(q => ({ step_title: q.step_title, status: '', notes: '' }))
  )

  const handleStatusChange = (index, status) => {
    setResponses(prev => prev.map((r, i) =>
      i === index ? { ...r, status } : r
    ))
  }

  const handleNotesChange = (index, notes) => {
    setResponses(prev => prev.map((r, i) =>
      i === index ? { ...r, notes } : r
    ))
  }

  const allAnswered = responses.every(r => r.status)

  const handleSubmit = () => {
    if (allAnswered) onSubmit(responses)
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle size={20} className="text-violet-500" />
            <h3 className="font-display font-semibold text-text-primary dark:text-gray-100">
              Daily Check-in
            </h3>
          </div>
          <button
            onClick={onDismiss}
            className="p-1 rounded-lg text-text-secondary dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {checkin.ai_message && (
            <p className="text-sm text-text-secondary dark:text-gray-400 bg-violet-50 dark:bg-violet-900/20 rounded-lg p-3">
              {checkin.ai_message}
            </p>
          )}

          {questions.map((q, index) => (
            <div key={index} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <p className="text-sm font-medium text-text-primary dark:text-gray-100 mb-3">
                {q.question || `How did "${q.step_title}" go?`}
              </p>
              <div className="flex flex-wrap gap-2 mb-2">
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleStatusChange(index, opt.value)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      responses[index].status === opt.value
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                        : 'border-gray-200 dark:border-gray-600 text-text-secondary dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Notes (optional)"
                value={responses[index].notes}
                onChange={(e) => handleNotesChange(index, e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-violet-300"
              />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-end gap-3">
          <button
            onClick={onDismiss}
            className="px-4 py-2 text-sm font-medium text-text-secondary dark:text-gray-400 hover:text-text-primary dark:hover:text-gray-100 transition-colors"
          >
            Dismiss
          </button>
          <button
            onClick={handleSubmit}
            disabled={!allAnswered}
            className="px-4 py-2 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Submit Check-in
          </button>
        </div>
      </div>
    </div>
  )
}
