import { useState, useEffect, useRef } from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import { useChatStore } from '../../store/chatStore'
import { formatDistanceToNow } from 'date-fns'

export default function ChatSearchBar({ roomId, onClose, onResultClick }) {
  const [query, setQuery] = useState('')
  const { searchMessages, searchResults, isSearching, clearSearch } = useChatStore()
  const debounceRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    return () => clearSearch()
  }, [clearSearch])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      clearSearch()
      return
    }
    debounceRef.current = setTimeout(() => {
      searchMessages(roomId, query.trim())
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, roomId, searchMessages, clearSearch])

  const handleClose = () => {
    clearSearch()
    onClose()
  }

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="flex items-center gap-2 px-4 py-2">
        <Search size={16} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search messages..."
          className="flex-1 bg-transparent text-sm text-text-primary dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none"
        />
        {isSearching && <Loader2 size={16} className="text-gray-400 animate-spin flex-shrink-0" />}
        <button
          onClick={handleClose}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500"
        >
          <X size={16} />
        </button>
      </div>
      {searchResults.length > 0 && (
        <div className="max-h-64 overflow-y-auto border-t border-gray-100 dark:border-gray-700">
          {searchResults.map((msg) => (
            <button
              key={msg.id}
              onClick={() => onResultClick(msg)}
              className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-50 dark:border-gray-700/50"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-primary-600 dark:text-primary-400">{msg.sender_name}</span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                  {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                </span>
              </div>
              <p className="text-xs text-text-secondary dark:text-gray-400 truncate mt-0.5">
                {msg.content?.length > 100 ? msg.content.substring(0, 100) + '...' : msg.content}
              </p>
            </button>
          ))}
        </div>
      )}
      {query.trim() && !isSearching && searchResults.length === 0 && (
        <div className="px-4 py-3 text-xs text-center text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700">
          No messages found
        </div>
      )}
    </div>
  )
}
