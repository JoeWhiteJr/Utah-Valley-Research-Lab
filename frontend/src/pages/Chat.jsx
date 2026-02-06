import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useChatStore } from '../store/chatStore'
import { useAuthStore } from '../store/authStore'
import { usersApi } from '../services/api'
import socket from '../services/socket'
import Modal from '../components/Modal'
import Button from '../components/Button'
import Input from '../components/Input'
import { MessageCircle, Plus, Sparkles, Send, Trash2 } from 'lucide-react'
import { format, isToday, isYesterday } from 'date-fns'

export default function Chat() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const {
    rooms, currentRoom, messages, hasMore, isLoading,
    fetchRooms, fetchRoom, fetchMessages, sendMessage, deleteMessage, markRead,
    clearCurrentRoom, createRoom, summarizeChat
  } = useChatStore()
  const { user } = useAuthStore()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [chatName, setChatName] = useState('')
  const [chatType, setChatType] = useState('group')
  const [selectedMembers, setSelectedMembers] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const [summaryText, setSummaryText] = useState('')
  const [messageText, setMessageText] = useState('')
  const [isSending, setIsSending] = useState(false)

  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)

  const isAdmin = user?.role === 'admin'

  useEffect(() => { fetchRooms() }, [fetchRooms])

  useEffect(() => {
    if (roomId) {
      fetchRoom(roomId)
      fetchMessages(roomId)
      markRead(roomId)
      socket.joinRoom(roomId)
      return () => socket.leaveRoom(roomId)
    } else {
      clearCurrentRoom()
    }
  }, [roomId, fetchRoom, fetchMessages, markRead, clearCurrentRoom])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleOpenCreate = async () => {
    setCreateError('')
    setChatName('')
    setChatType('group')
    setSelectedMembers([])
    try {
      const { data } = await usersApi.team()
      setAllUsers(data.users.filter(u => u.id !== user.id))
    } catch (error) {
      console.error('Failed to load users:', error)
    }
    setShowCreateModal(true)
  }

  const handleCreateChat = async (e) => {
    e.preventDefault()
    setCreateError('')

    if (selectedMembers.length === 0) {
      setCreateError('Please select at least one member')
      return
    }

    setIsCreating(true)
    const room = await createRoom(chatType, selectedMembers, chatName || undefined)
    setIsCreating(false)

    if (room) {
      setShowCreateModal(false)
      navigate(`/dashboard/chat/${room.id}`)
    } else {
      setCreateError('Failed to create chat')
    }
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    const text = messageText.trim()
    if (!text || !currentRoom || isSending) return

    setIsSending(true)
    setMessageText('')
    await sendMessage(currentRoom.id, text)
    setIsSending(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage(e)
    }
  }

  const handleSummarize = async () => {
    setIsSummarizing(true)
    const summary = await summarizeChat(currentRoom.id)
    setIsSummarizing(false)
    if (summary) {
      setSummaryText(summary)
      setShowSummaryModal(true)
    }
  }

  const handleDeleteMessage = async (messageId) => {
    await deleteMessage(currentRoom.id, messageId)
  }

  const handleLoadMore = () => {
    if (hasMore && messages.length > 0) {
      fetchMessages(currentRoom.id, { before: messages[0].id })
    }
  }

  const toggleMember = (userId) => {
    setSelectedMembers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const formatMessageTime = (dateStr) => {
    const date = new Date(dateStr)
    if (isToday(date)) return format(date, 'h:mm a')
    if (isYesterday(date)) return 'Yesterday ' + format(date, 'h:mm a')
    return format(date, 'MMM d, h:mm a')
  }

  return (
    <div className="h-[calc(100vh-7rem)] flex bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Sidebar - Room list */}
      <div className="w-80 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b font-semibold flex items-center justify-between">
          <span>Messages</span>
          {isAdmin && (
            <button
              onClick={handleOpenCreate}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-text-secondary hover:text-primary-600"
              title="New Chat"
            >
              <Plus size={20} />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {rooms.length === 0 ? (
            <div className="p-4 text-center text-sm text-text-secondary">No conversations yet</div>
          ) : (
            rooms.map((room) => (
              <a
                key={room.id}
                href={`/dashboard/chat/${room.id}`}
                className={`block px-4 py-3 hover:bg-gray-50 border-b border-gray-100 ${currentRoom?.id === room.id ? 'bg-primary-50' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm truncate">{room.name || 'Chat'}</div>
                  {room.unread_count > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-primary-500 text-white rounded-full min-w-[20px] text-center">
                      {room.unread_count}
                    </span>
                  )}
                </div>
                <div className="text-xs text-text-secondary truncate mt-0.5">
                  {room.last_message?.sender_name && <span className="font-medium">{room.last_message.sender_name}: </span>}
                  {room.last_message?.content || 'No messages yet'}
                </div>
              </a>
            ))
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {currentRoom ? (
          <>
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-white">
              <div>
                <h2 className="font-semibold">{currentRoom.name || 'Chat'}</h2>
                <p className="text-xs text-text-secondary">
                  {currentRoom.members?.length || 0} members
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSummarize}
                loading={isSummarizing}
              >
                <Sparkles size={16} className="mr-1.5" />
                Summarize
              </Button>
            </div>

            {/* Messages area */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {hasMore && (
                <div className="text-center">
                  <button
                    onClick={handleLoadMore}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Load older messages
                  </button>
                </div>
              )}

              {messages.length === 0 && !isLoading && (
                <div className="flex-1 flex items-center justify-center h-full">
                  <div className="text-center text-text-secondary">
                    <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">No messages yet. Start the conversation!</p>
                  </div>
                </div>
              )}

              {messages.map((msg) => {
                const isOwn = msg.sender_id === user?.id
                const isDeleted = !!msg.deleted_at

                return (
                  <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] group ${isOwn ? 'items-end' : 'items-start'}`}>
                      {!isOwn && (
                        <p className="text-xs font-medium text-text-secondary mb-1 px-1">
                          {msg.sender_name}
                        </p>
                      )}
                      <div className="flex items-end gap-1.5">
                        {isOwn && !isDeleted && (
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-opacity"
                            title="Delete message"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        <div
                          className={`px-3.5 py-2 rounded-2xl text-sm ${
                            isDeleted
                              ? 'bg-gray-100 text-gray-400 italic'
                              : isOwn
                                ? 'bg-primary-500 text-white rounded-br-md'
                                : 'bg-gray-100 text-text-primary rounded-bl-md'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        </div>
                        {!isOwn && !isDeleted && (isAdmin || msg.sender_id === user?.id) && (
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-opacity"
                            title="Delete message"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <p className={`text-[10px] text-text-secondary mt-0.5 px-1 ${isOwn ? 'text-right' : ''}`}>
                        {formatMessageTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <div className="px-4 py-3 border-t border-gray-200 bg-white">
              <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  rows={1}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300 focus:bg-white resize-none text-sm"
                  style={{ maxHeight: '120px', minHeight: '42px' }}
                  onInput={(e) => {
                    e.target.style.height = 'auto'
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                  }}
                />
                <button
                  type="submit"
                  disabled={!messageText.trim() || isSending}
                  className="p-2.5 rounded-xl bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 text-primary-200 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Welcome to Chat</h2>
              <p className="text-text-secondary mb-4">Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* Create Chat Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="New Chat">
        <form onSubmit={handleCreateChat} className="space-y-5">
          <Input
            label="Chat Name"
            value={chatName}
            onChange={(e) => setChatName(e.target.value)}
            placeholder="e.g., Project Discussion"
          />
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Type</label>
            <select
              value={chatType}
              onChange={(e) => setChatType(e.target.value)}
              className="w-full px-4 py-2.5 rounded-organic border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              <option value="direct">Direct Message</option>
              <option value="group">Group Chat</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Members</label>
            <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-organic">
              {allUsers.map((u) => (
                <label
                  key={u.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(u.id)}
                    onChange={() => toggleMember(u.id)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-300"
                  />
                  <span className="text-sm">{u.name}</span>
                  <span className="text-xs text-text-secondary capitalize ml-auto">{u.role?.replace('_', ' ')}</span>
                </label>
              ))}
            </div>
          </div>

          {createError && (
            <div className="p-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-600">
              {createError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button type="submit" loading={isCreating}>Create Chat</Button>
          </div>
        </form>
      </Modal>

      {/* Summary Modal */}
      <Modal isOpen={showSummaryModal} onClose={() => setShowSummaryModal(false)} title="Chat Summary">
        <div className="prose prose-sm max-w-none">
          <p className="text-text-secondary whitespace-pre-wrap">{summaryText}</p>
        </div>
        <div className="flex justify-end pt-4">
          <Button variant="secondary" onClick={() => setShowSummaryModal(false)}>Close</Button>
        </div>
      </Modal>
    </div>
  )
}
