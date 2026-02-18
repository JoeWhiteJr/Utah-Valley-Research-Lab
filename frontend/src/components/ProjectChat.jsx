import { useState, useEffect, useRef, useCallback } from 'react'
import { useChatStore } from '../store/chatStore'
import { useAuthStore } from '../store/authStore'
import { chatApi, getUploadUrl, fetchAuthenticatedBlobUrl } from '../services/api'
import socket from '../services/socket'
import AudioRecorder from './chat/AudioRecorder'
import ChatFileUpload, { FileAttachment, LinkPreview } from './chat/ChatFileUpload'
import EmojiPicker from './chat/EmojiPicker'
import MessageReactions from './chat/MessageReactions'
import MentionAutocomplete from './chat/MentionAutocomplete'
import { MessageCircle, Send, Trash2, Smile, Pencil, Reply, X, Loader2 } from 'lucide-react'
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns'
import { toast } from '../store/toastStore'

const URL_REGEX = /https?:\/\/[^\s<]+/g

function extractUrls(text) {
  if (!text) return []
  return text.match(URL_REGEX) || []
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
  if (!src) return <p className="text-xs opacity-75">Loading audio...</p>

  return (
    <audio controls className="max-w-[250px]" preload="metadata">
      <source src={src} type="audio/webm" />
    </audio>
  )
}

export default function ProjectChat({ projectId }) {
  const {
    messages, readReceipts, hasMore, isLoading,
    fetchMessages, sendMessage, deleteMessage, markRead,
    clearCurrentRoom, toggleReaction, sendAudioMessage, sendFileMessage
  } = useChatStore()
  const { user } = useAuthStore()

  const [room, setRoom] = useState(null)
  const [loadingRoom, setLoadingRoom] = useState(true)
  const [roomError, setRoomError] = useState(null)
  const [messageText, setMessageText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showDeleteMsgConfirm, setShowDeleteMsgConfirm] = useState(null)
  const [editingMessage, setEditingMessage] = useState(null)
  const [editText, setEditText] = useState('')
  const [replyingTo, setReplyingTo] = useState(null)
  const [mentionQuery, setMentionQuery] = useState('')
  const [showMentions, setShowMentions] = useState(false)
  const [typingUsers, setTypingUsers] = useState([])

  const messagesEndRef = useRef(null)
  const shouldAutoScroll = useRef(true)
  const textareaRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  const isAdmin = user?.role === 'admin'

  // Load or create the project chat room
  useEffect(() => {
    let cancelled = false
    setLoadingRoom(true)
    setRoomError(null)

    chatApi.getProjectRoom(projectId)
      .then(({ data }) => {
        if (!cancelled) {
          setRoom(data.room)
          setLoadingRoom(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setRoomError(err.response?.data?.error?.message || 'Failed to load chat')
          setLoadingRoom(false)
        }
      })

    return () => { cancelled = true }
  }, [projectId])

  // Join socket room and fetch messages when room is loaded
  useEffect(() => {
    if (!room) return

    // Set current room in the chat store so messages land correctly
    useChatStore.setState({ currentRoom: room })
    fetchMessages(room.id)
    markRead(room.id)
    socket.joinRoom(room.id)

    return () => {
      socket.leaveRoom(room.id)
      clearCurrentRoom()
    }
  }, [room, fetchMessages, markRead, clearCurrentRoom])

  // Auto-scroll
  useEffect(() => {
    if (shouldAutoScroll.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    shouldAutoScroll.current = true
  }, [messages])

  // Typing subscription
  useEffect(() => {
    if (room) {
      const unsub = socket.subscribeToTyping(room.id, (users) => {
        setTypingUsers(users.filter(u => u.id !== user?.id))
      })
      return unsub
    }
    setTypingUsers([])
  }, [room, user?.id])

  const handleTyping = () => {
    if (room) {
      socket.startTyping(room.id)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => socket.stopTyping(room.id), 2000)
    }
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    const text = messageText.trim()
    if (!text || !room || isSending) return

    socket.stopTyping(room.id)
    if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null }

    setIsSending(true)
    setMessageText('')
    const replyId = replyingTo?.id
    setReplyingTo(null)
    await sendMessage(room.id, text, 'text', undefined, replyId)
    setIsSending(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage(e)
    }
  }

  const handleDeleteMessage = (messageId) => setShowDeleteMsgConfirm(messageId)

  const confirmDeleteMessage = async () => {
    if (!showDeleteMsgConfirm || !room) return
    await deleteMessage(room.id, showDeleteMsgConfirm)
    setShowDeleteMsgConfirm(null)
  }

  const handleStartEdit = (msg) => { setEditingMessage(msg); setEditText(msg.content) }

  const handleSaveEdit = async () => {
    if (!editText.trim() || !editingMessage || !room) return
    try {
      await chatApi.editMessage(room.id, editingMessage.id, editText.trim())
      setEditingMessage(null)
      setEditText('')
    } catch { toast.error('Failed to edit message') }
  }

  const handleCancelEdit = () => { setEditingMessage(null); setEditText('') }
  const handleReply = (msg) => { setReplyingTo(msg); textareaRef.current?.focus() }
  const handleCancelReply = () => setReplyingTo(null)

  const handleTextChange = (e) => {
    const val = e.target.value
    setMessageText(val)
    handleTyping()
    const cursorPos = e.target.selectionStart
    const textBefore = val.substring(0, cursorPos)
    const atMatch = textBefore.match(/@(\w*)$/)
    if (atMatch) { setMentionQuery(atMatch[1]); setShowMentions(true) }
    else { setShowMentions(false); setMentionQuery('') }
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
    if (hasMore && messages.length > 0 && room) {
      shouldAutoScroll.current = false
      fetchMessages(room.id, { before: messages[0].id })
    }
  }

  const handleEmojiSelect = useCallback((emoji) => {
    setMessageText(prev => prev + emoji)
    textareaRef.current?.focus()
  }, [])

  const handleToggleReaction = useCallback((messageId, emoji) => {
    if (room) toggleReaction(room.id, messageId, emoji)
  }, [room, toggleReaction])

  const handleRecordingComplete = useCallback(async (audioFile, duration) => {
    if (!room) return
    setIsSending(true)
    await sendAudioMessage(room.id, audioFile, duration)
    setIsSending(false)
  }, [room, sendAudioMessage])

  const handleFileSelect = useCallback(async (file) => {
    if (!room) return
    setIsSending(true)
    await sendFileMessage(room.id, file)
    setIsSending(false)
  }, [room, sendFileMessage])

  const formatMessageTime = (dateStr) => {
    const date = new Date(dateStr)
    const diffMs = new Date() - date
    if (diffMs < 60 * 60 * 1000) return formatDistanceToNow(date, { addSuffix: true })
    if (isToday(date)) return format(date, 'h:mm a')
    if (isYesterday(date)) return 'Yesterday ' + format(date, 'h:mm a')
    return format(date, 'MMM d, h:mm a')
  }

  const renderTextWithMentions = (text) => {
    const parts = text.split(/(@\w+(?:\s\w+)?)/g)
    return parts.map((part, i) => {
      if (part.startsWith('@')) return <span key={i} className="font-medium text-primary-600 dark:text-primary-400">{part}</span>
      return part
    })
  }

  const renderMessageContent = (msg) => {
    if (msg.deleted_at) return <p className="whitespace-pre-wrap break-words">{msg.content}</p>
    if (msg.type === 'audio' && msg.audio_url) {
      return (
        <div>
          <AuthenticatedAudio audioUrl={msg.audio_url} />
          {msg.audio_duration > 0 && <p className="text-xs opacity-75 mt-1">{Math.floor(msg.audio_duration / 60)}:{(msg.audio_duration % 60).toString().padStart(2, '0')}</p>}
        </div>
      )
    }
    if (msg.type === 'file' && msg.file_url) return <FileAttachment fileUrl={msg.file_url} fileName={msg.file_name} type={msg.type} />
    const urls = extractUrls(msg.content)
    return (
      <div>
        <p className="whitespace-pre-wrap break-words">{renderTextWithMentions(msg.content)}</p>
        {urls.map((url, i) => <LinkPreview key={i} url={url} />)}
      </div>
    )
  }

  if (loadingRoom) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 size={32} className="mx-auto text-primary-500 animate-spin mb-3" />
          <p className="text-sm text-text-secondary dark:text-gray-400">Loading project chat...</p>
        </div>
      </div>
    )
  }

  if (roomError) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <MessageCircle size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm text-red-500 dark:text-red-400">{roomError}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-16rem)] bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Chat header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageCircle size={20} className="text-primary-500" />
          <div>
            <h3 className="font-semibold text-sm dark:text-gray-100">{room?.name || 'Project Chat'}</h3>
            <p className="text-xs text-text-secondary dark:text-gray-400">{room?.members?.length || 0} members</p>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 dark:bg-gray-900">
        {hasMore && (
          <div className="text-center">
            <button onClick={handleLoadMore} className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium">
              Load older messages
            </button>
          </div>
        )}

        {isLoading && messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="space-y-4 w-full max-w-md px-4">
              {[1, 2, 3].map(i => (
                <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                  <div className={`rounded-2xl animate-pulse bg-gray-200 dark:bg-gray-700 ${i % 2 === 0 ? 'w-48' : 'w-56'} h-10`} />
                </div>
              ))}
            </div>
          </div>
        )}

        {messages.length === 0 && !isLoading && (
          <div className="flex items-center justify-center h-full">
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
            <div key={msg.id} id={`msg-${msg.id}`} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} transition-colors duration-500`}>
              {!isOwn && (
                <div className="flex-shrink-0 mr-2 mt-5">
                  {msg.sender_avatar ? (
                    <img src={getUploadUrl(msg.sender_avatar)} alt={msg.sender_name} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xs font-semibold text-white">
                      {msg.sender_name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                  )}
                </div>
              )}
              <div className={`max-w-[70%] group ${isOwn ? 'items-end' : 'items-start'}`}>
                {!isOwn && <p className="text-xs font-medium text-text-secondary dark:text-gray-400 mb-1 px-1">{msg.sender_name}</p>}
                <div className="flex items-end gap-1.5">
                  {isOwn && !isDeleted && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleReply(msg)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-primary-500" title="Reply"><Reply size={14} /></button>
                      <button onClick={() => handleStartEdit(msg)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-primary-500" title="Edit"><Pencil size={14} /></button>
                      <button onClick={() => handleDeleteMessage(msg.id)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500" title="Delete"><Trash2 size={14} /></button>
                    </div>
                  )}
                  <div className={`px-3.5 py-2 rounded-2xl text-sm ${
                    isDeleted ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 italic' :
                    isOwn ? 'bg-primary-500 text-white rounded-br-md' :
                    'bg-gray-100 dark:bg-gray-700 text-text-primary dark:text-gray-100 rounded-bl-md'
                  }`}>
                    {msg.reply_to_content && (
                      <div className="text-xs mb-1 px-2 py-1 rounded bg-black/5 dark:bg-white/5 border-l-2 border-primary-400">
                        <span className="font-medium">{msg.reply_to_sender_name}</span>
                        <p className="truncate opacity-75">{msg.reply_to_content}</p>
                      </div>
                    )}
                    {isEditing ? (
                      <div className="space-y-2">
                        <textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary-300" rows={2} autoFocus
                          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit() } if (e.key === 'Escape') handleCancelEdit() }}
                        />
                        <div className="flex items-center gap-1.5 justify-end">
                          <button onClick={handleCancelEdit} className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-600 text-text-secondary dark:text-gray-300 hover:bg-gray-300">Cancel</button>
                          <button onClick={handleSaveEdit} className="text-xs px-2 py-0.5 rounded bg-primary-500 text-white hover:bg-primary-600">Save</button>
                        </div>
                      </div>
                    ) : renderMessageContent(msg)}
                  </div>
                  {!isOwn && !isDeleted && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleReply(msg)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-primary-500" title="Reply"><Reply size={14} /></button>
                      {(isAdmin || msg.sender_id === user?.id) && (
                        <button onClick={() => handleDeleteMessage(msg.id)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500" title="Delete"><Trash2 size={14} /></button>
                      )}
                    </div>
                  )}
                </div>
                {!isDeleted && <MessageReactions reactions={msg.reactions || []} currentUserId={user?.id} onToggleReaction={(emoji) => handleToggleReaction(msg.id, emoji)} />}
                <p className={`text-[10px] text-text-secondary dark:text-gray-500 mt-0.5 px-1 ${isOwn ? 'text-right' : ''}`}>
                  {formatMessageTime(msg.created_at)}
                  {msg.edited_at && <span className="ml-1 opacity-75">(edited)</span>}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply preview */}
      {replyingTo && (
        <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center gap-2">
          <Reply size={14} className="text-primary-500" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-primary-600 dark:text-primary-400">{replyingTo.sender_name}</p>
            <p className="text-xs text-text-secondary dark:text-gray-400 truncate">{replyingTo.content}</p>
          </div>
          <button onClick={handleCancelReply} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"><X size={14} className="dark:text-gray-400" /></button>
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteMsgConfirm && (
        <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 bg-red-50 dark:bg-red-900/20 flex items-center justify-between">
          <span className="text-sm text-red-600 dark:text-red-400">Delete this message?</span>
          <div className="flex gap-2">
            <button onClick={() => setShowDeleteMsgConfirm(null)} className="text-xs px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 text-text-secondary dark:text-gray-400">Cancel</button>
            <button onClick={confirmDeleteMessage} className="text-xs px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600">Delete</button>
          </div>
        </div>
      )}

      {/* Message input */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {typingUsers.length > 0 && (
          <div className="px-2 py-1 text-xs text-text-secondary dark:text-gray-400 flex items-center gap-1.5">
            <span className="flex gap-0.5">
              <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
            {typingUsers.map(u => u.name.split(' ')[0]).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </div>
        )}
        <form onSubmit={handleSendMessage} className="flex items-end gap-2">
          <div className="relative">
            <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-2.5 rounded-xl text-text-secondary dark:text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors" title="Emoji">
              <Smile size={18} />
            </button>
            {showEmojiPicker && <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />}
          </div>
          <ChatFileUpload onFileSelect={handleFileSelect} disabled={isSending} />
          <AudioRecorder onRecordingComplete={handleRecordingComplete} disabled={isSending} />
          <div className="flex-1 relative">
            {showMentions && room?.members && <MentionAutocomplete members={room.members} query={mentionQuery} onSelect={handleMentionSelect} />}
            <textarea
              ref={textareaRef}
              value={messageText}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message... (@ to mention)"
              rows={1}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:bg-white dark:focus:bg-gray-800 resize-none text-sm placeholder:text-gray-400"
              style={{ maxHeight: '120px', minHeight: '42px' }}
              onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
            />
          </div>
          <button type="submit" disabled={!messageText.trim() || isSending} className="p-2.5 rounded-xl bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  )
}
