import { create } from 'zustand'
import { projectsApi, actionsApi, categoriesApi, filesApi, notesApi, meetingsApi } from '../services/api'

export const useProjectStore = create((set, get) => ({
  projects: [],
  currentProject: null,
  actions: [],
  categories: [],
  files: [],
  notes: [],
  meetings: [],
  members: [],
  membershipStatus: null, // { status: 'member'|'pending'|'none', role?: 'lead'|'member' }
  joinRequests: [],
  isLoading: false,
  error: null,
  uploadProgress: null, // Track file upload progress (0-100 or null when not uploading)
  isUploading: false,

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
      // Add cache-busting timestamp to force browser to reload the new image
      const projectWithCacheBust = {
        ...data.project,
        header_image: data.project.header_image
          ? data.project.header_image + '?t=' + Date.now()
          : data.project.header_image
      }
      set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? { ...p, ...projectWithCacheBust } : p)),
        currentProject: state.currentProject?.id === id
          ? { ...state.currentProject, ...projectWithCacheBust }
          : state.currentProject
      }))
      return projectWithCacheBust
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

  togglePin: async (projectId) => {
    // Optimistic update
    const prev = get().projects
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? { ...p, is_pinned: !p.is_pinned, pinned_at: p.is_pinned ? null : new Date().toISOString() }
          : p
      )
    }))
    try {
      await projectsApi.togglePin(projectId)
    } catch (error) {
      set({ projects: prev, error: error.response?.data?.error?.message || 'Failed to toggle pin' })
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

  // Categories
  fetchCategories: async (projectId) => {
    try {
      const { data } = await categoriesApi.list(projectId)
      set({ categories: data.categories })
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to fetch categories' })
    }
  },

  createCategory: async (projectId, categoryData) => {
    try {
      const { data } = await categoriesApi.create(projectId, categoryData)
      set((state) => ({ categories: [...state.categories, data.category] }))
      return data.category
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to create category' })
      return null
    }
  },

  updateCategory: async (id, categoryData) => {
    try {
      const { data } = await categoriesApi.update(id, categoryData)
      set((state) => ({
        categories: state.categories.map((c) => (c.id === id ? data.category : c))
      }))
      return data.category
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to update category' })
      return null
    }
  },

  deleteCategory: async (id) => {
    try {
      await categoriesApi.delete(id)
      set((state) => ({ categories: state.categories.filter((c) => c.id !== id) }))
      return true
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to delete category' })
      return false
    }
  },

  // Calculate progress based on action items (including subtasks)
  calculateProgress: () => {
    const actions = get().actions
    if (actions.length === 0) return 0
    const completed = actions.filter(a => a.completed).length
    return Math.round((completed / actions.length) * 100)
  },

  // Fetch auto-calculated progress from backend
  fetchProgress: async (projectId) => {
    try {
      const { data } = await actionsApi.getProgress(projectId)
      return data
    } catch (error) {
      return { progress: 0, total_tasks: 0, completed_tasks: 0 }
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
    set({ isUploading: true, uploadProgress: 0 })
    try {
      const { data } = await filesApi.upload(projectId, file, (progress) => {
        set({ uploadProgress: progress })
      })
      set((state) => ({
        files: [data.file, ...state.files],
        isUploading: false,
        uploadProgress: null
      }))
      return data.file
    } catch (error) {
      set({
        error: error.response?.data?.error?.message || 'Failed to upload file',
        isUploading: false,
        uploadProgress: null
      })
      return null
    }
  },

  clearUploadProgress: () => set({ uploadProgress: null, isUploading: false }),

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

  // Members
  fetchMembers: async (projectId) => {
    try {
      const { data } = await projectsApi.getMembers(projectId)
      set({ members: data.members })
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to fetch members' })
    }
  },

  fetchMembershipStatus: async (projectId) => {
    try {
      const { data } = await projectsApi.getMembershipStatus(projectId)
      set({ membershipStatus: data })
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to fetch membership status' })
    }
  },

  requestJoin: async (projectId, message) => {
    try {
      await projectsApi.requestJoin(projectId, message)
      set({ membershipStatus: { status: 'pending' } })
      return true
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to submit join request' })
      return false
    }
  },

  leaveProject: async (projectId) => {
    try {
      await projectsApi.leaveProject(projectId)
      set({ membershipStatus: { status: 'none' } })
      // Re-fetch members
      get().fetchMembers(projectId)
      return true
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to leave project' })
      return false
    }
  },

  fetchJoinRequests: async (projectId) => {
    try {
      const { data } = await projectsApi.getJoinRequests(projectId)
      set({ joinRequests: data.requests })
    } catch {
      // Silently fail - user may not have permission
    }
  },

  addMember: async (projectId, userId) => {
    try {
      await projectsApi.addMember(projectId, userId)
      get().fetchMembers(projectId)
      return true
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to add member' })
      return false
    }
  },

  reviewJoinRequest: async (projectId, reqId, action) => {
    try {
      await projectsApi.reviewJoinRequest(projectId, reqId, action)
      // Re-fetch requests and members
      get().fetchJoinRequests(projectId)
      get().fetchMembers(projectId)
      return true
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to review join request' })
      return false
    }
  },

  clearError: () => set({ error: null }),
  clearCurrentProject: () => set({ currentProject: null, actions: [], categories: [], files: [], notes: [], meetings: [], members: [], membershipStatus: null, joinRequests: [] })
}))
