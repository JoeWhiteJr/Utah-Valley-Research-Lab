import { create } from 'zustand'
import { authApi } from '../services/api'

export const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('token'),
  isLoading: true,
  error: null,
  pendingApproval: false,

  initialize: async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      set({ isLoading: false })
      return
    }

    try {
      const { data } = await authApi.me()
      set({ user: data.user, isLoading: false })
    } catch (error) {
      localStorage.removeItem('token')
      set({ token: null, user: null, isLoading: false })
    }
  },

  login: async (email, password) => {
    set({ error: null, pendingApproval: false })
    try {
      const { data } = await authApi.login({ email, password })
      localStorage.setItem('token', data.token)
      set({ user: { ...data.user, is_super_admin: data.user.is_super_admin || false }, token: data.token })
      return { success: true }
    } catch (error) {
      const errorCode = error.response?.data?.error?.code
      const errorMessage = error.response?.data?.error?.message || 'Login failed'
      if (errorCode === 'ACCOUNT_DELETED') {
        return { success: false, code: 'ACCOUNT_DELETED' }
      }
      if (errorCode === 'PENDING_APPROVAL') {
        set({ error: errorMessage, pendingApproval: true })
      } else {
        set({ error: errorMessage })
      }
      return { success: false }
    }
  },

  register: async (name, email, password) => {
    set({ error: null })
    try {
      const { data } = await authApi.register({ name, email, password })
      localStorage.setItem('token', data.token)
      set({ user: { ...data.user, is_super_admin: data.user.is_super_admin || false }, token: data.token })
      return true
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Registration failed' })
      return false
    }
  },

  logout: async () => {
    try {
      await authApi.logout()
    } catch (error) {
      // Ignore logout errors
    }
    localStorage.removeItem('token')
    set({ user: null, token: null })
  },

  updateUser: (user) => set({ user }),

  clearError: () => set({ error: null, pendingApproval: false })
}))

// Initialize auth on app load
if (typeof window !== 'undefined') {
  useAuthStore.getState().initialize()
}
