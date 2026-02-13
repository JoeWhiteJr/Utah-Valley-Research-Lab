import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { X, Plus, ArrowLeft, Send, Trash2, MessageSquare, FolderKanban, Layers } from 'lucide-react'
import { useAssistantStore } from '../../store/assistantStore'
import AssistantMessage from './AssistantMessage'

export default function AssistantSidebar() {
  const {
    isOpen, closeSidebar,
    conversations, currentConversation, messages,
    isLoading, isSending, error,
    checkStatus, fetchConversations, createConversation,
    loadConversation, sendMessage, deleteConversation,
    clearCurrentConversation, clearError, status
  } = useAssistantStore()

  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const location = useLocation()

  // Detect project context from URL
  const projectMatch = location.pathname.match(/\/dashboard\/projects\/([^/]+)/)
  const currentProjectId = projectMatch ? projectMatch[1] : null

  // Check status and load conversations when sidebar opens
  useEffect(() => {
    if (isOpen) {
      checkStatus()
      fetchConversations()
    }
  }, [isOpen, checkStatus, fetchConversations])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when conversation loads
  useEffect(() => {
    if (currentConversation && inputRef.current) {
      inputRef.current.focus()
    }
  }, [currentConversation])

  const handleSend = async () => {
    if (!input.trim() || isSending) return
    const msg = input.trim()
    setInput('')
    await sendMessage(msg)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleNewConversation = async () => {
    await createConversation(currentProjectId)
  }

  const handleDeleteConversation = async (e, id) => {
    e.stopPropagation()
    await deleteConversation(id)
  }

  if (!isOpen) return null

  return (
    <>
      {/* Mobile overlay */}
      <div
        className="fixed inset-0 bg-black/20 z-40 lg:hidden"
        onClick={closeSidebar}
      />

      {/* Sidebar panel */}
      <div className="fixed top-0 right-0 h-full w-full sm:w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 z-50 flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            {currentConversation && (
              <button
                onClick={clearCurrentConversation}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-text-secondary dark:text-gray-400"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <h2 className="font-semibold text-text-primary dark:text-gray-100 text-sm">
              AI Research Assistant
            </h2>
          </div>
          <div className="flex items-center gap-1">
            {!currentConversation && (
              <button
                onClick={handleNewConversation}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-text-secondary dark:text-gray-400"
                title="New conversation"
              >
                <Plus size={16} />
              </button>
            )}
            <button
              onClick={closeSidebar}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-text-secondary dark:text-gray-400"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scope badge */}
        <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2 text-xs text-text-secondary dark:text-gray-400">
          {currentProjectId ? (
            <>
              <FolderKanban size={12} />
              <span>Searching current project</span>
            </>
          ) : (
            <>
              <Layers size={12} />
              <span>Searching all projects</span>
            </>
          )}
        </div>

        {/* Status warning */}
        {status && !status.available && (
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs">
            {status.message}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs flex items-center justify-between">
            <span>{error}</span>
            <button onClick={clearError} className="ml-2 underline">Dismiss</button>
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          {currentConversation ? (
            // Messages view
            <div className="p-4 space-y-4">
              {messages.length === 0 && !isLoading && (
                <div className="text-center text-sm text-text-secondary dark:text-gray-400 py-8">
                  <p className="font-medium mb-1">Ask a question</p>
                  <p>I'll search through your research documents to find answers.</p>
                </div>
              )}
              {messages.map((msg) => (
                <AssistantMessage key={msg.id} message={msg} />
              ))}
              {isSending && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                  <div className="flex items-center text-sm text-text-secondary dark:text-gray-400">
                    Thinking...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            // Conversation list view
            <div className="p-2">
              {isLoading ? (
                <div className="text-center text-sm text-text-secondary dark:text-gray-400 py-8">
                  Loading...
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center text-sm text-text-secondary dark:text-gray-400 py-8">
                  <MessageSquare size={32} className="mx-auto mb-3 opacity-50" />
                  <p className="font-medium mb-1">No conversations yet</p>
                  <p>Start a new conversation to ask questions about your research documents.</p>
                  <button
                    onClick={handleNewConversation}
                    className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition-colors"
                  >
                    New Conversation
                  </button>
                </div>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => loadConversation(conv.id)}
                    className="w-full text-left p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary dark:text-gray-100 truncate">
                          {conv.title}
                        </p>
                        {conv.project_title && (
                          <p className="text-xs text-text-secondary dark:text-gray-400 mt-0.5 flex items-center gap-1">
                            <FolderKanban size={10} />
                            {conv.project_title}
                          </p>
                        )}
                        {conv.last_message && (
                          <p className="text-xs text-text-secondary dark:text-gray-400 mt-1 truncate">
                            {conv.last_message}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={(e) => handleDeleteConversation(e, conv.id)}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Input area - only when in a conversation */}
        {currentConversation && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your research..."
                rows={1}
                className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
                  text-sm text-text-primary dark:text-gray-100 placeholder-gray-400
                  px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                  max-h-32 overflow-y-auto"
                style={{ minHeight: '38px' }}
                onInput={(e) => {
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px'
                }}
                disabled={isSending || (status && !status.available)}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isSending || (status && !status.available)}
                className="p-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700
                  disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
