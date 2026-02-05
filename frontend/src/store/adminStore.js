import { create } from 'zustand'
import { adminApi } from '../services/api'

export const useAdminStore = create((set) => ({
  stats: null,
  recentApplications: [],
  auditLog: [],
  auditLogTotal: 0,
  searchResults: [],
  applicationTrends: [],
  isLoading: false,
  error: null,

  fetchStats: async () => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await adminApi.getStats()
      set({
        stats: data.stats,
        recentApplications: data.recentApplications,
        isLoading: false
      })
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to fetch admin stats', isLoading: false })
    }
  },

  fetchAuditLog: async ({ limit, offset, action, entity_type } = {}) => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await adminApi.getAuditLog({ limit, offset, action, entity_type })
      set({
        auditLog: data.auditLog,
        auditLogTotal: data.total,
        isLoading: false
      })
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to fetch audit log', isLoading: false })
    }
  },

  searchUsers: async (q, role) => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await adminApi.searchUsers(q, role)
      set({ searchResults: data.users, isLoading: false })
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to search users', isLoading: false })
    }
  },

  fetchApplicationTrends: async () => {
    try {
      const { data } = await adminApi.getApplicationTrends()
      set({ applicationTrends: data.trends })
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to fetch trends' })
    }
  },

  clearError: () => set({ error: null })
}))
