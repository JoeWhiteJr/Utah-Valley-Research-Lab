import { useEffect } from 'react'
import { useStudyStore } from '../../store/studyStore'

export default function StudyDone() {
  const reset = useStudyStore((s) => s.reset)

  useEffect(() => {
    // Clear the persisted session so a new participant on this device gets a
    // fresh assignment. Reset on mount so refreshing the "done" page restarts.
    return () => reset()
  }, [reset])

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-md w-full text-center">
        <h1 className="font-display font-bold text-2xl text-text-primary dark:text-gray-100 mb-2">
          You&apos;re all done
        </h1>
        <p className="text-text-secondary dark:text-gray-400 mb-6">
          You can close this tab. Thank you for your time.
        </p>
        <a
          href="/"
          className="inline-block text-primary-600 dark:text-primary-400 underline text-sm"
        >
          Return to the Stats Lab home page
        </a>
      </div>
    </div>
  )
}
