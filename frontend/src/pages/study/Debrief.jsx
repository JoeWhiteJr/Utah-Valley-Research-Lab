import { useStudyStore } from '../../store/studyStore'
import Button from '../../components/Button'

export default function StudyDebrief() {
  const { experiment, finish } = useStudyStore()

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-2xl w-full">
        <h1 className="font-display font-bold text-2xl text-text-primary dark:text-gray-100 mb-3">
          Thank you for participating
        </h1>
        <p className="text-text-secondary dark:text-gray-400 mb-4">
          Your responses have been recorded.
        </p>
        <div className="bg-gray-50 dark:bg-gray-700/40 rounded-organic p-4 mb-6 space-y-3 text-sm text-text-secondary dark:text-gray-300">
          <p>
            <strong>What this study was about:</strong> Researchers are studying how the structure of feedback during a task affects how persistent people are when rewards stop. The full debriefing materials will be supplied by the research team prior to launch.
          </p>
          <p>
            <strong>Your data:</strong> Your responses are stored anonymously, identified only by a randomly assigned participant code. They will be used in aggregate analyses and may be shared in published research without any way to identify you.
          </p>
          <p>
            <strong>Questions or concerns?</strong> Contact the research team via the Stats Lab contact page.
          </p>
        </div>
        <Button onClick={finish} className="w-full" size="lg">
          Finish
        </Button>
        {import.meta.env.DEV && (
          <p className="mt-4 text-xs text-text-secondary dark:text-gray-500">
            (dev) experiment was: {experiment}
          </p>
        )}
      </div>
    </div>
  )
}
