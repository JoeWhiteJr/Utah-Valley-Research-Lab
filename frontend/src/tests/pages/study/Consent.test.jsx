import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import StudyConsent from '../../../pages/study/Consent'
import { useStudyStore } from '../../../store/studyStore'

vi.mock('../../../services/api', () => ({
  studyApi: {
    start: vi.fn(),
    consent: vi.fn(),
    save: vi.fn(),
    snapshot: vi.fn(),
    stats: vi.fn(),
    exportUrl: vi.fn(),
  },
}))

function resetStore(patch = {}) {
  useStudyStore.setState({
    step: 'consent',
    participant_code: 'TH_test',
    experiment: 'treasure_hunt',
    condition: 'BASELINE',
    loading: false,
    error: null,
    submitConsent: vi.fn(),
    ...patch,
  })
}

describe('StudyConsent Decline ConfirmDialog', () => {
  beforeEach(() => {
    resetStore()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('opens the ConfirmDialog when "Decline" is clicked', () => {
    render(<StudyConsent />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^decline$/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Decline to participate?')).toBeInTheDocument()
  })

  it('closes the dialog without navigating when "Go back" is clicked', () => {
    const hrefSpy = vi.fn()
    vi.stubGlobal('location', { ...window.location, set href(v) { hrefSpy(v) } })

    render(<StudyConsent />)
    fireEvent.click(screen.getByRole('button', { name: /^decline$/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /go back/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(hrefSpy).not.toHaveBeenCalled()
  })

  it('navigates to "/" when "Decline" is confirmed in the dialog', () => {
    const hrefSpy = vi.fn()
    vi.stubGlobal('location', { ...window.location, set href(v) { hrefSpy(v) } })

    render(<StudyConsent />)
    fireEvent.click(screen.getByRole('button', { name: /^decline$/i }))
    // Both the trigger button and the dialog confirm share the label "Decline".
    // Target the one inside the dialog.
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /^decline$/i }))
    expect(hrefSpy).toHaveBeenCalledWith('/')
  })

  it('does not invoke submitConsent when Decline trigger is clicked', () => {
    const submitConsentSpy = vi.fn()
    resetStore({ submitConsent: submitConsentSpy })
    render(<StudyConsent />)
    fireEvent.click(screen.getByRole('button', { name: /^decline$/i }))
    expect(submitConsentSpy).not.toHaveBeenCalled()
  })
})
