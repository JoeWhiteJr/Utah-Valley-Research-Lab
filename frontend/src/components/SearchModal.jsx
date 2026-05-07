import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchApi } from '../services/api'
import { Search, FolderKanban, CheckSquare, MessageCircle } from 'lucide-react'

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function SearchModal({ isOpen, onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)
  const dialogRef = useRef(null)
  const previousFocusRef = useRef(null)
  const onCloseRef = useRef(onClose)
  const navigate = useNavigate()
  const debounceRef = useRef(null)

  // Keep onClose ref fresh without re-binding the document listener
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setResults([])
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  const doSearch = useCallback(async (term) => {
    if (term.trim().length < 2) {
      setResults([])
      return
    }
    setIsSearching(true)
    try {
      const { data } = await searchApi.search(term)
      setResults(data.results || [])
      setSelectedIndex(0)
    } catch {
      setResults([])
    }
    setIsSearching(false)
  }, [])

  const handleInputChange = (e) => {
    const val = e.target.value
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(val), 300)
  }

  const handleSelect = (result) => {
    onClose()
    navigate(result.url)
  }

  // Input-scoped keys (ArrowUp/Down/Enter) — Escape and Tab are handled at document level below
  const handleInputKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleSelect(results[selectedIndex])
    }
  }

  // Document-level Escape + focus trap (works regardless of focused element inside the modal)
  const handleDocumentKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCloseRef.current()
      return
    }
    if (e.key !== 'Tab' || !dialogRef.current) return

    const focusable = dialogRef.current.querySelectorAll(FOCUSABLE)
    if (focusable.length === 0) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (e.shiftKey) {
      if (document.activeElement === first || !dialogRef.current.contains(document.activeElement)) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (document.activeElement === last || !dialogRef.current.contains(document.activeElement)) {
        e.preventDefault()
        first.focus()
      }
    }
  }, [])

  // Wire/unwire document listener + return-focus-on-close
  useEffect(() => {
    if (!isOpen) return
    previousFocusRef.current = document.activeElement
    document.addEventListener('keydown', handleDocumentKeyDown)

    return () => {
      document.removeEventListener('keydown', handleDocumentKeyDown)
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus()
      }
    }
  }, [isOpen, handleDocumentKeyDown])

  // Body scroll lock while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      const otherModals = document.querySelectorAll('[data-modal]')
      if (otherModals.length <= 1) {
        document.body.style.overflow = 'unset'
      }
    }
  }, [isOpen])

  const getIcon = (type) => {
    switch (type) {
      case 'project': return <FolderKanban size={16} className="text-primary-500" />
      case 'task': return <CheckSquare size={16} className="text-secondary-500" />
      case 'message': return <MessageCircle size={16} className="text-accent-500" />
      default: return <Search size={16} />
    }
  }

  const getTypeLabel = (type) => {
    switch (type) {
      case 'project': return 'Project'
      case 'task': return 'Task'
      case 'message': return 'Message'
      default: return type
    }
  }

  if (!isOpen) return null

  return (
    <div data-modal className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-modal-title"
        className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="search-modal-title" className="sr-only">Global search</h2>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <Search size={20} className="text-text-secondary dark:text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            placeholder="Search projects, tasks, messages..."
            aria-label="Search projects, tasks, and messages"
            className="flex-1 text-sm outline-none bg-transparent text-text-primary dark:text-gray-100 placeholder-text-secondary dark:placeholder-gray-500"
          />
          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-xs text-text-secondary dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {isSearching && (
            <div className="p-4 text-center text-sm text-text-secondary dark:text-gray-400">Searching...</div>
          )}

          {!isSearching && query.length >= 2 && results.length === 0 && (
            <div className="p-8 text-center text-sm text-text-secondary dark:text-gray-400">
              No results found for &ldquo;{query}&rdquo;
            </div>
          )}

          {results.map((result, idx) => (
            <button
              key={`${result.type}-${result.id}`}
              onClick={() => handleSelect(result)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                idx === selectedIndex ? 'bg-primary-50 dark:bg-primary-900/30' : ''
              }`}
            >
              {getIcon(result.type)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary dark:text-gray-100 truncate">{result.title}</p>
                {result.subtitle && (
                  <p className="text-xs text-text-secondary dark:text-gray-400 truncate">{result.subtitle}</p>
                )}
              </div>
              <span className="text-xs text-text-secondary dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                {getTypeLabel(result.type)}
              </span>
            </button>
          ))}
        </div>

        {query.length < 2 && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 text-xs text-text-secondary dark:text-gray-400 flex items-center gap-4">
            <span><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 text-text-secondary dark:text-gray-300">↑↓</kbd> Navigate</span>
            <span><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 text-text-secondary dark:text-gray-300">↵</kbd> Select</span>
            <span><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 text-text-secondary dark:text-gray-300">Esc</kbd> Close</span>
          </div>
        )}
      </div>
    </div>
  )
}
