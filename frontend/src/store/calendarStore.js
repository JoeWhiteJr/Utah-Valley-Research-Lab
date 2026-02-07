import { create } from 'zustand'
import { calendarApi } from '../services/api'

export const useCalendarStore = create((set, get) => ({
  // View state
  selectedDate: new Date(),
  currentView: 'weekly',
  scope: 'lab',
  hourHeight: 60,

  // Data
  events: [],
  categories: [],
  deadlines: [],

  // Filters
  filters: {
    projectId: null,
    categoryId: null,
  },

  // UI state
  editingEvent: null,
  isCreateModalOpen: false,
  createModalTime: null,
  createModalEndTime: null,
  isLoading: false,
  error: null,

  // === View actions ===
  setSelectedDate: (date) => set({ selectedDate: date }),
  setCurrentView: (view) => set({ currentView: view }),
  setScope: (scope) => set({ scope }),

  zoomIn: () => set((state) => ({
    hourHeight: Math.min(120, state.hourHeight + 15)
  })),
  zoomOut: () => set((state) => ({
    hourHeight: Math.max(30, state.hourHeight - 15)
  })),
  resetZoom: () => set({ hourHeight: 60 }),

  setFilters: (filters) => set((state) => ({
    filters: { ...state.filters, ...filters }
  })),

  // === Modal actions ===
  openCreateModal: (time = null, endTime = null) => set({
    isCreateModalOpen: true,
    createModalTime: time,
    createModalEndTime: endTime,
    editingEvent: null,
  }),
  closeCreateModal: () => set({
    isCreateModalOpen: false,
    createModalTime: null,
    createModalEndTime: null,
    editingEvent: null,
  }),
  setEditingEvent: (event) => set({
    editingEvent: event,
    isCreateModalOpen: true,
    createModalTime: null,
    createModalEndTime: null,
  }),

  // === Data actions ===
  fetchEvents: async (start, end, scope) => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await calendarApi.listEvents({
        start: start.toISOString(),
        end: end.toISOString(),
        scope: scope || get().scope,
        project_id: get().filters.projectId,
        category_id: get().filters.categoryId,
      })
      set({ events: data.events, isLoading: false })
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to load events', isLoading: false })
    }
  },

  createEvent: async (eventData) => {
    try {
      const { data } = await calendarApi.createEvent(eventData)
      set((state) => ({ events: [...state.events, data.event] }))
      return data.event
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to create event' })
      return null
    }
  },

  updateEvent: async (id, eventData) => {
    try {
      const { data } = await calendarApi.updateEvent(id, eventData)
      set((state) => ({
        events: state.events.map((e) => e.id === id ? data.event : e)
      }))
      return data.event
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to update event' })
      return null
    }
  },

  deleteEvent: async (id) => {
    try {
      await calendarApi.deleteEvent(id)
      set((state) => ({ events: state.events.filter((e) => e.id !== id) }))
      return true
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to delete event' })
      return false
    }
  },

  moveEvent: async (id, startTime, endTime) => {
    // Optimistic update
    const prev = get().events
    set((state) => ({
      events: state.events.map((e) =>
        e.id === id ? { ...e, start_time: startTime, end_time: endTime } : e
      )
    }))
    try {
      await calendarApi.moveEvent(id, {
        start_time: startTime,
        end_time: endTime,
      })
    } catch (error) {
      set({ events: prev, error: error.response?.data?.error?.message || 'Failed to move event' })
    }
  },

  rsvpEvent: async (eventId, status) => {
    try {
      await calendarApi.rsvp(eventId, status)
      // Refresh events to get updated attendee status
      const state = get()
      const start = new Date(state.selectedDate)
      start.setDate(start.getDate() - 35)
      const end = new Date(state.selectedDate)
      end.setDate(end.getDate() + 35)
      await get().fetchEvents(start, end)
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to RSVP' })
    }
  },

  // === Categories ===
  fetchCategories: async (scope) => {
    try {
      const { data } = await calendarApi.listCategories(scope)
      set({ categories: data.categories })
    } catch {
      /* error handled silently */
    }
  },

  createCategory: async (categoryData) => {
    try {
      const { data } = await calendarApi.createCategory(categoryData)
      set((state) => ({ categories: [...state.categories, data.category] }))
      return data.category
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to create category' })
      return null
    }
  },

  // === Deadlines ===
  fetchDeadlines: async (start, end) => {
    try {
      const { data } = await calendarApi.getDeadlines(
        start.toISOString(),
        end.toISOString()
      )
      set({ deadlines: data.deadlines })
    } catch {
      /* error handled silently */
    }
  },

  // === Helpers ===
  getEventsForDate: (date) => {
    const events = get().events
    const targetDate = new Date(date).toDateString()
    return events.filter((e) => {
      const eventDate = new Date(e.start_time).toDateString()
      return eventDate === targetDate
    })
  },

  clearError: () => set({ error: null }),
}))
