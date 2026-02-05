import { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'

export default function SearchInput({
  value: controlledValue,
  onChange,
  placeholder = 'Search...',
  debounce = 300,
  className = '',
}) {
  const [internalValue, setInternalValue] = useState(controlledValue || '')
  const timerRef = useRef(null)

  useEffect(() => {
    if (controlledValue !== undefined) {
      setInternalValue(controlledValue)
    }
  }, [controlledValue])

  const handleChange = (e) => {
    const val = e.target.value
    setInternalValue(val)

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      onChange?.(val)
    }, debounce)
  }

  const handleClear = () => {
    setInternalValue('')
    onChange?.('')
  }

  return (
    <div className={`relative ${className}`}>
      <Search
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none"
      />
      <input
        type="text"
        value={internalValue}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full pl-9 pr-9 py-2.5 rounded-organic border border-gray-300 bg-white text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition-colors text-sm"
      />
      {internalValue && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-100 text-text-secondary transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
