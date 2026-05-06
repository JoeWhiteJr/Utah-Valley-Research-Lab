import { useStudyStore } from '../../store/studyStore'
import Button from '../../components/Button'

export default function StudyLanding() {
  const { start, loading, error } = useStudyStore()

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-2xl w-full">
        <h1 className="font-display font-bold text-3xl text-text-primary dark:text-gray-100 mb-3">
          Research Study
        </h1>
        <p className="text-text-secondary dark:text-gray-400 mb-4">
          Thank you for your interest in participating. This is a research study on decision-making and behavior.
        </p>
        <div className="bg-gray-50 dark:bg-gray-700/40 rounded-organic p-4 mb-6 space-y-2 text-sm text-text-secondary dark:text-gray-300">
          <p><strong>Estimated time:</strong> 10–15 minutes</p>
          <p><strong>Participation:</strong> Anonymous &mdash; no name or email required.</p>
          <p><strong>Device:</strong> A laptop or desktop is recommended for the best experience.</p>
          <p><strong>Audio:</strong> Not required.</p>
        </div>
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}
        <Button onClick={start} loading={loading} size="lg" className="w-full">
          Begin Study
        </Button>
        <p className="mt-4 text-xs text-text-secondary dark:text-gray-500">
          By clicking &ldquo;Begin Study&rdquo; you will be assigned to one of three short tasks. You can stop at any time by closing this tab.
        </p>
      </div>
    </div>
  )
}
