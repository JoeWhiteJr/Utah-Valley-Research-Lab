import { useEffect } from 'react'
import { useStudyStore } from '../store/studyStore'
import StudyLanding from './study/Landing'
import StudyConsent from './study/Consent'
import StudyDemographics from './study/Demographics'
import StudyGameFrame from './study/GameFrame'
import StudyDebrief from './study/Debrief'
import StudyDone from './study/Done'
import StudyProgress from './study/StudyProgress'

// Steps that show the progress bar. `game` is hidden because the iframe owns
// the viewport; `done` is hidden because the study is over.
const STEPS_WITH_PROGRESS = new Set(['landing', 'consent', 'demographics', 'debrief'])

export default function Study() {
  const step = useStudyStore((s) => s.step)

  useEffect(() => {
    document.title = 'Research Study - Stats Lab'
  }, [])

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
