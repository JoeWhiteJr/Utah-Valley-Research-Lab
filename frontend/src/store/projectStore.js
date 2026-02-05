import { create } from 'zustand'
import { projectsApi, actionsApi, filesApi, notesApi, meetingsApi } from '../services/api'

export const useProjectStore = create((set, get) => ({
  projects: [],
  currentProject: null,
  actions: [],
  files: [],
  notes: [],
  meetings: [],
  isLoading: false,
  error: null,

  // Projects
  fetchProjects: async (status) => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await projectsApi.list(status)
      set({ projects: data.projects, isLoading: false })
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to fetch projects', isLoading: false })
    }
  },

  fetchProject: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await projectsApi.get(id)
      set({ currentProject: data.project, isLoading: false })
      return data.project
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to fetch project', isLoading: false })
      return null
    }
  },

  createProject: async (projectData) => {
    try {
      const { data } = await projectsApi.create(projectData)
      set((state) => ({ projects: [data.project, ...state.projects] }))
      return data.project
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to create project' })
      return null
    }
  },

  updateProject: async (id, projectData) => {
    try {
      const { data } = await projectsApi.update(id, projectData)
      set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? data.project : p)),
        currentProject: state.currentProject?.id === id ? data.project : state.currentProject
      }))
      return data.project
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to update project' })
      return null
    }
  },

  uploadCover: async (id, file) => {
    try {
      const formData = new FormData()
      formData.append('cover', file)
      const { data } = await projectsApi.uploadCover(id, formData)
      set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? data.project : p)),
        currentProject: state.currentProject?.id === id ? data.project : state.currentProject
      }))
      return data.project
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to upload cover image' })
      return null
    }
  },

  deleteProject: async (id) => {
    try {
      await projectsApi.delete(id)
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        currentProject: state.currentProject?.id === id ? null : state.currentProject
      }))
      return true
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to delete project' })
      return false
    }
  },

  // Actions
  fetchActions: async (projectId) => {
    try {
      const { data } = await actionsApi.list(projectId)
      set({ actions: data.actions })
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to fetch actions' })
    }
  },

  createAction: async (projectId, actionData) => {
    try {
      const { data } = await actionsApi.create(projectId, actionData)
      set((state) => ({ actions: [...state.actions, data.action] }))
      return data.action
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to create action' })
      return null
    }
  },

  updateAction: async (id, actionData) => {
    try {
      const { data } = await actionsApi.update(id, actionData)
      set((state) => ({
        actions: state.actions.map((a) => (a.id === id ? data.action : a))
      }))
      return data.action
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to update action' })
      return null
    }
  },

  deleteAction: async (id) => {
    try {
      await actionsApi.delete(id)
      set((state) => ({ actions: state.actions.filter((a) => a.id !== id) }))
      return true
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to delete action' })
      return false
    }
  },

  reorderActions: async (items) => {
    const prevActions = get().actions
    // Optimistic update
    set((state) => ({
      actions: items.map((item, index) => ({
        ...state.actions.find((a) => a.id === item.id),
        sort_order: index
      }))
    }))
    try {
      await actionsApi.reorder(items.map((item, index) => ({ id: item.id, sort_order: index })))
    } catch (error) {
      set({ actions: prevActions, error: 'Failed to reorder actions' })
    }
  },

  // Files
  fetchFiles: async (projectId) => {
    try {
      const { data } = await filesApi.list(projectId)
      set({ files: data.files })
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to fetch files' })
    }
  },

  uploadFile: async (projectId, file) => {
    try {
      const { data } = await filesApi.upload(projectId, file)
      set((state) => ({ files: [data.file, ...state.files] }))
      return data.file
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to upload file' })
      return null
    }
  },

  deleteFile: async (id) => {
    try {
      await filesApi.delete(id)
      set((state) => ({ files: state.files.filter((f) => f.id !== id) }))
      return true
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to delete file' })
      return false
    }
  },

  // Notes
  fetchNotes: async (projectId) => {
    try {
      const { data } = await notesApi.list(projectId)
      set({ notes: data.notes })
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to fetch notes' })
    }
  },

  createNote: async (projectId, noteData) => {
    try {
      const { data } = await notesApi.create(projectId, noteData)
      set((state) => ({ notes: [data.note, ...state.notes] }))
      return data.note
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to create note' })
      return null
    }
  },

  updateNote: async (id, noteData) => {
    try {
      const { data } = await notesApi.update(id, noteData)
      set((state) => ({
        notes: state.notes.map((n) => (n.id === id ? data.note : n))
      }))
      return data.note
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to update note' })
      return null
    }
  },

  deleteNote: async (id) => {
    try {
      await notesApi.delete(id)
      set((state) => ({ notes: state.notes.filter((n) => n.id !== id) }))
      return true
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to delete note' })
      return false
    }
  },

  // Meetings
  fetchMeetings: async (projectId) => {
    try {
      const { data } = await meetingsApi.list(projectId)
      set({ meetings: data.meetings })
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to fetch meetings' })
    }
  },

  createMeeting: async (projectId, meetingData, audioFile) => {
    try {
      const { data } = await meetingsApi.create(projectId, meetingData, audioFile)
      set((state) => ({ meetings: [data.meeting, ...state.meetings] }))
      return data.meeting
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to create meeting' })
      return null
    }
  },

  updateMeeting: async (id, meetingData) => {
    try {
      const { data } = await meetingsApi.update(id, meetingData)
      set((state) => ({
        meetings: state.meetings.map((m) => (m.id === id ? data.meeting : m))
      }))
      return data.meeting
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to update meeting' })
      return null
    }
  },

  deleteMeeting: async (id) => {
    try {
      await meetingsApi.delete(id)
      set((state) => ({ meetings: state.meetings.filter((m) => m.id !== id) }))
      return true
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to delete meeting' })
      return false
    }
  },

  clearError: () => set({ error: null }),
  clearCurrentProject: () => set({ currentProject: null, actions: [], files: [], notes: [], meetings: [] })
}))
