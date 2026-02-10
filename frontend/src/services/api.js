import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
// Base URL for static files (uploads)
const API_BASE_URL = API_URL.replace('/api', '')

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Helper to get full URL for uploaded files
export const getUploadUrl = (path) => {
  if (!path) return null
  // If already a full URL, return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  // Route chat uploads through the authenticated API endpoint
  if (path.startsWith('/uploads/chat/')) {
    const filename = path.replace('/uploads/chat/', '')
    return `${API_URL}/chats/uploads/${filename}`
  }
  // Prepend the backend base URL
  return `${API_BASE_URL}${path}`
}

// Fetch a chat upload file as an authenticated blob URL
export const fetchAuthenticatedBlobUrl = async (path) => {
  if (!path) return null
  try {
    const response = await api.get(`/chats/uploads/${path.replace('/uploads/chat/', '')}`, {
      responseType: 'blob'
    })
    return URL.createObjectURL(response.data)
  } catch {
    return null
  }
}

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403 && error.response?.data?.error?.code === 'ACCOUNT_DELETED') {
      localStorage.removeItem('token')
      window.location.href = '/access-revoked'
      return Promise.reject(error)
    }
    if (error.response?.status === 401) {
      // Don't redirect on auth endpoints (login/register) to avoid loops
      const url = error.config?.url || ''
      if (!url.includes('/auth/login') && !url.includes('/auth/register')) {
        localStorage.removeItem('token')
        // Use dynamic import to avoid circular dependency
        import('../store/authStore').then(({ useAuthStore }) => {
          useAuthStore.getState().logout()
        })
      }
    }
    return Promise.reject(error)
  }
)

// Auth
export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
}

// Projects
export const projectsApi = {
  list: (status) => api.get('/projects', { params: { status } }),
  get: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  delete: (id) => api.delete(`/projects/${id}`),
  uploadCover: (id, formData) => api.post(`/projects/${id}/cover`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getMembers: (id) => api.get(`/projects/${id}/members`),
  getMembershipStatus: (id) => api.get(`/projects/${id}/membership-status`),
  requestJoin: (id, message) => api.post(`/projects/${id}/join-request`, { message }),
  getJoinRequests: (id) => api.get(`/projects/${id}/join-requests`),
  reviewJoinRequest: (id, reqId, action) => api.put(`/projects/${id}/join-requests/${reqId}`, { action }),
  leaveProject: (id) => api.delete(`/projects/${id}/leave`),
  setLead: (id, userId) => api.put(`/projects/${id}/lead`, { user_id: userId })
}

// Actions
export const actionsApi = {
  my: () => api.get('/actions/my'),
  list: (projectId) => api.get(`/actions/project/${projectId}`),
  create: (projectId, data) => api.post(`/actions/project/${projectId}`, data),
  update: (id, data) => api.put(`/actions/${id}`, data),
  delete: (id) => api.delete(`/actions/${id}`),
  reorder: (items) => api.put('/actions/reorder', { items }),
  setParent: (id, parentTaskId) => api.put(`/actions/${id}/parent`, { parent_task_id: parentTaskId }),
  getProgress: (projectId) => api.get(`/actions/project/${projectId}/progress`)
}

// Categories
export const categoriesApi = {
  list: (projectId) => api.get(`/categories/project/${projectId}`),
  create: (projectId, data) => api.post(`/categories/project/${projectId}`, data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  delete: (id) => api.delete(`/categories/${id}`)
}

// Files
export const filesApi = {
  list: (projectId) => api.get(`/files/project/${projectId}`),
  upload: (projectId, file, onUploadProgress) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`/files/project/${projectId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onUploadProgress
        ? (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            )
            onUploadProgress(percentCompleted)
          }
        : undefined
    })
  },
  download: (id) => api.get(`/files/${id}/download`, { responseType: 'blob' }),
  delete: (id) => api.delete(`/files/${id}`)
}

// Notes
export const notesApi = {
  list: (projectId) => api.get(`/notes/project/${projectId}`),
  get: (id) => api.get(`/notes/${id}`),
  create: (projectId, data) => api.post(`/notes/project/${projectId}`, data),
  update: (id, data) => api.put(`/notes/${id}`, data),
  delete: (id) => api.delete(`/notes/${id}`)
}

// Meetings
export const meetingsApi = {
  list: (projectId) => api.get(`/meetings/project/${projectId}`),
  get: (id) => api.get(`/meetings/${id}`),
  create: (projectId, data, audioFile) => {
    const formData = new FormData()
    formData.append('title', data.title)
    if (data.recorded_at) formData.append('recorded_at', data.recorded_at)
    if (data.notes) formData.append('notes', data.notes)
    if (audioFile) formData.append('audio', audioFile)
    return api.post(`/meetings/project/${projectId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  update: (id, data) => api.put(`/meetings/${id}`, data),
  delete: (id) => api.delete(`/meetings/${id}`),
  transcribe: (id) => api.post(`/meetings/${id}/transcribe`)
}

// Users
export const usersApi = {
  list: () => api.get('/users'),
  team: () => api.get('/users/team'),
  get: (id) => api.get(`/users/${id}`),
  updateProfile: (data) => api.put('/users/profile', data),
  changePassword: (data) => api.put('/users/password', data),
  updateRole: (id, role) => api.put(`/users/${id}/role`, { role }),
  delete: (id) => api.delete(`/users/${id}`),
  getPreferences: () => api.get('/users/preferences'),
  updatePreferences: (data) => api.put('/users/preferences', data),
  getStreak: () => api.get('/users/streak'),
  uploadAvatar: (file) => {
    const formData = new FormData()
    formData.append('avatar', file)
    return api.post('/users/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
}

// Chat
export const chatApi = {
  listRooms: () => api.get('/chats'),
  createRoom: (data) => api.post('/chats', data),
  getRoom: (id) => api.get(`/chats/${id}`),
  getMessages: (roomId, { limit, before } = {}) =>
    api.get(`/chats/${roomId}/messages`, { params: { limit, before } }),
  sendMessage: (roomId, data) => api.post(`/chats/${roomId}/messages`, data),
  deleteMessage: (roomId, messageId) =>
    api.delete(`/chats/${roomId}/messages/${messageId}`),
  editMessage: (roomId, messageId, content) =>
    api.put(`/chats/${roomId}/messages/${messageId}`, { content }),
  addMembers: (roomId, userIds) =>
    api.post(`/chats/${roomId}/members`, { userIds }),
  removeMember: (roomId, userId) =>
    api.delete(`/chats/${roomId}/members/${userId}`),
  markRead: (roomId) => api.put(`/chats/${roomId}/read`),
  deleteRoom: (roomId) => api.delete(`/chats/${roomId}`),
  // Reactions
  toggleReaction: (roomId, messageId, emoji) =>
    api.post(`/chats/${roomId}/messages/${messageId}/reactions`, { emoji }),
  getReactions: (roomId, messageId) =>
    api.get(`/chats/${roomId}/messages/${messageId}/reactions`),
  uploadAudio: (roomId, audioFile, duration) => {
    const formData = new FormData()
    formData.append('audio', audioFile)
    formData.append('duration', String(duration || 0))
    return api.post(`/chats/${roomId}/audio`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  // File upload for chat
  uploadFile: (roomId, file, onUploadProgress) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`/chats/${roomId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onUploadProgress
        ? (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            )
            onUploadProgress(percentCompleted)
          }
        : undefined
    })
  },
  // Push notifications
  pushSubscribe: (subscription) => api.post('/chats/push-subscribe', subscription),
  pushUnsubscribe: (endpoint) => api.post('/chats/push-unsubscribe', { endpoint })
}

// Applications
export const applicationsApi = {
  submit: (data) => api.post('/applications', data),
  list: (status) => api.get('/applications', { params: { status } }),
  get: (id) => api.get(`/applications/${id}`),
  approve: (id, role) => api.put(`/applications/${id}/approve`, { role }),
  reject: (id, reason) => api.put(`/applications/${id}/reject`, { reason }),
  updateNotes: (id, notes) => api.put(`/applications/${id}/notes`, { notes }),
  delete: (id) => api.delete(`/applications/${id}`),
  bulk: (ids, action, reason) =>
    api.post('/applications/bulk', { ids, action, reason })
}

// Admin
export const adminApi = {
  getStats: () => api.get('/admin/stats'),
  getAuditLog: ({ limit, offset, action, entity_type } = {}) =>
    api.get('/admin/audit-log', { params: { limit, offset, action, entity_type } }),
  searchUsers: (q, role) =>
    api.get('/admin/users/search', { params: { q, role } }),
  getApplicationTrends: () => api.get('/admin/applications/trends'),
  getPublishedProjects: () => api.get('/admin/published-projects'),
  publishProject: (data) => api.post('/admin/publish-project', data),
  updatePublishedProject: (id, data) => api.put(`/admin/published-projects/${id}`, data),
  unpublishProject: (id) => api.delete(`/admin/published-projects/${id}`)
}

// Public (no auth)
export const publicApi = {
  getProjects: () => api.get('/public/projects')
}

// Notifications
export const notificationsApi = {
  list: ({ limit, offset, unread_only } = {}) =>
    api.get('/notifications', { params: { limit, offset, unread_only } }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  getUnreadCountsByType: () => api.get('/notifications/unread-counts-by-type'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  delete: (id) => api.delete(`/notifications/${id}`)
}

// AI
export const aiApi = {
  getStatus: () => api.get('/ai/status'),
  chat: (message, context) => api.post('/ai/chat', { message, context }),
  reviewApplication: (applicationId) =>
    api.post('/ai/review-application', { applicationId }),
  summarizeChat: (roomId, messageCount) =>
    api.post('/ai/summarize-chat', { roomId, messageCount }),
  adminSummary: (dateRange) =>
    api.post('/ai/admin-summary', { dateRange }),
  summarizeProject: (projectId) =>
    api.post('/ai/summarize-project', { projectId }),
  summarizeDashboard: () =>
    api.post('/ai/summarize-dashboard')
}

// Calendar
export const calendarApi = {
  listEvents: (params) => api.get('/calendar/events', { params }),
  getEvent: (id) => api.get(`/calendar/events/${id}`),
  createEvent: (data) => api.post('/calendar/events', data),
  updateEvent: (id, data) => api.put(`/calendar/events/${id}`, data),
  deleteEvent: (id) => api.delete(`/calendar/events/${id}`),
  moveEvent: (id, data) => api.patch(`/calendar/events/${id}/move`, data),
  listCategories: (scope) => api.get('/calendar/categories', { params: { scope } }),
  createCategory: (data) => api.post('/calendar/categories', data),
  updateCategory: (id, data) => api.put(`/calendar/categories/${id}`, data),
  deleteCategory: (id) => api.delete(`/calendar/categories/${id}`),
  rsvp: (eventId, status) => api.post(`/calendar/events/${eventId}/attend`, { status }),
  getDeadlines: (start, end) => api.get('/calendar/events/deadlines', { params: { start, end } }),
}

// Search
export const searchApi = {
  search: (q) => api.get('/search', { params: { q } })
}

// Comments
export const commentsApi = {
  list: (actionId) => api.get(`/comments/actions/${actionId}/comments`),
  create: (actionId, content) => api.post(`/comments/actions/${actionId}/comments`, { content }),
  delete: (actionId, commentId) => api.delete(`/comments/actions/${actionId}/comments/${commentId}`),
  counts: (projectId) => api.get(`/comments/project/${projectId}/comment-counts`)
}

// Activity
export const activityApi = {
  list: (params) => api.get('/activity', { params })
}

export default api
