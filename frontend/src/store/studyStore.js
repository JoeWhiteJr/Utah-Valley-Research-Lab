import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { studyApi } from '../services/api'

// Steps the participant moves through. `step` is the source of truth for routing.
// landing → consent → demographics → game → debrief → done
const initialState = {
  step: 'landing',
  participant_code: null,
  study_slug: null,
  study_title: null,
  experiment: null,
  condition: null,
  loading: false,
  error: null,
}

export const useStudyStore = create(
  persist(
    (set, get) => ({
      ...initialState,

      setStep: (step) => set({ step }),

      start: async (slug = null) => {
        set({ loading: true, error: null })
        try {
          const { data } = await studyApi.start(slug)
          set({
            participant_code: data.participant_code,
            study_slug: data.study_slug || null,
            study_title: data.study_title || null,
            experiment: data.experiment,
            condition: data.condition,
            step: 'consent',
            loading: false,
          })
        } catch (err) {
          set({
            loading: false,
            error: err.response?.data?.error?.message || 'Failed to start study',
          })
        }
      },

      // Initial consent submit from the Consent screen. The `consented: true`
      // flag is what tells the backend to stamp consent_given_at — without it
      // the backend will refuse to stamp consent on a demographics-only call,
      // which is what closes the bot-can-skip-consent half of the
      // quota-poisoning chain.
      submitConsent: async () => {
        const { participant_code } = get()
        if (!participant_code) {
          set({ error: 'No active session. Please refresh and try again.' })
          return false
        }
        set({ loading: true, error: null })
        try {
          await studyApi.consent(participant_code, { consented: true, demographics: null })
          set({ step: 'game', loading: false })
          return true
        } catch (err) {
          set({
            loading: false,
            error: err.response?.data?.error?.message || 'Failed to record consent',
          })
          return false
        }
      },

      // Post-game demographics submit. Does NOT include `consented: true` —
      // the backend will reject this call with 409 if consent_given_at is
      // still null (which it can't be on the real flow because the participant
      // already went through submitConsent).
      submitDemographics: async (demographics) => {
        const { participant_code } = get()
        if (!participant_code) {
          set({ error: 'No active session. Please refresh and try again.' })
          return false
        }
        set({ loading: true, error: null })
        try {
          await studyApi.consent(participant_code, { demographics })
          set({ step: 'debrief', loading: false })
          return true
        } catch (err) {
          set({
            loading: false,
            error: err.response?.data?.error?.message || 'Failed to record demographics',
          })
          return false
        }
      },

      markComplete: () => set({ step: 'demographics' }),

      // Final step — called from the Debrief page's Finish button. Posts to
      // /study/finish so the backend marks completed_at NOW (not on /save),
      // then advances UI to done. Network failure still advances the UI: the
      // participant has already seen the debrief, so blocking them on a
      // backend hiccup would be worse than the small bookkeeping gap.
      finish: async () => {
        const { participant_code } = get()
        if (participant_code) {
          try {
            await studyApi.finish(participant_code)
          } catch {
            // Swallow — UI advance is more important than the completed_at write.
          }
        }
        set({ step: 'done' })
      },

      reset: () => set({ ...initialState }),
    }),
    {
      name: 'uvrl-study-session',
      // localStorage instead of sessionStorage so a participant who closes the
      // tab and reopens the link later resumes where they left off. The persisted
      // payload is the participant_code (random, non-PII) + step + study slug —
      // safe to keep across sessions.
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        step: state.step,
        participant_code: state.participant_code,
        study_slug: state.study_slug,
        study_title: state.study_title,
        experiment: state.experiment,
        condition: state.condition,
      }),
    }
  )
)
