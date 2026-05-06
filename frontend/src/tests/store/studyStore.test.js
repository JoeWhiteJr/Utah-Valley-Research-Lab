import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useStudyStore } from '../../store/studyStore'
import { studyApi } from '../../services/api'

vi.mock('../../services/api', () => ({
  studyApi: {
    start: vi.fn(),
    consent: vi.fn(),
    save: vi.fn(),
    snapshot: vi.fn(),
    stats: vi.fn(),
    exportUrl: vi.fn(),
  },
}))

describe('studyStore', () => {
  beforeEach(() => {
    useStudyStore.setState({
      step: 'landing',
      participant_code: null,
      experiment: null,
      condition: null,
      loading: false,
      error: null,
    })
    vi.clearAllMocks()
    sessionStorage.clear()
  })

  it('starts in landing step', () => {
    expect(useStudyStore.getState().step).toBe('landing')
  })

  it('start() advances to consent and stores assignment', async () => {
    studyApi.start.mockResolvedValue({
      data: {
        participant_code: 'TH_123_abcd',
        experiment: 'treasure_hunt',
        condition: 'BASELINE',
      },
    })
    await useStudyStore.getState().start()
    const s = useStudyStore.getState()
    expect(s.participant_code).toBe('TH_123_abcd')
    expect(s.experiment).toBe('treasure_hunt')
    expect(s.condition).toBe('BASELINE')
    expect(s.step).toBe('consent')
    expect(s.loading).toBe(false)
  })

  it('start() captures error message and stays on landing', async () => {
    studyApi.start.mockRejectedValue({
      response: { data: { error: { message: 'rate limited' } } },
    })
    await useStudyStore.getState().start()
    const s = useStudyStore.getState()
    expect(s.error).toBe('rate limited')
    expect(s.step).toBe('landing')
    expect(s.participant_code).toBeNull()
  })

  it('submitConsent() requires an active participant_code', async () => {
    const ok = await useStudyStore.getState().submitConsent({ age: 30 })
    expect(ok).toBe(false)
    expect(useStudyStore.getState().error).toMatch(/no active session/i)
    expect(studyApi.consent).not.toHaveBeenCalled()
  })

  it('submitConsent() POSTs demographics and advances to game', async () => {
    useStudyStore.setState({ participant_code: 'TH_x', step: 'demographics' })
    studyApi.consent.mockResolvedValue({ data: { ok: true } })
    const ok = await useStudyStore.getState().submitConsent({ age: 25 })
    expect(ok).toBe(true)
    expect(studyApi.consent).toHaveBeenCalledWith('TH_x', { age: 25 })
    expect(useStudyStore.getState().step).toBe('game')
  })

  it('markComplete() moves to debrief; finish() moves to done', () => {
    useStudyStore.getState().markComplete()
    expect(useStudyStore.getState().step).toBe('debrief')
    useStudyStore.getState().finish()
    expect(useStudyStore.getState().step).toBe('done')
  })

  it('reset() clears participant state', () => {
    useStudyStore.setState({
      participant_code: 'X',
      experiment: 'treasure_hunt',
      condition: 'BASELINE',
      step: 'done',
    })
    useStudyStore.getState().reset()
    const s = useStudyStore.getState()
    expect(s.participant_code).toBeNull()
    expect(s.experiment).toBeNull()
    expect(s.step).toBe('landing')
  })
})
