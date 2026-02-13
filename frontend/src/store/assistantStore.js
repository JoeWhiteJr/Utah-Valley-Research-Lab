import { create } from 'zustand'
import { assistantApi } from '../services/api'

export const useAssistantStore = create((set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  isOpen: false,
  isLoading: false,
  isSending: false,
  error: null,
  status: null,

  toggleSidebar: () => set((state) => ({ isOpen: !state.isOpen })),
  openSidebar: () => set({ isOpen: true }),
  closeSidebar: () => set({ isOpen: false }),

  checkStatus: async () => {
    try {
      const { data } = await assistantApi.getStatus()
      set({ status: data })
      return data
    } catch {
      set({ status: { available: false, message: 'Failed to check status' } })
      return null
    }
  },

  fetchConversations: async () => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await assistantApi.listConversations()
      set({ conversations: data.conversations, isLoading: false })
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to fetch conversations', isLoading: false })
    }
  },

  createConversation: async (projectId = null) => {
    try {
      const { data } = await assistantApi.createConversation(projectId)
      set((state) => ({
        conversations: [data.conversation, ...state.conversations],
        currentConversation: data.conversation,
        messages: []
      }))
      return data.conversation
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to create conversation' })
      return null
    }
  },

  loadConversation: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await assistantApi.getConversation(id)
      set({
        currentConversation: data.conversation,
        messages: data.messages,
        isLoading: false
      })
      return data
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to load conversation', isLoading: false })
      return null
    }
  },

  sendMessage: async (message) => {
    const { currentConversation } = get()
    if (!currentConversation) return null

    // Optimistic: add user message immediately
    const tempUserMsg = {
      id: 'temp-' + Date.now(),
      conversation_id: currentConversation.id,
      role: 'user',
      content: message,
      created_at: new Date().toISOString()
    }
    set((state) => ({
      messages: [...state.messages, tempUserMsg],
      isSending: true,
      error: null
    }))

    try {
      const { data } = await assistantApi.sendMessage(currentConversation.id, message)

      set((state) => ({
        // Replace temp message with real one, add assistant response
        messages: [
          ...state.messages.filter(m => m.id !== tempUserMsg.id),
          { ...tempUserMsg, id: data.message.id ? undefined : tempUserMsg.id },
          data.message
        ],
        isSending: false,
        // Update conversation title in list
        conversations: state.conversations.map(c =>
          c.id === currentConversation.id
            ? { ...c, updated_at: new Date().toISOString(), last_message: data.message.content }
            : c
        )
      }))

      return data
    } catch (error) {
      set((state) => ({
        // Remove temp message on error
        messages: state.messages.filter(m => m.id !== tempUserMsg.id),
        isSending: false,
        error: error.response?.data?.error?.message || 'Failed to send message'
      }))
      return null
    }
  },

  deleteConversation: async (id) => {
    try {
      await assistantApi.deleteConversation(id)
      set((state) => ({
        conversations: state.conversations.filter(c => c.id !== id),
        currentConversation: state.currentConversation?.id === id ? null : state.currentConversation,
        messages: state.currentConversation?.id === id ? [] : state.messages
      }))
      return true
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to delete conversation' })
      return false
    }
  },

  clearCurrentConversation: () => set({ currentConversation: null, messages: [] }),
  clearError: () => set({ error: null })
}))
