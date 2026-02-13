import { create } from 'zustand'
import { notificationsApi } from '../services/api'

export const useNotificationStore = create((set, _get) => ({
  notifications: [],
  unreadCount: 0,
  unreadCountsByType: {},
  total: 0,
  isLoading: false,
  error: null,

  fetchNotifications: async ({ limit, offset, unread_only } = {}) => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await notificationsApi.list({ limit, offset, unread_only })
      set({
        notifications: data.notifications,
        total: data.total,
        isLoading: false
      })
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to fetch notifications', isLoading: false })
    }
  },

  fetchUnreadCount: async () => {
    try {
      const { data } = await notificationsApi.getUnreadCount()
      set({ unreadCount: data.count })
    } catch (error) {
      // Non-critical, don't set error state
    }
  },

  fetchUnreadCountsByType: async () => {
    try {
      const { data } = await notificationsApi.getUnreadCountsByType()
      set({ unreadCountsByType: data.counts })
    } catch (error) {
      // Non-critical, don't set error state
    }
  },

  markReadByType: async (referenceType) => {
    try {
      await notificationsApi.markReadByType(referenceType)
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.reference_type === referenceType && !n.read_at
            ? { ...n, read_at: new Date().toISOString() }
            : n
        ),
        unreadCountsByType: {
          ...state.unreadCountsByType,
          [referenceType]: 0
        }
      }))
      // Refresh overall unread count
      _get().fetchUnreadCount()
      return true
    } catch (error) {
      return false
    }
  },

  markRead: async (id) => {
    try {
      const { data } = await notificationsApi.markRead(id)
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? data.notification : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1)
      }))
      // Refresh counts by type
      _get().fetchUnreadCountsByType()
      return true
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to mark notification as read' })
      return false
    }
  },

  markAllRead: async () => {
    try {
      await notificationsApi.markAllRead()
      set((state) => ({
        notifications: state.notifications.map((n) => ({
          ...n,
          read_at: n.read_at || new Date().toISOString()
        })),
        unreadCount: 0,
        unreadCountsByType: {}
      }))
      return true
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to mark all as read' })
      return false
    }
  },

  deleteNotification: async (id) => {
    try {
      await notificationsApi.delete(id)
      set((state) => {
        const removed = state.notifications.find((n) => n.id === id)
        return {
          notifications: state.notifications.filter((n) => n.id !== id),
          total: state.total - 1,
          unreadCount: removed && !removed.read_at ? state.unreadCount - 1 : state.unreadCount
        }
      })
      // Refresh counts by type
      _get().fetchUnreadCountsByType()
      return true
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to delete notification' })
      return false
    }
  },

  addNotification: (notification) => {
    set((state) => {
      const newCountsByType = { ...state.unreadCountsByType }
      if (notification.reference_type) {
        newCountsByType[notification.reference_type] = (newCountsByType[notification.reference_type] || 0) + 1
      }
      return {
        notifications: [notification, ...state.notifications],
        unreadCount: state.unreadCount + 1,
        unreadCountsByType: newCountsByType,
        total: state.total + 1
      }
    })
  },

  clearError: () => set({ error: null })
}))
