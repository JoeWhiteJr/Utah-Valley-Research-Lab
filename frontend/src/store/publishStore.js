import { create } from 'zustand'
import { adminApi, publicApi } from '../services/api'

export const usePublishStore = create((set) => ({
  publishedProjects: [],
  publicProjects: [],
  isLoading: false,
  error: null,

  // Admin: fetch all published projects with original data
  fetchPublishedProjects: async () => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await adminApi.getPublishedProjects()
      set({ publishedProjects: data.publishedProjects, isLoading: false })
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to fetch published projects', isLoading: false })
    }
  },

  // Admin: publish a project
  publishProject: async (projectData) => {
    try {
      const { data } = await adminApi.publishProject(projectData)
      set((state) => ({
        publishedProjects: [data.publishedProject, ...state.publishedProjects]
      }))
      return data.publishedProject
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to publish project' })
      return null
    }
  },

  // Admin: update a published project
  updatePublishedProject: async (id, projectData) => {
    try {
      const { data } = await adminApi.updatePublishedProject(id, projectData)
      set((state) => ({
        publishedProjects: state.publishedProjects.map((p) =>
          p.id === id ? { ...p, ...data.publishedProject } : p
        )
      }))
      return data.publishedProject
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to update published project' })
      return null
    }
  },

  // Admin: unpublish a project
  unpublishProject: async (id) => {
    try {
      await adminApi.unpublishProject(id)
      set((state) => ({
        publishedProjects: state.publishedProjects.filter((p) => p.id !== id)
      }))
      return true
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to unpublish project' })
      return false
    }
  },

  // Public: fetch all published projects (no auth)
  fetchPublicProjects: async () => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await publicApi.getProjects()
      set({ publicProjects: data.projects, isLoading: false })
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to fetch projects', isLoading: false })
    }
  },

  clearError: () => set({ error: null })
}))
