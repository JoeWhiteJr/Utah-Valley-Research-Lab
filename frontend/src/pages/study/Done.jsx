import { useEffect, useRef, useState } from 'react'
import { useStudyStore } from '../../store/studyStore'
import { CheckCircle2, Copy, Check } from 'lucide-react'

export default function StudyDone() {
  const { participant_code, reset } = useStudyStore()
  // Capture the completion code + time on mount so it stays stable even after
  // reset() clears the store on unmount or if the user revisits.
  const captured = useRef({
    code: participant_code,
    completedAt: new Date(),
  })
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // Reset on unmount so a fresh participant on this device starts a new session.
    return () => reset()
  }, [reset])

  const completionCode = captured.current.code
  const completedAt = captured.current.completedAt

  const copyCode = async () => {
    if (!completionCode) return
    try {
      await navigator.clipboard.writeText(completionCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard not available; user can still screenshot.
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-lg w-full">
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-green-100 dark:bg-green-900/40 p-3">
            <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
        </div>

        <h1 className="font-display font-bold text-2xl text-text-primary dark:text-gray-100 text-center mb-2">
          Study complete
        </h1>
        <p className="text-text-secondary dark:text-gray-400 text-center mb-6">
          Thank you for participating. Your responses have been recorded.
        </p>

        {completionCode ? (
          <div className="border-2 border-dashed border-primary-300 dark:border-primary-700 rounded-organic bg-primary-50/40 dark:bg-primary-900/20 p-5 mb-5">
            <p className="text-xs uppercase tracking-wide text-text-secondary dark:text-gray-400 mb-2 text-center">
              Your completion code
            </p>
            <div className="flex items-center justify-center gap-2 mb-3">
              <code className="font-mono font-bold text-lg text-text-primary dark:text-gray-100 break-all select-all">
                {completionCode}
              </code>
              <button
                type="button"
                onClick={copyCode}
                className="p-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 text-text-secondary dark:text-gray-400 transition-colors"
                aria-label="Copy code"
                title="Copy code"
              >
                {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
              </button>
            </div>
            <p className="text-xs text-text-secondary dark:text-gray-400 text-center">
              Completed {completedAt.toLocaleString()}
            </p>
          </div>
        ) : (
          <p className="text-sm text-text-secondary dark:text-gray-500 text-center mb-5">
            Completion code unavailable.
          </p>
        )}

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-organic p-4 mb-6 text-sm text-text-secondary dark:text-gray-300">
          <p className="font-semibold text-text-primary dark:text-gray-100 mb-1">Need credit for this study?</p>
          <p>
            Take a screenshot of this page (or copy the code above) and send it to your instructor as proof of completion.
          </p>
        </div>

        <div className="text-center">
          <a
            href="/"
            className="inline-block text-primary-600 dark:text-primary-400 underline text-sm"
          >
            Return to the Stats Lab home page
          </a>
        </div>
      </div>
    </div>
  )
}
