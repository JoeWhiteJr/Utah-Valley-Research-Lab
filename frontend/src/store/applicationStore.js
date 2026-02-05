import { create } from 'zustand'
import { applicationsApi, aiApi } from '../services/api'

export const useApplicationStore = create((set) => ({
  applications: [],
  currentApplication: null,
  aiReview: null,
  isLoading: false,
  error: null,

  fetchApplications: async (status) => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await applicationsApi.list(status)
      set({ applications: data.applications, isLoading: false })
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to fetch applications', isLoading: false })
    }
  },

  fetchApplication: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await applicationsApi.get(id)
      set({ currentApplication: data.application, isLoading: false })
      return data.application
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to fetch application', isLoading: false })
      return null
    }
  },

  submitApplication: async (applicationData) => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await applicationsApi.submit(applicationData)
      set({ isLoading: false })
      return data.application
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to submit application', isLoading: false })
      return null
    }
  },

  approveApplication: async (id, role) => {
    try {
      const { data } = await applicationsApi.approve(id, role)
      set((state) => ({
        applications: state.applications.map((a) =>
          a.id === id ? { ...a, status: 'approved' } : a
        ),
        currentApplication: state.currentApplication?.id === id
          ? { ...state.currentApplication, status: 'approved' }
          : state.currentApplication
      }))
      return data
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to approve application' })
      return null
    }
  },

  rejectApplication: async (id, reason) => {
    try {
      const { data } = await applicationsApi.reject(id, reason)
      set((state) => ({
        applications: state.applications.map((a) =>
          a.id === id ? data.application : a
        ),
        currentApplication: state.currentApplication?.id === id
          ? data.application
          : state.currentApplication
      }))
      return data.application
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to reject application' })
      return null
    }
  },

  updateNotes: async (id, notes) => {
    try {
      const { data } = await applicationsApi.updateNotes(id, notes)
      set((state) => ({
        applications: state.applications.map((a) =>
          a.id === id ? data.application : a
        ),
        currentApplication: state.currentApplication?.id === id
          ? data.application
          : state.currentApplication
      }))
      return data.application
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to update notes' })
      return null
    }
  },

  deleteApplication: async (id) => {
    try {
      await applicationsApi.delete(id)
      set((state) => ({
        applications: state.applications.filter((a) => a.id !== id),
        currentApplication: state.currentApplication?.id === id ? null : state.currentApplication
      }))
      return true
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to delete application' })
      return false
    }
  },

  bulkAction: async (ids, action, reason) => {
    try {
      const { data } = await applicationsApi.bulk(ids, action, reason)
      // Refresh the list after bulk action
      const statusToRefresh = action === 'approve' ? 'approved' : 'rejected'
      set((state) => ({
        applications: state.applications.map((a) =>
          ids.includes(a.id) && data.results.success.find((s) => s.id === a.id)
            ? { ...a, status: statusToRefresh }
            : a
        )
      }))
      return data.results
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to perform bulk action' })
      return null
    }
  },

  requestAiReview: async (applicationId) => {
    set({ aiReview: null })
    try {
      const { data } = await aiApi.reviewApplication(applicationId)
      set({ aiReview: data.review })
      return data.review
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to get AI review' })
      return null
    }
  },

  clearCurrentApplication: () => set({ currentApplication: null, aiReview: null }),
  clearError: () => set({ error: null })
}))
