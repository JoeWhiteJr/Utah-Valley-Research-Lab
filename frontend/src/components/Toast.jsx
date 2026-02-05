import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useToastStore } from '../store/toastStore'

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const styles = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  info: 'bg-primary-50 border-primary-200 text-primary-800',
}

const iconStyles = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-primary-500',
}

function ToastItem({ toast: t, onRemove }) {
  const [isExiting, setIsExiting] = useState(false)

  const handleRemove = useCallback(() => {
    setIsExiting(true)
    setTimeout(() => onRemove(t.id), 200)
  }, [t.id, onRemove])

  useEffect(() => {
    const timer = setTimeout(handleRemove, t.duration)
    return () => clearTimeout(timer)
  }, [t.duration, handleRemove])

  const Icon = icons[t.type] || Info

  return (
    <div
      className={`
        flex items-start gap-3 px-4 py-3 rounded-organic border shadow-lg
        ${styles[t.type]}
        ${isExiting ? 'animate-toast-exit' : 'animate-toast-enter'}
      `}
      role="alert"
    >
      <Icon size={18} className={`mt-0.5 flex-shrink-0 ${iconStyles[t.type]}`} />
      <p className="text-sm font-medium flex-1">{t.message}</p>
      <button
        onClick={handleRemove}
        className="flex-shrink-0 p-0.5 rounded hover:bg-black/5 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  )
}

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onRemove={removeToast} />
        </div>
      ))}
    </div>
  )
}
