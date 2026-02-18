import { useEffect, useRef, useCallback } from 'react'
import { X } from 'lucide-react'

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  const modalRef = useRef(null)
  const previousFocusRef = useRef(null)
  const onCloseRef = useRef(onClose)

  // Keep the ref up to date without triggering effect re-runs
  useEffect(() => {
    onCloseRef.current = onClose
  })

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      onCloseRef.current()
      return
    }
    if (e.key !== 'Tab' || !modalRef.current) return

    const focusable = modalRef.current.querySelectorAll(FOCUSABLE)
    if (focusable.length === 0) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    previousFocusRef.current = document.activeElement
    document.addEventListener('keydown', handleKeyDown)

    // Focus first focusable element after render
    requestAnimationFrame(() => {
      if (modalRef.current) {
        const focusable = modalRef.current.querySelectorAll(FOCUSABLE)
        if (focusable.length > 0) focusable[0].focus()
      }
    })

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      // Restore focus to the element that opened the modal
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus()
      }
    }
  }, [isOpen, handleKeyDown])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      // Only restore scroll if no other modals are open
      const otherModals = document.querySelectorAll('[data-modal]');
      if (otherModals.length <= 1) {
        document.body.style.overflow = 'unset'
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[90vw] w-[90vw]'
  }

  return (
    <div data-modal className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={modalRef}
        className={`relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full ${sizes[size]} max-h-[90vh] overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 id="modal-title" className="font-display font-semibold text-lg text-text-primary dark:text-gray-100">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-text-secondary dark:text-gray-400 hover:text-text-primary dark:hover:text-gray-200 transition-colors"
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}
