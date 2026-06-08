import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import StudyDemographics from '../../../pages/study/Demographics'
import { useStudyStore } from '../../../store/studyStore'

vi.mock('../../../services/api', () => ({
  studyApi: {
    start: vi.fn(),
    consent: vi.fn(),
    save: vi.fn(),
    snapshot: vi.fn(),
    finish: vi.fn(),
    stats: vi.fn(),
    exportUrl: vi.fn(),
  },
}))

// Fill in every required field on the demographics form so the Continue
// button is otherwise enabled — we want to isolate the age-validation path.
function fillFormExceptAge() {
  fireEvent.change(screen.getByLabelText(/^Gender$/i), { target: { value: 'Female' } })
  fireEvent.change(screen.getByLabelText(/Race \/ ethnicity/i), { target: { value: 'White' } })
  fireEvent.change(screen.getByLabelText(/Highest level of education/i), {
    target: { value: 'Bachelor’s degree' },
  })
  fireEvent.change(screen.getByLabelText(/Is English your native language/i), {
    target: { value: 'Yes' },
  })
}

describe('StudyDemographics — under-18 error message (P0)', () => {
  let submitDemographicsSpy

  beforeEach(() => {
    submitDemographicsSpy = vi.fn().mockResolvedValue(true)
    useStudyStore.setState({
      step: 'demographics',
      participant_code: 'TH_test_abcd',
      study_slug: 'effort-justification',
      experiment: 'treasure_hunt',
      condition: 'BASELINE',
      loading: false,
      error: null,
      submitDemographics: submitDemographicsSpy,
    })
  })

  it('renders without an error message on initial mount', () => {
    render(<StudyDemographics />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the under-18 error and does NOT advance the store when age is 17', () => {
    render(<StudyDemographics />)
    fireEvent.change(screen.getByLabelText(/^Age$/i), { target: { value: '17' } })
    fillFormExceptAge()
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/18 or older/i)
    expect(submitDemographicsSpy).not.toHaveBeenCalled()
  })

  it('wires aria-invalid and aria-describedby on the age input when an error is shown', () => {
    render(<StudyDemographics />)
    fireEvent.change(screen.getByLabelText(/^Age$/i), { target: { value: '17' } })
    fillFormExceptAge()
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    const ageInput = screen.getByLabelText(/^Age$/i)
    expect(ageInput).toHaveAttribute('aria-invalid', 'true')
    expect(ageInput).toHaveAttribute('aria-describedby', 'age-error')
  })

  it('clears the error when the participant edits the age', () => {
    render(<StudyDemographics />)
    fireEvent.change(screen.getByLabelText(/^Age$/i), { target: { value: '17' } })
    fillFormExceptAge()
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    // Correcting the age should remove the error message immediately so the
    // Continue button becomes interactive again.
    fireEvent.change(screen.getByLabelText(/^Age$/i), { target: { value: '18' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('submits and advances the store when age is 18 and the form is valid', () => {
    render(<StudyDemographics />)
    fireEvent.change(screen.getByLabelText(/^Age$/i), { target: { value: '18' } })
    fillFormExceptAge()
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(submitDemographicsSpy).toHaveBeenCalledTimes(1)
    const payload = submitDemographicsSpy.mock.calls[0][0]
    expect(payload.age).toBe(18)
    expect(payload.gender).toBe('Female')
    expect(payload.ethnicity).toBe('White')
    expect(payload.native_english).toBe('Yes')
  })
})
