import { useState } from 'react'
import { useStudyStore } from '../../store/studyStore'
import Button from '../../components/Button'

// Placeholder consent text. The IRB-approved final wording must be supplied
// before this study goes live to participants.
const CONSENT_PARAGRAPHS = [
  'You are invited to participate in a research study about decision-making and behavior. The study is being conducted by researchers at Utah Valley University.',
  'If you agree to participate, you will be asked to complete a short interactive task and a brief survey. The session will take about 10–15 minutes.',
  'Participation is voluntary. You may stop at any time by closing this tab without penalty. Your responses are stored anonymously — we do not collect your name or email.',
  'There are no known risks to participating beyond those of normal computer use. There are no direct benefits to you, but your responses will help advance research on human behavior.',
  'If you have questions, contact the research team at the Stats Lab. By clicking "I agree" below you confirm that you are at least 18 years old and consent to participate.',
]

export default function StudyConsent() {
  const { submitConsent, loading, error } = useStudyStore()
  const [agreed, setAgreed] = useState(false)

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-2xl w-full">
        <h1 className="font-display font-bold text-2xl text-text-primary dark:text-gray-100 mb-4">
          Informed Consent
        </h1>
        <div className="prose prose-sm dark:prose-invert max-w-none mb-6 space-y-3 text-text-secondary dark:text-gray-300">
          {CONSENT_PARAGRAPHS.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}
        <label className="flex items-start gap-3 mb-6 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-300"
          />
          <span className="text-sm text-text-primary dark:text-gray-200">
            I am at least 18 years old and I agree to participate in this study.
          </span>
        </label>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => {
              if (window.confirm('Are you sure you want to leave the study?')) {
                window.location.href = '/'
              }
            }}
          >
            Decline
          </Button>
          <Button
            onClick={submitConsent}
            disabled={!agreed}
            loading={loading}
            className="flex-1"
          >
            I agree &mdash; start the task
          </Button>
        </div>
      </div>
    </div>
  )
}
