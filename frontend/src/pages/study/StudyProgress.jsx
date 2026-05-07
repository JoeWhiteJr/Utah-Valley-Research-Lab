// Progress indicator shown above each step except `game` (iframe owns the
// viewport) and `done` (terminal celebratory state).

const STEP_INDEX = {
  landing: 1,
  consent: 2,
  game: 3,
  demographics: 4,
  debrief: 5,
}

const STEP_LABEL = {
  landing: 'Welcome',
  consent: 'Informed Consent',
  game: 'Task',
  demographics: 'Quick Survey',
  debrief: 'Debrief',
}

const TOTAL_STEPS = 5

export default function StudyProgress({ step }) {
  const current = STEP_INDEX[step]
  if (!current) return null
  const pct = Math.round((current / TOTAL_STEPS) * 100)

  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
      <div className="max-w-2xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between text-xs text-text-secondary dark:text-gray-400 mb-1.5">
          <span>
            <span className="font-semibold text-text-primary dark:text-gray-200">
              Step {current} of {TOTAL_STEPS}
            </span>
            <span className="mx-2">&middot;</span>
            <span>{STEP_LABEL[step]}</span>
          </span>
          <span aria-hidden="true">{pct}%</span>
        </div>
        <div
          className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={current}
          aria-valuemin={1}
          aria-valuemax={TOTAL_STEPS}
          aria-label={`Step ${current} of ${TOTAL_STEPS}: ${STEP_LABEL[step]}`}
        >
          <div
            className="h-full bg-primary-500 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
