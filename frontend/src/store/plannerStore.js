import { create } from 'zustand'
import { plannerApi } from '../services/api'

export const usePlannerStore = create((set, get) => ({
  // Data
  plan: null,
  steps: [],
  checkin: null,
  weeklyReview: null,
  history: [],
  historyTotal: 0,

  // UI state
  isLoading: false,
  isGenerating: false,
  showCheckin: false,
  error: null,

  // === Data actions ===
  fetchToday: async () => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await plannerApi.getToday()
      set({
        plan: data.plan,
        steps: data.steps || [],
        checkin: data.checkin,
        showCheckin: !!data.checkin,
        isLoading: false,
      })
    } catch (error) {
      set({
        error: error.response?.data?.error?.message || 'Failed to load plan',
        isLoading: false,
      })
    }
  },

  generatePlan: async (force = false) => {
    set({ isGenerating: true, error: null })
    try {
      const { data } = await plannerApi.generate(force)
      set({
        plan: data.plan,
        steps: data.steps || [],
        isGenerating: false,
      })
      // Refresh to pick up any check-in data
      await get().fetchToday()
      return true
    } catch (error) {
      set({
        error: error.response?.data?.error?.message || 'Failed to generate plan',
        isGenerating: false,
      })
      return false
    }
  },

  toggleStep: async (stepId) => {
    // Optimistic update
    const prevSteps = get().steps
    set({
      steps: prevSteps.map(s =>
        s.id === stepId ? { ...s, completed: !s.completed } : s
      ),
    })
    try {
      await plannerApi.toggleStep(stepId)
    } catch (error) {
      // Revert on failure
      set({
        steps: prevSteps,
        error: error.response?.data?.error?.message || 'Failed to update step',
      })
    }
  },

  respondToCheckin: async (responses) => {
    const checkin = get().checkin
    if (!checkin) return
    try {
      await plannerApi.respondToCheckin(checkin.id, responses)
      set({ checkin: null, showCheckin: false })
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to submit check-in' })
    }
  },

  dismissCheckin: async () => {
    const checkin = get().checkin
    if (!checkin) return
    try {
      await plannerApi.dismissCheckin(checkin.id)
      set({ checkin: null, showCheckin: false })
    } catch {
      set({ showCheckin: false })
    }
  },

  fetchWeeklyReview: async () => {
    try {
      const { data } = await plannerApi.getWeeklyReview()
      set({ weeklyReview: data.review })
    } catch {
      /* silent */
    }
  },

  generateWeeklyReview: async () => {
    set({ isGenerating: true, error: null })
    try {
      const { data } = await plannerApi.generateWeeklyReview()
      set({ weeklyReview: data.review, isGenerating: false })
      return true
    } catch (error) {
      set({
        error: error.response?.data?.error?.message || 'Failed to generate weekly review',
        isGenerating: false,
      })
      return false
    }
  },

  fetchHistory: async (limit = 14, offset = 0) => {
    try {
      const { data } = await plannerApi.getHistory({ limit, offset })
      set({ history: data.plans, historyTotal: data.total })
    } catch {
      /* silent */
    }
  },

  clearError: () => set({ error: null }),
}))
