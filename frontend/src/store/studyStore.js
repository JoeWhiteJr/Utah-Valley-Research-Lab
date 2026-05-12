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

      submitConsent: async () => {
        const { participant_code } = get()
        if (!participant_code) {
          set({ error: 'No active session. Please refresh and try again.' })
          return false
        }
        set({ loading: true, error: null })
        try {
          await studyApi.consent(participant_code, {})
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

      submitDemographics: async (demographics) => {
        const { participant_code } = get()
        if (!participant_code) {
          set({ error: 'No active session. Please refresh and try again.' })
          return false
        }
        set({ loading: true, error: null })
        try {
          await studyApi.consent(participant_code, demographics)
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

      finish: () => set({ step: 'done' }),

      reset: () => set({ ...initialState }),
    }),
    {
      name: 'uvrl-study-session',
      storage: createJSONStorage(() => sessionStorage),
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
