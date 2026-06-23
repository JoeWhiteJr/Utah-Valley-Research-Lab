import { useStudyStore } from '../../store/studyStore'
import Button from '../../components/Button'
import { RotateCcw, ArrowRight } from 'lucide-react'

const STEP_LABEL = {
  consent: 'the informed consent page',
  demographics: 'the demographics survey',
  game: 'the interactive task',
  debrief: 'the debrief page',
}

export default function StudyWelcomeBack({ onDismiss }) {
  const { step, study_title, reset } = useStudyStore()
  const where = STEP_LABEL[step] || 'where you left off'

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 sm:p-8 max-w-md w-full">
        <h1 className="font-display font-bold text-2xl text-text-primary dark:text-gray-100 mb-2">
          Welcome back
        </h1>
        <p className="text-text-secondary dark:text-gray-400 text-sm mb-6">
          {study_title ? (
            <>You have a study in progress: <strong>{study_title}</strong>.</>
          ) : (
            <>You have a study in progress.</>
          )}{' '}
          We saved your spot at {where}.
        </p>

        <div className="flex flex-col gap-2">
          <Button onClick={onDismiss} size="lg" className="w-full">
            Resume where I left off
            <ArrowRight size={16} />
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              reset()
              onDismiss()
            }}
            className="w-full"
          >
            <RotateCcw size={14} />
            Start over with a new session
          </Button>
        </div>

        <p className="text-xs text-text-secondary dark:text-gray-500 mt-4">
          Starting over will discard your previous participant code. Once your
          responses are submitted, they cannot be retrieved this way.
        </p>
      </div>
    </div>
  )
}
