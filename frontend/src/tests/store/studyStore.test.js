import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useStudyStore } from '../../store/studyStore'
import { studyApi } from '../../services/api'

vi.mock('../../services/api', () => ({
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
    localStorage.clear()
  })

  it('starts in landing step', () => {
    expect(useStudyStore.getState().step).toBe('landing')
  })

  it('start() advances to consent and stores assignment + study metadata', async () => {
    studyApi.start.mockResolvedValue({
      data: {
        participant_code: 'TH_123_abcd',
        study_slug: 'effort-justification',
        study_title: 'Effort Justification & Behavioral Persistence',
        experiment: 'treasure_hunt',
        condition: 'BASELINE',
      },
    })
    await useStudyStore.getState().start()
    const s = useStudyStore.getState()
    expect(studyApi.start).toHaveBeenCalledWith(null)
    expect(s.participant_code).toBe('TH_123_abcd')
    expect(s.study_slug).toBe('effort-justification')
    expect(s.study_title).toBe('Effort Justification & Behavioral Persistence')
    expect(s.experiment).toBe('treasure_hunt')
    expect(s.condition).toBe('BASELINE')
    expect(s.step).toBe('consent')
    expect(s.loading).toBe(false)
  })

  it('start(slug) forwards the slug to the API', async () => {
    studyApi.start.mockResolvedValue({
      data: { participant_code: 'X', experiment: 'e', condition: 'c', study_slug: 'foo' },
    })
    await useStudyStore.getState().start('foo')
    expect(studyApi.start).toHaveBeenCalledWith('foo')
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
    const ok = await useStudyStore.getState().submitConsent()
    expect(ok).toBe(false)
    expect(useStudyStore.getState().error).toMatch(/no active session/i)
    expect(studyApi.consent).not.toHaveBeenCalled()
  })

  it('submitConsent() POSTs consented:true and advances to game', async () => {
    useStudyStore.setState({ participant_code: 'TH_x', step: 'consent' })
    studyApi.consent.mockResolvedValue({ data: { ok: true } })
    const ok = await useStudyStore.getState().submitConsent()
    expect(ok).toBe(true)
    // Must send consented:true so the backend stamps consent_given_at —
    // without it the /finish gate (fix/study-finish-quota-poison) would 403.
    expect(studyApi.consent).toHaveBeenCalledWith('TH_x', { consented: true, demographics: null })
    expect(useStudyStore.getState().step).toBe('game')
  })

  it('submitDemographics() POSTs demographics-only (no consented flag) and advances to debrief', async () => {
    useStudyStore.setState({ participant_code: 'TH_x', step: 'demographics' })
    studyApi.consent.mockResolvedValue({ data: { ok: true } })
    const ok = await useStudyStore.getState().submitDemographics({ age: 25 })
    expect(ok).toBe(true)
    // Demographics POST must NOT include consented:true so a scripted client
    // can't retroactively stamp consent on a participant who skipped the
    // consent screen.
    expect(studyApi.consent).toHaveBeenCalledWith('TH_x', { demographics: { age: 25 } })
    expect(useStudyStore.getState().step).toBe('debrief')
  })

  it('submitDemographics() requires an active participant_code', async () => {
    const ok = await useStudyStore.getState().submitDemographics({ age: 30 })
    expect(ok).toBe(false)
    expect(useStudyStore.getState().error).toMatch(/no active session/i)
    expect(studyApi.consent).not.toHaveBeenCalled()
  })

  it('markComplete() moves to demographics; finish() posts to /finish and moves to done', async () => {
    useStudyStore.setState({ participant_code: 'TH_x' })
    studyApi.finish.mockResolvedValue({ data: { ok: true } })
    useStudyStore.getState().markComplete()
    expect(useStudyStore.getState().step).toBe('demographics')
    await useStudyStore.getState().finish()
    expect(studyApi.finish).toHaveBeenCalledWith('TH_x')
    expect(useStudyStore.getState().step).toBe('done')
  })

  it('finish() still advances UI when /finish errors (debrief already seen)', async () => {
    useStudyStore.setState({ participant_code: 'TH_x', step: 'debrief' })
    studyApi.finish.mockRejectedValue(new Error('network'))
    await useStudyStore.getState().finish()
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
