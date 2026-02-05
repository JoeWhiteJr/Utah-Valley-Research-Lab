import { io } from 'socket.io-client'
import { useChatStore } from '../store/chatStore'
import { useNotificationStore } from '../store/notificationStore'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'

let socket = null
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 5

let onlineUsers = new Set()
let onlineStatusListeners = []
let typingUsers = new Map()
let typingListeners = []

export const connect = (token) => {
  if (socket?.connected) return socket

  socket = io(SOCKET_URL, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000
  })

  socket.on('connect', () => {
    console.log('Socket connected')
    reconnectAttempts = 0
  })

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason)
  })

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error.message)
    reconnectAttempts++
  })

  socket.on('new_message', (message) => {
    useChatStore.getState().onNewMessage(message)
  })

  socket.on('message_deleted', (data) => {
    useChatStore.getState().onMessageDeleted(data)
  })

  socket.on('new_room', (room) => {
    useChatStore.getState().onNewRoom(room)
  })

  socket.on('room_updated', (room) => {
    const state = useChatStore.getState()
    if (state.currentRoom?.id === room.id) {
      useChatStore.setState({ currentRoom: room })
    }
    useChatStore.setState((s) => ({
      rooms: s.rooms.map((r) => (r.id === room.id ? room : r))
    }))
  })

  socket.on('removed_from_room', ({ roomId }) => {
    const state = useChatStore.getState()
    if (state.currentRoom?.id === roomId) {
      useChatStore.setState({ currentRoom: null, messages: [] })
    }
    useChatStore.setState((s) => ({
      rooms: s.rooms.filter((r) => r.id !== roomId)
    }))
  })

  socket.on('online_users', (userIds) => {
    onlineUsers = new Set(userIds)
    notifyOnlineStatusListeners()
  })

  socket.on('user_online', ({ userId }) => {
    onlineUsers.add(userId)
    notifyOnlineStatusListeners()
  })

  socket.on('user_offline', ({ userId }) => {
    onlineUsers.delete(userId)
    notifyOnlineStatusListeners()
  })

  socket.on('user_typing', ({ roomId, userId, userName }) => {
    if (!typingUsers.has(roomId)) typingUsers.set(roomId, new Map())
    typingUsers.get(roomId).set(userId, userName)
    notifyTypingListeners(roomId)
  })

  socket.on('user_stopped_typing', ({ roomId, userId }) => {
    if (typingUsers.has(roomId)) {
      typingUsers.get(roomId).delete(userId)
      notifyTypingListeners(roomId)
    }
  })

  socket.on('notification', (notification) => {
    useNotificationStore.getState().addNotification(notification)
  })

  return socket
}

export const disconnect = () => {
  if (socket) {
    socket.disconnect()
    socket = null
    onlineUsers.clear()
    typingUsers.clear()
  }
}

export const getSocket = () => socket
export const isConnected = () => socket?.connected ?? false

export const joinRoom = (roomId) => socket?.emit('join_room', { roomId })
export const leaveRoom = (roomId) => socket?.emit('leave_room', { roomId })
export const startTyping = (roomId) => socket?.emit('typing_start', { roomId })
export const stopTyping = (roomId) => socket?.emit('typing_stop', { roomId })

export const isUserOnline = (userId) => onlineUsers.has(userId)
export const getOnlineUsers = () => Array.from(onlineUsers)

export const subscribeToOnlineStatus = (callback) => {
  onlineStatusListeners.push(callback)
  return () => {
    onlineStatusListeners = onlineStatusListeners.filter((cb) => cb !== callback)
  }
}

const notifyOnlineStatusListeners = () => {
  onlineStatusListeners.forEach((cb) => cb(Array.from(onlineUsers)))
}

export const getTypingUsers = (roomId) => {
  const roomTyping = typingUsers.get(roomId)
  return roomTyping ? Array.from(roomTyping.entries()).map(([id, name]) => ({ id, name })) : []
}

export const subscribeToTyping = (roomId, callback) => {
  const listener = { roomId, callback }
  typingListeners.push(listener)
  return () => {
    typingListeners = typingListeners.filter((l) => l !== listener)
  }
}

const notifyTypingListeners = (roomId) => {
  typingListeners.filter((l) => l.roomId === roomId).forEach((l) => l.callback(getTypingUsers(roomId)))
}

export default {
  connect,
  disconnect,
  getSocket,
  isConnected,
  joinRoom,
  leaveRoom,
  startTyping,
  stopTyping,
  isUserOnline,
  getOnlineUsers,
  subscribeToOnlineStatus,
  getTypingUsers,
  subscribeToTyping
}
