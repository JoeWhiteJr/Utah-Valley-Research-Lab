// DRAFT consent text. Final IRB-approved wording must be reviewed by the IRB
// before launch. Sections follow common-rule template (Purpose, Procedures,
// Risks, Benefits, Confidentiality, Voluntary Participation, Contact, Age).

import { useEffect, useRef, useState } from 'react'
import { useStudyStore } from '../../store/studyStore'
import Button from '../../components/Button'

const HONEYPOT_OOPS = 'Something went wrong. Please refresh this page and try again.'

const CONSENT_SECTIONS = [
  {
    heading: 'Purpose',
    body: 'You are invited to take part in a research study on decision-making and persistence. The study is being conducted by researchers at Utah Valley University.',
  },
  {
    heading: 'Procedures',
    body: 'You will complete one short interactive task on this device, followed by a brief survey. The full session takes about 10–15 minutes. There will be at most one task — you will not be asked to come back later.',
  },
  {
    heading: 'Risks',
    body: 'There are no risks to you beyond those of normal computer use. The task is designed to be engaging and is not stressful.',
  },
  {
    heading: 'Benefits',
    body: 'There is no direct benefit to you. Your participation helps researchers better understand how people respond to feedback during structured tasks.',
  },
  {
    heading: 'Confidentiality',
    body: 'Your responses are stored anonymously under a randomly assigned participant code. We do not collect your name, email, or any other identifying information. We do record a one-way hash of your network address (used only to prevent duplicate submissions — the address itself is never stored).',
  },
  {
    heading: 'Voluntary Participation',
    body: 'Participation is entirely voluntary. You may stop at any time by closing this tab; you will not be penalized. Once your responses are submitted we cannot remove your individual data because we have no way to identify which row was yours.',
  },
  {
    heading: 'Contact',
    body: 'If you have questions or concerns about the study, please contact the research team at the UVU Stats Lab. Questions about your rights as a research participant can be directed to the UVU Institutional Review Board.',
  },
  {
    heading: 'Age',
    body: 'You must be at least 18 years old to participate.',
  },
]

const MIN_CONSENT_TIME_MS = 3000

export default function StudyConsent() {
  const { submitConsent, loading, error } = useStudyStore()
  const [agreed, setAgreed] = useState(false)
  const [honeypot, setHoneypot] = useState('')
  const [localError, setLocalError] = useState(null)
  const arrivedAt = useRef(Date.now())

  useEffect(() => {
    arrivedAt.current = Date.now()
  }, [])

  const handleAgree = () => {
    if (honeypot) {
      // Surface a friendly error instead of silently dropping the click — a real
      // participant whose autofill tripped the trap shouldn't be left stranded
      // wondering why "I agree" did nothing.
      console.warn('study: honeypot filled, blocking consent submission')
      setLocalError(HONEYPOT_OOPS)
      return
    }
    const elapsed = Date.now() - arrivedAt.current
    if (elapsed < MIN_CONSENT_TIME_MS) {
      console.warn(`study: consent submitted in ${elapsed}ms (< ${MIN_CONSENT_TIME_MS}ms minimum), blocking`)
      setLocalError('Please take a moment to read the consent text before agreeing.')
      return
    }
    setLocalError(null)
    submitConsent()
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-2xl w-full">
        <h1 className="font-display font-bold text-2xl text-text-primary dark:text-gray-100 mb-2">
          Informed Consent
        </h1>
        <p className="text-xs uppercase tracking-wide text-text-secondary dark:text-gray-500 mb-6">
          Please read carefully before agreeing
        </p>
        <div className="max-w-none mb-6 space-y-4 text-sm text-text-secondary dark:text-gray-300">
          {CONSENT_SECTIONS.map((section) => (
            <div key={section.heading}>
              <h2 className="font-semibold text-text-primary dark:text-gray-200 mb-1">
                {section.heading}
              </h2>
              <p>{section.body}</p>
            </div>
          ))}
        </div>
        {(error || localError) && (
          <div
            className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400 text-sm"
            role="alert"
            aria-live="polite"
          >
            {localError || error}
          </div>
        )}
        {/* Honeypot — humans don't see or focus this. Bots typically fill all
            inputs. The wrapping div is aria-hidden + inert so assistive tech
            doesn't expose this input via the forms rotor. */}
        <div
          aria-hidden="true"
          // @ts-ignore: inert is a valid HTML attribute; older React types miss it.
          inert=""
          style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}
        >
          <label htmlFor="study-consent-hp">Company URL (leave blank)</label>
          <input
            id="study-consent-hp"
            type="text"
            name="company_url"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>
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
            onClick={handleAgree}
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
