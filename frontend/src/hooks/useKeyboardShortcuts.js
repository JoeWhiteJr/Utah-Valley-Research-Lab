import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

export default function useKeyboardShortcuts({ onSearch, onShortcutsHelp }) {
  const navigate = useNavigate()
  const gPressedRef = useRef(false)
  const gTimeoutRef = useRef(null)

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger when typing in inputs
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) {
        return
      }

      // Cmd/Ctrl + / for shortcuts help
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault()
        onShortcutsHelp?.()
        return
      }

      // G + key navigation (two-key chord)
      if (e.key === 'g' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        gPressedRef.current = true
        if (gTimeoutRef.current) clearTimeout(gTimeoutRef.current)
        gTimeoutRef.current = setTimeout(() => {
          gPressedRef.current = false
        }, 1000)
        return
      }

      if (gPressedRef.current) {
        gPressedRef.current = false
        if (gTimeoutRef.current) clearTimeout(gTimeoutRef.current)
        switch (e.key) {
          case 'd': navigate('/dashboard'); break
          case 'p': navigate('/dashboard/projects'); break
          case 'c': navigate('/dashboard/chat'); break
          case 's': navigate('/dashboard/settings'); break
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [navigate, onSearch, onShortcutsHelp])
}
