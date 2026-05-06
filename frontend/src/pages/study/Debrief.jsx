// Debrief content draft. Final wording should be reviewed by the research team
// / Festinger-Capaldi study lead before launch.

import { useStudyStore } from '../../store/studyStore'
import Button from '../../components/Button'

const CONDITION_DESCRIPTIONS = {
  treasure_hunt: {
    BASELINE: 'You were assigned to the baseline condition. Each treasure chest required a fixed, moderate number of clicks to open — the standard amount used to compare against the other conditions.',
    HIGH_EFFORT: 'You were assigned to the high-effort condition. Each chest required twice as many clicks as the baseline — a manipulation Festinger’s theory predicts will make participants rationalize their effort by valuing the activity more, and continuing longer when rewards stop.',
    NR_PATTERN: 'You were assigned to the Nothing-Reward (NR) pattern condition. Empty chests preceded rewarded chests in a fixed pattern — Capaldi’s theory predicts this builds the strongest resistance to extinction because participants learn to expect a payoff after each empty chest.',
    RN_PATTERN: 'You were assigned to the Reward-Nothing (RN) pattern condition. Rewarded chests preceded empty chests in a fixed pattern — used as a comparison to the NR pattern to isolate the role of sequence order.',
  },
  career_choice: {
    WITHIN_SUBJECTS: 'You evaluated three hypothetical job offers, each with a different structure for how the company recognizes employees: consistent recognition (regular, predictable), earned recognition (after a period of higher effort), and patterned recognition (in a fixed sequence). The study compares how attractive each style is along a few dimensions.',
  },
  pattern_memory: {
    NR_PATTERN: 'You were assigned to the patterned condition. The card sequence followed an alternating BLANK→ACE pattern. The study measures how quickly people detect patterns and how that affects their predictions and bets.',
    RANDOM: 'You were assigned to the random condition. The card sequence had no underlying pattern — used as a baseline to compare against participants who saw a pattern.',
  },
}

const EXPERIMENT_LABELS = {
  treasure_hunt: 'the Digital Treasure Hunt',
  career_choice: 'the Career Choice Survey',
  pattern_memory: 'the Pattern Memory Challenge',
}

function describeCondition(experiment, condition) {
  return CONDITION_DESCRIPTIONS[experiment]?.[condition] || null
}

export default function StudyDebrief() {
  const { experiment, condition, finish } = useStudyStore()
  const conditionParagraph = describeCondition(experiment, condition)
  const experimentLabel = EXPERIMENT_LABELS[experiment] || 'this study'

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-2xl w-full">
        <h1 className="font-display font-bold text-2xl text-text-primary dark:text-gray-100 mb-2">
          Thank you for participating
        </h1>
        <p className="text-text-secondary dark:text-gray-400 mb-6">
          Your responses have been recorded. Here is what the study was actually about.
        </p>

        <div className="space-y-5 text-sm text-text-secondary dark:text-gray-300 mb-6">
          <section>
            <h2 className="font-semibold text-text-primary dark:text-gray-200 mb-1">
              The research question
            </h2>
            <p>
              This study tests two competing theories of why people keep going at a task even after rewards stop. <strong>Festinger&apos;s Cognitive Dissonance Theory</strong> predicts that people who exerted high effort will continue longer because they justify the effort by deciding the activity was worthwhile. <strong>Capaldi&apos;s Sequential Theory</strong> predicts that people who saw rewards in a particular pattern (specifically, where empty trials reliably preceded rewarded ones) will continue longer because they have learned to expect a payoff after a disappointment.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-text-primary dark:text-gray-200 mb-1">
              What you did
            </h2>
            <p className="mb-2">
              You completed {experimentLabel}.
            </p>
            {conditionParagraph && <p>{conditionParagraph}</p>}
          </section>

          <section>
            <h2 className="font-semibold text-text-primary dark:text-gray-200 mb-1">
              Why we didn&apos;t tell you the design upfront
            </h2>
            <p>
              If participants know which theory the design is testing, they often unconsciously adjust their behavior to match the prediction they think the researchers want. Telling you the manipulation only after the task lets your behavior speak for itself.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-text-primary dark:text-gray-200 mb-1">
              Your data
            </h2>
            <p>
              Your responses are stored anonymously under a randomly assigned participant code. They will be used in aggregate analyses and may appear in published research with no way to identify you. Because no name or email was collected, we cannot remove your individual data after submission &mdash; but we also cannot connect it to you.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-text-primary dark:text-gray-200 mb-1">
              Questions or concerns
            </h2>
            <p>
              Please contact the research team at the UVU Stats Lab. Questions about your rights as a research participant can be directed to the UVU Institutional Review Board.
            </p>
          </section>
        </div>

        <Button onClick={finish} className="w-full" size="lg">
          Finish
        </Button>

        {import.meta.env.DEV && (
          <p className="mt-4 text-xs text-text-secondary dark:text-gray-500">
            (dev) experiment={experiment} condition={condition}
          </p>
        )}
      </div>
    </div>
  )
}
