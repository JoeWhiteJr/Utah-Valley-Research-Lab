import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import StudyGameFrame from '../../../pages/study/GameFrame'
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

describe('StudyGameFrame beforeunload guard', () => {
  let addSpy
  let removeSpy

  beforeEach(() => {
    addSpy = vi.spyOn(window, 'addEventListener')
    removeSpy = vi.spyOn(window, 'removeEventListener')
    useStudyStore.setState({
      step: 'landing',
      participant_code: null,
      experiment: null,
      condition: null,
      loading: false,
      error: null,
    })
  })

  afterEach(() => {
    addSpy.mockRestore()
    removeSpy.mockRestore()
  })

  it('registers a beforeunload handler while step === "game"', () => {
    useStudyStore.setState({
      step: 'game',
      participant_code: 'TH_test',
      experiment: 'treasure_hunt',
      condition: 'BASELINE',
    })
    render(<StudyGameFrame />)
    const beforeUnloadCalls = addSpy.mock.calls.filter((c) => c[0] === 'beforeunload')
    expect(beforeUnloadCalls).toHaveLength(1)
    expect(typeof beforeUnloadCalls[0][1]).toBe('function')
  })

  it('does NOT register a beforeunload handler when step !== "game"', () => {
    useStudyStore.setState({
      step: 'consent',
      participant_code: 'TH_test',
      experiment: 'treasure_hunt',
      condition: 'BASELINE',
    })
    render(<StudyGameFrame />)
    const beforeUnloadCalls = addSpy.mock.calls.filter((c) => c[0] === 'beforeunload')
    expect(beforeUnloadCalls).toHaveLength(0)
  })

  it('removes the beforeunload handler on unmount', () => {
    useStudyStore.setState({
      step: 'game',
      participant_code: 'TH_test',
      experiment: 'treasure_hunt',
      condition: 'BASELINE',
    })
    const { unmount } = render(<StudyGameFrame />)
    const addedHandler = addSpy.mock.calls.find((c) => c[0] === 'beforeunload')[1]
    unmount()
    const removed = removeSpy.mock.calls.find(
      (c) => c[0] === 'beforeunload' && c[1] === addedHandler
    )
    expect(removed).toBeTruthy()
  })

  it('handler sets returnValue and calls preventDefault for the browser prompt', () => {
    useStudyStore.setState({
      step: 'game',
      participant_code: 'TH_test',
      experiment: 'treasure_hunt',
      condition: 'BASELINE',
    })
    render(<StudyGameFrame />)
    const handler = addSpy.mock.calls.find((c) => c[0] === 'beforeunload')[1]
    const event = { preventDefault: vi.fn(), returnValue: undefined }
    const result = handler(event)
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(event.returnValue).toBe('')
    expect(result).toBe('')
  })
})
