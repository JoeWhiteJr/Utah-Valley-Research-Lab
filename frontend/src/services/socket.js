import { io } from 'socket.io-client'
import { useChatStore } from '../store/chatStore'
import { useNotificationStore } from '../store/notificationStore'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || ''

let socket = null

let onlineUsers = new Set()
let onlineStatusListeners = []
let typingUsers = new Map()
let typingListeners = []

let connectionStatus = 'disconnected' // 'connected' | 'disconnected' | 'reconnecting'
let connectionStatusListeners = []

const notifyConnectionStatusListeners = () => {
  connectionStatusListeners.forEach((cb) => cb(connectionStatus))
}

export const getConnectionStatus = () => connectionStatus

export const subscribeToConnectionStatus = (callback) => {
  connectionStatusListeners.push(callback)
  return () => {
    connectionStatusListeners = connectionStatusListeners.filter((cb) => cb !== callback)
  }
}

export const connect = (token) => {
  if (socket?.connected) return socket

  socket = io(SOCKET_URL, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000
  })

  socket.on('connect', () => {
    connectionStatus = 'connected'
    notifyConnectionStatusListeners()
  })

  socket.on('disconnect', () => {
    connectionStatus = 'reconnecting'
    notifyConnectionStatusListeners()
  })

  socket.on('connect_error', (err) => {
    console.error('[socket] Connection error:', err.message)
    connectionStatus = 'reconnecting'
    notifyConnectionStatusListeners()
  })

  socket.on('new_message', (message) => {
    useChatStore.getState().onNewMessage(message)
  })

  socket.on('message_deleted', (data) => {
    useChatStore.getState().onMessageDeleted(data)
  })

  socket.on('message_edited', ({ roomId, message }) => {
    useChatStore.getState().onMessageEdited(roomId, message)
  })

  socket.on('new_room', (room) => {
    useChatStore.getState().onNewRoom(room)
  })

  socket.on('reaction_updated', (data) => {
    useChatStore.getState().onReactionUpdated(data)
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

  socket.on('room_read', (data) => {
    useChatStore.getState().onRoomRead(data)
  })

  return socket
}

export const disconnect = () => {
  if (socket) {
    socket.disconnect()
    socket = null
    onlineUsers.clear()
    typingUsers.clear()
    connectionStatus = 'disconnected'
    notifyConnectionStatusListeners()
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
  subscribeToTyping,
  getConnectionStatus,
  subscribeToConnectionStatus
}
