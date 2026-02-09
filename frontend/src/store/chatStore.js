import { create } from 'zustand'
import { chatApi, aiApi } from '../services/api'
import { useAuthStore } from './authStore'

export const useChatStore = create((set, get) => ({
  rooms: [],
  currentRoom: null,
  messages: [],
  readReceipts: [],
  hasMore: false,
  isLoading: false,
  error: null,

  // Rooms
  fetchRooms: async () => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await chatApi.listRooms()
      set({ rooms: data.rooms, isLoading: false })
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to fetch chat rooms', isLoading: false })
    }
  },

  createRoom: async (type, memberIds, name) => {
    try {
      const { data } = await chatApi.createRoom({ type, memberIds, name })
      if (!data.existing) {
        set((state) => ({ rooms: [data.room, ...state.rooms] }))
      }
      return data.room
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to create chat room' })
      return null
    }
  },

  fetchRoom: async (id) => {
    try {
      const { data } = await chatApi.getRoom(id)
      set({ currentRoom: data.room })
      return data.room
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to fetch room' })
      return null
    }
  },

  // Messages
  fetchMessages: async (roomId, { limit, before } = {}) => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await chatApi.getMessages(roomId, { limit, before })
      if (before) {
        set((state) => ({
          messages: [...data.messages, ...state.messages],
          hasMore: data.hasMore,
          readReceipts: data.read_receipts || state.readReceipts,
          isLoading: false
        }))
      } else {
        set({ messages: data.messages, hasMore: data.hasMore, readReceipts: data.read_receipts || [], isLoading: false })
      }
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to fetch messages', isLoading: false })
    }
  },

  sendMessage: async (roomId, content, type = 'text', fileData, replyToId) => {
    try {
      const payload = { content, type }
      if (fileData) {
        payload.file_url = fileData.url
        payload.file_name = fileData.name
      }
      if (replyToId) {
        payload.reply_to_id = replyToId
      }
      const { data } = await chatApi.sendMessage(roomId, payload)
      return data.message
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to send message' })
      return null
    }
  },

  deleteMessage: async (roomId, messageId) => {
    try {
      await chatApi.deleteMessage(roomId, messageId)
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === messageId ? { ...m, content: 'Message deleted', deleted_at: new Date().toISOString() } : m
        )
      }))
      return true
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to delete message' })
      return false
    }
  },

  deleteRoom: async (roomId) => {
    try {
      await chatApi.deleteRoom(roomId)
      set((state) => ({
        rooms: state.rooms.filter((r) => r.id !== roomId),
        currentRoom: state.currentRoom?.id === roomId ? null : state.currentRoom,
        messages: state.currentRoom?.id === roomId ? [] : state.messages,
      }))
      return true
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to delete room' })
      return false
    }
  },

  // Members
  addMembers: async (roomId, userIds) => {
    try {
      await chatApi.addMembers(roomId, userIds)
      await get().fetchRoom(roomId)
      return true
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to add members' })
      return false
    }
  },

  removeMember: async (roomId, userId) => {
    try {
      await chatApi.removeMember(roomId, userId)
      if (get().currentRoom?.id === roomId) {
        await get().fetchRoom(roomId)
      }
      return true
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to remove member' })
      return false
    }
  },

  markRead: async (roomId) => {
    try {
      await chatApi.markRead(roomId)
      set((state) => ({
        rooms: state.rooms.map((r) =>
          r.id === roomId ? { ...r, unread_count: 0 } : r
        )
      }))
    } catch (error) {
      // Non-critical, don't set error state
    }
  },

  // Socket event handlers
  onNewMessage: (message) => {
    const { currentRoom } = get()
    const currentUserId = useAuthStore.getState().user?.id
    const isOwnMessage = message.sender_id === currentUserId
    const isCurrentRoom = currentRoom && message.room_id === currentRoom.id

    if (isCurrentRoom) {
      set((state) => ({ messages: [...state.messages, message] }))
    }

    set((state) => {
      const updatedRooms = state.rooms.map((r) =>
        r.id === message.room_id
          ? {
              ...r,
              last_message: { content: message.content, sender_name: message.sender_name, created_at: message.created_at },
              unread_count: (isOwnMessage || isCurrentRoom) ? (r.unread_count || 0) : (r.unread_count || 0) + 1
            }
          : r
      )
      // Re-sort rooms so the most recently active room appears first
      updatedRooms.sort((a, b) => {
        const aTime = new Date(a.last_message?.created_at || 0)
        const bTime = new Date(b.last_message?.created_at || 0)
        return bTime - aTime
      })
      return { rooms: updatedRooms }
    })
  },

  onMessageDeleted: ({ messageId }) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, content: 'Message deleted', deleted_at: new Date().toISOString() } : m
      )
    }))
  },

  onMessageEdited: (roomId, editedMessage) => {
    set((state) => ({
      messages: state.currentRoom?.id === roomId
        ? state.messages.map(m => m.id === editedMessage.id ? { ...m, ...editedMessage } : m)
        : state.messages
    }))
  },

  onNewRoom: (room) => {
    set((state) => ({ rooms: [room, ...state.rooms] }))
  },

  onRoomDeleted: ({ roomId }) => {
    set((state) => ({
      rooms: state.rooms.filter((r) => r.id !== roomId),
      currentRoom: state.currentRoom?.id === roomId ? null : state.currentRoom,
      messages: state.currentRoom?.id === roomId ? [] : state.messages,
    }))
  },

  onRoomRead: ({ roomId, user_id, user_name, last_read_at }) => {
    const { currentRoom } = get()
    if (currentRoom && currentRoom.id === roomId) {
      set((state) => {
        const existing = state.readReceipts.find(r => r.user_id === user_id)
        if (existing) {
          return {
            readReceipts: state.readReceipts.map(r =>
              r.user_id === user_id ? { ...r, last_read_at } : r
            )
          }
        }
        return {
          readReceipts: [...state.readReceipts, { user_id, user_name, last_read_at }]
        }
      })
    }
  },

  // Reactions
  toggleReaction: async (roomId, messageId, emoji) => {
    try {
      const { data } = await chatApi.toggleReaction(roomId, messageId, emoji)
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === messageId ? { ...m, reactions: data.reactions } : m
        )
      }))
      return data
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to toggle reaction' })
      return null
    }
  },

  onReactionUpdated: ({ messageId, reactions }) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, reactions } : m
      )
    }))
  },

  // Audio messages
  sendAudioMessage: async (roomId, audioFile, duration) => {
    try {
      const { data } = await chatApi.uploadAudio(roomId, audioFile, duration)
      return data.message
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to send audio message' })
      return null
    }
  },

  // File upload
  sendFileMessage: async (roomId, file) => {
    try {
      const { data } = await chatApi.uploadFile(roomId, file)
      return data.message
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to upload file' })
      return null
    }
  },

  // AI Features
  summarizeChat: async (roomId, messageCount) => {
    try {
      const { data } = await aiApi.summarizeChat(roomId, messageCount)
      return data.summary
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to summarize chat' })
      return null
    }
  },

  clearCurrentRoom: () => set({ currentRoom: null, messages: [], readReceipts: [], hasMore: false }),
  clearError: () => set({ error: null })
}))
