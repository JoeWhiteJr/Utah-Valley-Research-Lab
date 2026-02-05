import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

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
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth
export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me')
}

// Projects
export const projectsApi = {
  list: (status) => api.get('/projects', { params: { status } }),
  get: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  delete: (id) => api.delete(`/projects/${id}`)
}

// Actions
export const actionsApi = {
  list: (projectId) => api.get(`/actions/project/${projectId}`),
  create: (projectId, data) => api.post(`/actions/project/${projectId}`, data),
  update: (id, data) => api.put(`/actions/${id}`, data),
  delete: (id) => api.delete(`/actions/${id}`),
  reorder: (items) => api.put('/actions/reorder', { items })
}

// Files
export const filesApi = {
  list: (projectId) => api.get(`/files/project/${projectId}`),
  upload: (projectId, file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`/files/project/${projectId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
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
  updatePreferences: (data) => api.put('/users/preferences', data)
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
  addMembers: (roomId, userIds) =>
    api.post(`/chats/${roomId}/members`, { userIds }),
  removeMember: (roomId, userId) =>
    api.delete(`/chats/${roomId}/members/${userId}`),
  markRead: (roomId) => api.put(`/chats/${roomId}/read`)
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
  getApplicationTrends: () => api.get('/admin/applications/trends')
}

// Notifications
export const notificationsApi = {
  list: ({ limit, offset, unread_only } = {}) =>
    api.get('/notifications', { params: { limit, offset, unread_only } }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
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
    api.post('/ai/summarize-chat', { roomId, messageCount })
}

export default api
