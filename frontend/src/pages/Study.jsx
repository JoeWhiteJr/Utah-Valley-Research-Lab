import { useEffect, useState } from 'react'
import { useStudyStore } from '../store/studyStore'
import StudyLanding from './study/Landing'
import StudyConsent from './study/Consent'
import StudyDemographics from './study/Demographics'
import StudyGameFrame from './study/GameFrame'
import StudyDebrief from './study/Debrief'
import StudyDone from './study/Done'
import StudyProgress from './study/StudyProgress'
import StudyWelcomeBack from './study/WelcomeBack'

// Steps that show the progress bar. `game` is hidden because the iframe owns
// the viewport; `done` is hidden because the study is over.
const STEPS_WITH_PROGRESS = new Set(['landing', 'consent', 'demographics', 'debrief'])
const RESUMABLE_STEPS = new Set(['consent', 'demographics', 'game', 'debrief'])

export default function Study() {
  const { step, participant_code } = useStudyStore()
  // True only on first mount when the hydrated store already has progress.
  // The participant must explicitly choose Resume or Start over before we
  // render their persisted step, so it doesn't look like a broken page.
  const [needsWelcomeBack, setNeedsWelcomeBack] = useState(
    () => RESUMABLE_STEPS.has(step) && !!participant_code
  )

  useEffect(() => {
    document.title = 'Research Study - Stats Lab'
  }, [])

  if (needsWelcomeBack) {
    return (
      <div className="min-h-screen bg-background dark:bg-gray-900">
        <StudyWelcomeBack onDismiss={() => setNeedsWelcomeBack(false)} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900">
      {STEPS_WITH_PROGRESS.has(step) && <StudyProgress step={step} />}
      {step === 'landing' && <StudyLanding />}
      {step === 'consent' && <StudyConsent />}
      {step === 'demographics' && <StudyDemographics />}
      {step === 'game' && <StudyGameFrame />}
      {step === 'debrief' && <StudyDebrief />}
      {step === 'done' && <StudyDone />}
    </div>
  )
}
