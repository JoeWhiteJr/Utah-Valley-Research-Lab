import { useEffect, useRef, useState } from 'react'
import { useStudyStore } from '../../store/studyStore'
import Button from '../../components/Button'

const EXPERIMENT_PATH = {
  treasure_hunt: '/study-games/experiment1/index.html',
  career_choice: '/study-games/experiment2/index.html',
  pattern_memory: '/study-games/experiment3/index.html',
}

export default function StudyGameFrame() {
  const { participant_code, experiment, condition, markComplete } = useStudyStore()
  const iframeRef = useRef(null)
  const [iframeError, setIframeError] = useState(false)

  useEffect(() => {
    const handler = (event) => {
      const data = event.data
      if (data && data.type === 'study_complete' && data.participant_code === participant_code) {
        markComplete()
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [participant_code, markComplete])

  if (!participant_code || !experiment) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-md text-center">
          <p className="text-text-secondary dark:text-gray-400">
            No active study session. Please start over.
          </p>
        </div>
      </div>
    )
  }

  const path = EXPERIMENT_PATH[experiment]
  if (!path) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-md text-center">
          <p className="text-red-600 dark:text-red-400">Unknown experiment: {experiment}</p>
        </div>
      </div>
    )
  }

  const src = `${path}?pid=${encodeURIComponent(participant_code)}&cond=${encodeURIComponent(condition || '')}`

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <div className="flex-1 flex flex-col">
        {iframeError ? (
          <div className="flex items-center justify-center flex-1 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-md text-center space-y-4">
              <p className="text-text-secondary dark:text-gray-400">
                The task failed to load. You can open it directly in a new tab:
              </p>
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-primary-600 dark:text-primary-400 underline"
              >
                Open task in new tab
              </a>
            </div>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={src}
            title="Research task"
            className="flex-1 w-full border-0 bg-white"
            allow="fullscreen"
            onError={() => setIframeError(true)}
          />
        )}
      </div>
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center justify-between text-xs text-text-secondary dark:text-gray-400">
        <span>Participant: {participant_code}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (window.confirm('Are you sure you want to leave the task? Your progress will be saved if you have completed at least one phase.')) {
              window.location.href = '/'
            }
          }}
        >
          Leave study
        </Button>
      </div>
    </div>
  )
}
