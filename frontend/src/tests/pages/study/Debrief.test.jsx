import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import StudyDebrief from '../../../pages/study/Debrief'
import { useStudyStore } from '../../../store/studyStore'

vi.mock('../../../services/api', () => ({
  studyApi: {
    start: vi.fn(),
    consent: vi.fn(),
    save: vi.fn(),
    snapshot: vi.fn(),
    finish: vi.fn(),
    followUp: vi.fn(),
    stats: vi.fn(),
    exportUrl: vi.fn(),
  },
}))

function resetStore(patch = {}) {
  useStudyStore.setState({
    step: 'debrief',
    participant_code: 'TH_test',
    study_slug: 'effort-justification',
    study_title: 'Effort Justification',
    experiment: 'treasure_hunt',
    condition: 'BASELINE',
    loading: false,
    error: null,
    finishStatus: 'idle',
    finishError: null,
    completedAt: null,
    ...patch,
  })
}

describe('StudyDebrief /finish UI', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
  })

  it('renders the Finish button enabled when finishStatus is idle', () => {
    render(<StudyDebrief />)
    const button = screen.getByRole('button', { name: /finish/i })
    expect(button).not.toBeDisabled()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('disables the Finish button and shows "Saving..." while pending', () => {
    resetStore({ finishStatus: 'pending' })
    render(<StudyDebrief />)
    const button = screen.getByRole('button', { name: /saving/i })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('renders a role="alert" with the error and a Try again button when finishStatus is error', () => {
    resetStore({
      finishStatus: 'error',
      finishError: 'Could not reach server',
    })
    render(<StudyDebrief />)
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert.textContent).toMatch(/Could not reach server/)
    // "Try again" should be a button the participant can re-click.
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    // Finish button is still rendered (not navigated away) so the participant
    // can retry from either spot.
    expect(screen.getByRole('button', { name: /finish/i })).toBeInTheDocument()
  })

  it('does NOT render the alert when finishStatus is success (already advanced to done)', () => {
    resetStore({ finishStatus: 'success' })
    render(<StudyDebrief />)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('StudyDebrief Finish button click behavior', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
  })

  it('disables the Finish button and shows "Saving..." while finish() is in flight', async () => {
    // Replace the store's finish() with a deferred promise so we can observe
    // the in-flight state before resolving.
    let resolveFinish
    const finishPromise = new Promise((resolve) => {
      resolveFinish = resolve
    })
    useStudyStore.setState({
      finish: vi.fn(async () => {
        useStudyStore.setState({ finishStatus: 'pending' })
        await finishPromise
        useStudyStore.setState({ finishStatus: 'success' })
      }),
    })

    render(<StudyDebrief />)
    const finishBtn = screen.getByRole('button', { name: /^finish$/i })
    expect(finishBtn).not.toBeDisabled()

    fireEvent.click(finishBtn)

    // Mid-flight: button is disabled, aria-busy, and shows "Saving..."
    await waitFor(() => {
      const savingBtn = screen.getByRole('button', { name: /saving/i })
      expect(savingBtn).toBeDisabled()
      expect(savingBtn).toHaveAttribute('aria-busy', 'true')
    })

    // Resolve the in-flight finish so the test can clean up.
    await act(async () => {
      resolveFinish()
      await finishPromise
    })
  })

  it('ignores a second click while a finish() is in flight (no double-submit)', async () => {
    const finishSpy = vi.fn(async () => {
      useStudyStore.setState({ finishStatus: 'pending' })
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    useStudyStore.setState({ finish: finishSpy })

    render(<StudyDebrief />)
    const finishBtn = screen.getByRole('button', { name: /^finish$/i })

    fireEvent.click(finishBtn)
    // Wait for the pending state to render so the button is disabled.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled()
    })
    // Click again — the disabled button should swallow it.
    fireEvent.click(screen.getByRole('button', { name: /saving/i }))

    await waitFor(() => {
      expect(finishSpy).toHaveBeenCalledTimes(1)
    })
  })
})
