import { useEffect, useRef, useState, forwardRef } from 'react'
import { useStudyStore } from '../../store/studyStore'
import Button from '../../components/Button'
import ConfirmDialog from '../../components/ConfirmDialog'
import { LOAD_TIMEOUT_MS } from './constants'

const EXPERIMENT_PATH = {
  treasure_hunt: '/study-games/experiment1/index.html',
  career_choice: '/study-games/experiment2/index.html',
  pattern_memory: '/study-games/experiment3/index.html',
}

// Treasure Hunt is a rapid-clicking task; touchscreens haven't been validated.
// Gate on touch-primary devices (matchMedia('(pointer: coarse)')) so iPads —
// which fit a 1024px viewport but still navigate via touch — see the warning.
// A narrow desktop window is *not* a reason to show the warning.
const TOUCH_UNFRIENDLY_EXPERIMENTS = new Set(['treasure_hunt'])

function detectTouchPrimary() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(pointer: coarse)').matches ?? false
}

export default function StudyGameFrame() {
  const { step, participant_code, experiment, condition, markComplete } = useStudyStore()
  const iframeRef = useRef(null)
  const [iframeError, setIframeError] = useState(false)
  const [mobileOverride, setMobileOverride] = useState(false)
  const [isTouchPrimary, setIsTouchPrimary] = useState(detectTouchPrimary())
  const [saveStatus, setSaveStatus] = useState('idle') // idle | saving | saved | error
  const saveStatusTimerRef = useRef(null)
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false)

  // Warn before unloading mid-game so accidental tab closes don't silently end
  // the session. Modern browsers ignore the message string and show their own
  // "Leave site? Changes you made may not be saved" prompt; the returnValue
  // assignment is still required for legacy browsers.
  useEffect(() => {
    if (step !== 'game') return undefined
    const handler = (e) => {
      e.preventDefault()
      e.returnValue = ''
      return ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [step])

  useEffect(() => {
    const handler = (event) => {
      // The iframe is served from the same Vite origin as the parent. Reject
      // anything else so a malicious tab can't postMessage us into completion.
      if (event.origin !== window.location.origin) return
      if (event.source !== iframeRef.current?.contentWindow) return
      const data = event.data
      if (!data || typeof data !== 'object') return
      if (data.type === 'study_complete' && data.participant_code === participant_code) {
        markComplete()
      } else if (data.type === 'study_save') {
        const status = data.status
        if (status === 'saving' || status === 'saved' || status === 'error') {
          setSaveStatus(status)
          // Auto-clear 'saved' after 2s so the UI doesn't stick on it forever.
          if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current)
          if (status === 'saved') {
            saveStatusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000)
          }
        }
      }
    }
    window.addEventListener('message', handler)
    return () => {
      window.removeEventListener('message', handler)
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current)
    }
  }, [participant_code, markComplete])

  useEffect(() => {
    const mq = window.matchMedia?.('(pointer: coarse)')
    if (!mq) return undefined
    const onChange = () => setIsTouchPrimary(mq.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])

  if (!participant_code || !experiment) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 sm:p-8 max-w-md text-center">
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
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 sm:p-8 max-w-md text-center">
          <p className="text-red-600 dark:text-red-400">Unknown experiment: {experiment}</p>
        </div>
      </div>
    )
  }

  const src = `${path}?pid=${encodeURIComponent(participant_code)}&cond=${encodeURIComponent(condition || '')}`

  if (
    TOUCH_UNFRIENDLY_EXPERIMENTS.has(experiment) &&
    isTouchPrimary &&
    !mobileOverride
  ) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 sm:p-8 max-w-md w-full text-center space-y-4">
          <h2 className="font-display font-bold text-xl text-text-primary dark:text-gray-100">
            This task works best on a larger screen
          </h2>
          <p className="text-sm text-text-secondary dark:text-gray-400">
            You&apos;ve been assigned an interactive clicking task that hasn&apos;t been tested on touch devices. For the best experience, please return to this link on a laptop or desktop computer.
          </p>
          <p className="text-xs text-text-secondary dark:text-gray-500">
            Your participant code has been saved — if you reopen this link on a desktop, you&apos;ll resume where you left off.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={() => setMobileOverride(true)} variant="outline" className="w-full">
              Continue anyway
            </Button>
            <a
              href="/"
              className="text-xs text-primary-600 dark:text-primary-400 underline"
            >
              Leave for now
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <div className="flex-1 flex flex-col">
        {iframeError ? (
          <div className="flex items-center justify-center flex-1 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 sm:p-8 max-w-md text-center space-y-4">
              <p className="text-text-secondary dark:text-gray-400">
                The task didn&apos;t load. You can open it directly in a new tab:
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
          <LoadedIframe
            ref={iframeRef}
            src={src}
            onLoadFailure={() => setIframeError(true)}
          />
        )}
      </div>
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center justify-between text-xs text-text-secondary dark:text-gray-400">
        <span className="flex items-center gap-3">
          <span>Participant: {participant_code}</span>
          <SaveIndicator status={saveStatus} />
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLeaveDialogOpen(true)}
        >
          Leave study
        </Button>
        <ConfirmDialog
          isOpen={leaveDialogOpen}
          onClose={() => setLeaveDialogOpen(false)}
          onConfirm={() => { window.location.href = '/' }}
          title="Leave this study?"
          message="Your progress so far has been autosaved. You can return later from the same browser to finish."
          confirmLabel="Leave"
          cancelLabel="Stay"
          variant="danger"
        />
      </div>
    </div>
  )
}

// Forwards ref to the underlying <iframe>. After mount, waits LOAD_TIMEOUT_MS;
// if the inner document doesn't contain a #jspsych-target element (the marker
// every game renders into) by then, treats the load as failed.
// <iframe onError> alone doesn't fire on most failures so we can't rely on it.
const LoadedIframe = forwardRef(function LoadedIframe({ src, onLoadFailure }, parentRef) {
  const innerRef = useRef(null)
  const timerRef = useRef(null)
  const failedRef = useRef(false)

  // Mirror the iframe ref out to the parent so existing event.source checks
  // against `iframeRef.current?.contentWindow` keep working.
  useEffect(() => {
    if (typeof parentRef === 'function') parentRef(innerRef.current)
    else if (parentRef) parentRef.current = innerRef.current
  }, [parentRef])

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      try {
        const doc = innerRef.current?.contentDocument
        const ready = doc?.getElementById?.('jspsych-target') ||
                      doc?.querySelector?.('#app') ||
                      doc?.querySelector?.('[id^="jspsych"]')
        if (!ready && !failedRef.current) {
          failedRef.current = true
          onLoadFailure()
        }
      } catch {
        // Cross-origin frame would block contentDocument access — but our
        // games are same-origin. If access throws here, treat it as a load
        // failure so the participant gets the fallback "open in new tab" UI.
        if (!failedRef.current) {
          failedRef.current = true
          onLoadFailure()
        }
      }
    }, LOAD_TIMEOUT_MS)
    return () => clearTimeout(timerRef.current)
  }, [onLoadFailure])

  return (
    <iframe
      ref={innerRef}
      src={src}
      title="Research task"
      className="flex-1 w-full border-0 bg-white"
      // Defense-in-depth against a compromised CDN dependency. The shim's
      // fetch needs cookies + same-origin so allow-same-origin must stay.
      sandbox="allow-scripts allow-same-origin allow-forms"
      allow="fullscreen"
    />
  )
})

function SaveIndicator({ status }) {
  if (status === 'idle') return null
  if (status === 'saving') {
    return (
      <span className="inline-flex items-center gap-1 text-text-secondary dark:text-gray-500">
        <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
        Saving…
      </span>
    )
  }
  if (status === 'saved') {
    return (
      <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        Saved
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
      Save failed
    </span>
  )
}
