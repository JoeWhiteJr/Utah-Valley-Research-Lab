import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useChatStore } from '../store/chatStore'
import { useAuthStore } from '../store/authStore'
import { usersApi, getUploadUrl, fetchAuthenticatedBlobUrl } from '../services/api'
import socket from '../services/socket'
import Modal from '../components/Modal'
import Button from '../components/Button'
import Input from '../components/Input'
import AudioRecorder from '../components/chat/AudioRecorder'
import ChatFileUpload, { FileAttachment, LinkPreview } from '../components/chat/ChatFileUpload'
import EmojiPicker from '../components/chat/EmojiPicker'
import MessageReactions from '../components/chat/MessageReactions'
import MentionAutocomplete from '../components/chat/MentionAutocomplete'
import { useChatNotifications } from '../components/chat/useChatNotifications'
import { chatApi } from '../services/api'
import { MessageCircle, Plus, Sparkles, Send, Trash2, Smile, Pencil, Reply, X, ArrowLeft } from 'lucide-react'
import { format, isToday, isYesterday } from 'date-fns'

// Detect URLs in text
const URL_REGEX = /https?:\/\/[^\s<]+/g

function extractUrls(text) {
  if (!text) return []
  const matches = text.match(URL_REGEX)
  return matches || []
}

function AuthenticatedAudio({ audioUrl }) {
  const [blobUrl, setBlobUrl] = useState(null)
  const blobUrlRef = useRef(null)
  const isChatUpload = audioUrl && audioUrl.startsWith('/uploads/chat/')

  useEffect(() => {
    if (isChatUpload) {
      let cancelled = false
      fetchAuthenticatedBlobUrl(audioUrl).then((url) => {
        if (!cancelled && url) {
          blobUrlRef.current = url
          setBlobUrl(url)
        }
      })
      return () => {
        cancelled = true
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current)
          blobUrlRef.current = null
        }
      }
    }
  }, [audioUrl, isChatUpload])

  const src = isChatUpload ? blobUrl : getUploadUrl(audioUrl)

  if (!src) {
    return <p className="text-xs opacity-75">Loading audio...</p>
  }

  return (
    <audio controls className="max-w-[250px]" preload="metadata">
      <source src={src} type="audio/webm" />
      Your browser does not support audio playback.
    </audio>
  )
}

export default function Chat() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const {
    rooms, currentRoom, messages, readReceipts, hasMore, isLoading,
    fetchRooms, fetchRoom, fetchMessages, sendMessage, deleteMessage, markRead,
    clearCurrentRoom, createRoom, summarizeChat,
    toggleReaction, sendAudioMessage, sendFileMessage, deleteRoom
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showDeleteMsgConfirm, setShowDeleteMsgConfirm] = useState(null)

  const [editingMessage, setEditingMessage] = useState(null)
  const [editText, setEditText] = useState('')
  const [replyingTo, setReplyingTo] = useState(null)

  const [mentionQuery, setMentionQuery] = useState('')
  const [showMentions, setShowMentions] = useState(false)

  const [typingUsers, setTypingUsers] = useState([])
  const [onlineUserIds, setOnlineUserIds] = useState([])

  // Mobile: track whether viewing room list or conversation
  const [mobileShowChat, setMobileShowChat] = useState(false)

  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const shouldAutoScroll = useRef(true)
  const textareaRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  const isAdmin = user?.role === 'admin'

  // Push notifications hook
  useChatNotifications()

  // Page title
  useEffect(() => {
    document.title = 'Chat - Stats Lab'
  }, [])

  useEffect(() => { fetchRooms() }, [fetchRooms])

  useEffect(() => {
    if (roomId) {
      fetchRoom(roomId)
      fetchMessages(roomId)
      markRead(roomId)
      socket.joinRoom(roomId)
      setMobileShowChat(true)
      return () => socket.leaveRoom(roomId)
    } else {
      clearCurrentRoom()
      setMobileShowChat(false)
    }
  }, [roomId, fetchRoom, fetchMessages, markRead, clearCurrentRoom])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (shouldAutoScroll.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    shouldAutoScroll.current = true
  }, [messages])

  // Subscribe to typing events when room changes
  useEffect(() => {
    if (roomId) {
      const unsub = socket.subscribeToTyping(roomId, (users) => {
        // Filter out current user
        setTypingUsers(users.filter(u => u.id !== user?.id))
      })
      return unsub
    } else {
      setTypingUsers([])
    }
  }, [roomId, user?.id])

  // Subscribe to online status
  useEffect(() => {
    const unsub = socket.subscribeToOnlineStatus((userIds) => {
      setOnlineUserIds(userIds)
    })
    // Get initial state
    setOnlineUserIds(socket.getOnlineUsers())
    return unsub
  }, [])

  const handleOpenCreate = async () => {
    setCreateError('')
    setChatName('')
    setChatType('group')
    setSelectedMembers([])
    try {
      const { data } = await usersApi.team()
      setAllUsers(data.users.filter(u => u.id !== user.id))
    } catch {
      /* error handled silently */
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

  const handleTyping = () => {
    if (currentRoom) {
      socket.startTyping(currentRoom.id)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => {
        socket.stopTyping(currentRoom.id)
      }, 2000)
    }
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    const text = messageText.trim()
    if (!text || !currentRoom || isSending) return

    // Stop typing indicator on send
    socket.stopTyping(currentRoom.id)
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }

    setIsSending(true)
    setMessageText('')
    const replyId = replyingTo?.id
    setReplyingTo(null)
    await sendMessage(currentRoom.id, text, 'text', undefined, replyId)
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
    try {
      const summary = await summarizeChat(currentRoom.id)
      if (summary) {
        setSummaryText(summary)
        setShowSummaryModal(true)
      } else {
        setSummaryText('AI summarization is not available. An Anthropic API key needs to be configured on the server.')
        setShowSummaryModal(true)
      }
    } catch (error) {
      setSummaryText('AI summarization is not available. An Anthropic API key needs to be configured on the server.')
      setShowSummaryModal(true)
    }
    setIsSummarizing(false)
  }

  const handleDeleteRoom = async () => {
    if (!currentRoom) return
    const success = await deleteRoom(currentRoom.id)
    if (success) {
      setShowDeleteConfirm(false)
      navigate('/dashboard/chat')
    }
  }

  const handleDeleteMessage = async (messageId) => {
    setShowDeleteMsgConfirm(messageId)
  }

  const confirmDeleteMessage = async () => {
    if (!showDeleteMsgConfirm) return
    await deleteMessage(currentRoom.id, showDeleteMsgConfirm)
    setShowDeleteMsgConfirm(null)
  }

  const handleStartEdit = (msg) => {
    setEditingMessage(msg)
    setEditText(msg.content)
  }

  const handleSaveEdit = async () => {
    if (!editText.trim() || !editingMessage) return
    try {
      await chatApi.editMessage(currentRoom.id, editingMessage.id, editText.trim())
      setEditingMessage(null)
      setEditText('')
    } catch {
      /* error handled silently */
    }
  }

  const handleCancelEdit = () => {
    setEditingMessage(null)
    setEditText('')
  }

  const handleReply = (msg) => {
    setReplyingTo(msg)
    textareaRef.current?.focus()
  }

  const handleCancelReply = () => {
    setReplyingTo(null)
  }

  const handleTextChange = (e) => {
    const val = e.target.value
    setMessageText(val)
    handleTyping()

    // Check for @mention
    const cursorPos = e.target.selectionStart
    const textBefore = val.substring(0, cursorPos)
    const atMatch = textBefore.match(/@(\w*)$/)
    if (atMatch) {
      setMentionQuery(atMatch[1])
      setShowMentions(true)
    } else {
      setShowMentions(false)
      setMentionQuery('')
    }
  }

  const handleMentionSelect = (member) => {
    const name = member.name || member.user_name
    const cursorPos = textareaRef.current?.selectionStart || messageText.length
    const textBefore = messageText.substring(0, cursorPos)
    const textAfter = messageText.substring(cursorPos)
    const newBefore = textBefore.replace(/@\w*$/, `@${name} `)
    setMessageText(newBefore + textAfter)
    setShowMentions(false)
    setMentionQuery('')
    textareaRef.current?.focus()
  }

  const handleLoadMore = () => {
    if (hasMore && messages.length > 0) {
      shouldAutoScroll.current = false
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

  const handleEmojiSelect = useCallback((emoji) => {
    setMessageText(prev => prev + emoji)
    textareaRef.current?.focus()
  }, [])

  const handleToggleReaction = useCallback((messageId, emoji) => {
    if (currentRoom) {
      toggleReaction(currentRoom.id, messageId, emoji)
    }
  }, [currentRoom, toggleReaction])

  const handleRecordingComplete = useCallback(async (audioFile, duration) => {
    if (!currentRoom) return
    setIsSending(true)
    await sendAudioMessage(currentRoom.id, audioFile, duration)
    setIsSending(false)
  }, [currentRoom, sendAudioMessage])

  const handleFileSelect = useCallback(async (file) => {
    if (!currentRoom) return
    setIsSending(true)
    await sendFileMessage(currentRoom.id, file)
    setIsSending(false)
  }, [currentRoom, sendFileMessage])

  const formatMessageTime = (dateStr) => {
    const date = new Date(dateStr)
    if (isToday(date)) return format(date, 'h:mm a')
    if (isYesterday(date)) return 'Yesterday ' + format(date, 'h:mm a')
    return format(date, 'MMM d, h:mm a')
  }

  const renderTextWithMentions = (text) => {
    const parts = text.split(/(@\w+(?:\s\w+)?)/g)
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return <span key={i} className="font-medium text-primary-600 dark:text-primary-400">{part}</span>
      }
      return part
    })
  }

  const renderMessageContent = (msg) => {
    const isDeleted = !!msg.deleted_at

    if (isDeleted) {
      return <p className="whitespace-pre-wrap break-words">{msg.content}</p>
    }

    // Audio message
    if (msg.type === 'audio' && msg.audio_url) {
      return (
        <div>
          <AuthenticatedAudio audioUrl={msg.audio_url} />
          {msg.audio_duration > 0 && (
            <p className="text-xs opacity-75 mt-1">
              {Math.floor(msg.audio_duration / 60)}:{(msg.audio_duration % 60).toString().padStart(2, '0')}
            </p>
          )}
        </div>
      )
    }

    // File message
    if (msg.type === 'file' && msg.file_url) {
      return (
        <div>
          <FileAttachment fileUrl={msg.file_url} fileName={msg.file_name} type={msg.type} />
        </div>
      )
    }

    // Text message with URL detection and @mention highlighting
    const urls = extractUrls(msg.content)
    return (
      <div>
        <p className="whitespace-pre-wrap break-words">{renderTextWithMentions(msg.content)}</p>
        {urls.map((url, i) => (
          <LinkPreview key={i} url={url} />
        ))}
      </div>
    )
  }

  // Mobile back handler
  const handleMobileBack = () => {
    navigate('/dashboard/chat')
    setMobileShowChat(false)
  }

  return (
    <div className="h-[calc(100vh-7rem)] flex bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Sidebar - Room list */}
      <div className={`w-full lg:w-80 border-r border-gray-200 dark:border-gray-700 flex flex-col ${mobileShowChat ? 'hidden lg:flex' : 'flex'}`}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 font-semibold flex items-center justify-between dark:text-gray-100">
          <span>Messages</span>
          {isAdmin && (
            <button
              onClick={handleOpenCreate}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-text-secondary dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
              title="New Chat"
            >
              <Plus size={20} />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {rooms.length === 0 ? (
            <div className="p-4 text-center text-sm text-text-secondary dark:text-gray-400">No conversations yet</div>
          ) : (
            rooms.map((room) => (
              <Link
                key={room.id}
                to={`/dashboard/chat/${room.id}`}
                className={`block px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 ${currentRoom?.id === room.id ? 'bg-primary-50 dark:bg-primary-900/30' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm truncate flex items-center gap-1.5 dark:text-gray-100">
                    {room.name || 'Chat'}
                    {onlineUserIds.some(uid => room.members?.some(m => m.user_id === uid && uid !== user?.id)) && (
                      <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0"></span>
                    )}
                  </div>
                  {room.unread_count > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-primary-500 text-white rounded-full min-w-[20px] text-center">
                      {room.unread_count}
                    </span>
                  )}
                </div>
                <div className="text-xs text-text-secondary dark:text-gray-400 truncate mt-0.5">
                  {room.last_message?.sender_name && <span className="font-medium">{room.last_message.sender_name}: </span>}
                  {room.last_message?.content || 'No messages yet'}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className={`flex-1 flex flex-col ${!mobileShowChat ? 'hidden lg:flex' : 'flex'}`}>
        {currentRoom ? (
          <>
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800">
              <div className="flex items-center gap-3">
                {/* Mobile back button */}
                <button
                  onClick={handleMobileBack}
                  className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-text-secondary dark:text-gray-400"
                >
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <h2 className="font-semibold dark:text-gray-100">{currentRoom.name || 'Chat'}</h2>
                  <p className="text-xs text-text-secondary dark:text-gray-400">
                    {currentRoom.members?.length || 0} members
                    {(() => {
                      const onlineCount = currentRoom.members?.filter(m => onlineUserIds.includes(m.user_id)).length || 0
                      return onlineCount > 0 ? ` \u00b7 ${onlineCount} online` : ''
                    })()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSummarize}
                  loading={isSummarizing}
                >
                  <Sparkles size={16} className="mr-1.5" />
                  <span className="hidden sm:inline">Summarize</span>
                </Button>
                {isAdmin && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30"
                  >
                    <Trash2 size={16} className="mr-1.5" />
                    <span className="hidden sm:inline">Delete</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Messages area */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 dark:bg-gray-900">
              {hasMore && (
                <div className="text-center">
                  <button
                    onClick={handleLoadMore}
                    className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
                  >
                    Load older messages
                  </button>
                </div>
              )}

              {messages.length === 0 && !isLoading && (
                <div className="flex-1 flex items-center justify-center h-full">
                  <div className="text-center text-text-secondary dark:text-gray-400">
                    <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                    <p className="text-sm">No messages yet. Start the conversation!</p>
                  </div>
                </div>
              )}

              {messages.map((msg) => {
                const isOwn = msg.sender_id === user?.id
                const isDeleted = !!msg.deleted_at
                const isEditing = editingMessage?.id === msg.id

                return (
                  <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] group ${isOwn ? 'items-end' : 'items-start'}`}>
                      {!isOwn && (
                        <p className="text-xs font-medium text-text-secondary dark:text-gray-400 mb-1 px-1">
                          {msg.sender_name}
                        </p>
                      )}
                      <div className="flex items-end gap-1.5">
                        {isOwn && !isDeleted && (
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleReply(msg)}
                              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 hover:text-primary-500 dark:hover:text-primary-400"
                              title="Reply"
                            >
                              <Reply size={14} />
                            </button>
                            <button
                              onClick={() => handleStartEdit(msg)}
                              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 hover:text-primary-500 dark:hover:text-primary-400"
                              title="Edit message"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400"
                              title="Delete message"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                        <div
                          className={`px-3.5 py-2 rounded-2xl text-sm ${
                            isDeleted
                              ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 italic'
                              : isOwn
                                ? 'bg-primary-500 text-white rounded-br-md'
                                : 'bg-gray-100 dark:bg-gray-700 text-text-primary dark:text-gray-100 rounded-bl-md'
                          }`}
                        >
                          {msg.reply_to_content && (
                            <div className="text-xs mb-1 px-2 py-1 rounded bg-black/5 dark:bg-white/5 border-l-2 border-primary-400">
                              <span className="font-medium">{msg.reply_to_sender_name}</span>
                              <p className="truncate opacity-75">{msg.reply_to_content}</p>
                            </div>
                          )}
                          {isEditing ? (
                            <div className="space-y-2">
                              <textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                className="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary-300"
                                rows={2}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    handleSaveEdit()
                                  }
                                  if (e.key === 'Escape') {
                                    handleCancelEdit()
                                  }
                                }}
                              />
                              <div className="flex items-center gap-1.5 justify-end">
                                <button
                                  onClick={handleCancelEdit}
                                  className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-600 text-text-secondary dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={handleSaveEdit}
                                  className="text-xs px-2 py-0.5 rounded bg-primary-500 text-white hover:bg-primary-600"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            renderMessageContent(msg)
                          )}
                        </div>
                        {!isOwn && !isDeleted && (
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleReply(msg)}
                              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 hover:text-primary-500 dark:hover:text-primary-400"
                              title="Reply"
                            >
                              <Reply size={14} />
                            </button>
                            {(isAdmin || msg.sender_id === user?.id) && (
                              <button
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400"
                                title="Delete message"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Message reactions */}
                      {!isDeleted && (
                        <MessageReactions
                          reactions={msg.reactions || []}
                          currentUserId={user?.id}
                          onToggleReaction={(emoji) => handleToggleReaction(msg.id, emoji)}
                        />
                      )}
                      <p className={`text-[10px] text-text-secondary dark:text-gray-500 mt-0.5 px-1 ${isOwn ? 'text-right' : ''}`}>
                        {formatMessageTime(msg.created_at)}
                        {msg.edited_at && <span className="ml-1 opacity-75">(edited)</span>}
                      </p>
                      {isOwn && !isDeleted && readReceipts.length > 0 && (() => {
                        const readers = readReceipts.filter(r =>
                          r.user_id !== user?.id &&
                          new Date(r.last_read_at) >= new Date(msg.created_at)
                        )
                        if (readers.length === 0) return null
                        return (
                          <p className="text-[10px] text-text-secondary dark:text-gray-500 mt-0.5 px-1 text-right">
                            Seen by {readers.map(r => r.user_name.split(' ')[0]).join(', ')}
                          </p>
                        )
                      })()}
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply preview */}
            {replyingTo && (
              <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center gap-2">
                <Reply size={14} className="text-primary-500 dark:text-primary-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-primary-600 dark:text-primary-400">{replyingTo.sender_name}</p>
                  <p className="text-xs text-text-secondary dark:text-gray-400 truncate">{replyingTo.content}</p>
                </div>
                <button onClick={handleCancelReply} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                  <X size={14} className="dark:text-gray-400" />
                </button>
              </div>
            )}

            {/* Message input */}
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              {typingUsers.length > 0 && (
                <div className="px-4 py-1.5 text-xs text-text-secondary dark:text-gray-400 flex items-center gap-1.5">
                  <span className="flex gap-0.5">
                    <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </span>
                  <span>
                    {typingUsers.map(u => u.name.split(' ')[0]).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                  </span>
                </div>
              )}
              <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="p-2.5 rounded-xl text-text-secondary dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors"
                    title="Insert emoji"
                  >
                    <Smile size={18} />
                  </button>
                  {showEmojiPicker && (
                    <EmojiPicker
                      onSelect={handleEmojiSelect}
                      onClose={() => setShowEmojiPicker(false)}
                    />
                  )}
                </div>
                <ChatFileUpload
                  onFileSelect={handleFileSelect}
                  disabled={isSending}
                />
                <AudioRecorder
                  onRecordingComplete={handleRecordingComplete}
                  disabled={isSending}
                />
                <div className="flex-1 relative">
                  {showMentions && currentRoom?.members && (
                    <MentionAutocomplete
                      members={currentRoom.members}
                      query={mentionQuery}
                      onSelect={handleMentionSelect}
                    />
                  )}
                  <textarea
                    ref={textareaRef}
                    value={messageText}
                    onChange={handleTextChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message... (@ to mention)"
                    rows={1}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300 focus:bg-white dark:focus:bg-gray-800 resize-none text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    style={{ maxHeight: '120px', minHeight: '42px' }}
                    onInput={(e) => {
                      e.target.style.height = 'auto'
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                    }}
                  />
                </div>
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
          <div className="flex-1 flex items-center justify-center dark:bg-gray-900">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 text-primary-200 dark:text-primary-800 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2 dark:text-gray-100">Welcome to Chat</h2>
              <p className="text-text-secondary dark:text-gray-400 mb-4">Select a conversation to start messaging</p>
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
            <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1.5">Type</label>
            <select
              value={chatType}
              onChange={(e) => setChatType(e.target.value)}
              className="w-full px-4 py-2.5 rounded-organic border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              <option value="direct">Direct Message</option>
              <option value="group">Group Chat</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1.5">Members</label>
            <div className="max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-organic">
              {allUsers.map((u) => (
                <label
                  key={u.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(u.id)}
                    onChange={() => toggleMember(u.id)}
                    className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-300"
                  />
                  <span className="text-sm dark:text-gray-100">{u.name}</span>
                  <span className="text-xs text-text-secondary dark:text-gray-400 capitalize ml-auto">{u.role?.replace(/_/g, ' ')}</span>
                </label>
              ))}
            </div>
          </div>

          {createError && (
            <div className="p-3 rounded-lg text-sm bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400">
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
          <p className="text-text-secondary dark:text-gray-400 whitespace-pre-wrap">{summaryText}</p>
        </div>
        <div className="flex justify-end pt-4">
          <Button variant="secondary" onClick={() => setShowSummaryModal(false)}>Close</Button>
        </div>
      </Modal>

      {/* Delete Room Confirmation Modal */}
      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete Chat Room">
        <p className="text-text-secondary dark:text-gray-400 mb-4">
          Are you sure you want to delete this chat room? This action will hide the room from all members.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
          <Button onClick={handleDeleteRoom} className="bg-red-600 hover:bg-red-700 text-white">
            Delete Room
          </Button>
        </div>
      </Modal>

      {/* Delete Message Confirmation Modal */}
      <Modal isOpen={!!showDeleteMsgConfirm} onClose={() => setShowDeleteMsgConfirm(null)} title="Delete Message" size="sm">
        <p className="text-text-secondary dark:text-gray-400 mb-4">
          Are you sure you want to delete this message? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowDeleteMsgConfirm(null)}>Cancel</Button>
          <Button variant="danger" onClick={confirmDeleteMessage}>
            Delete Message
          </Button>
        </div>
      </Modal>
    </div>
  )
}
