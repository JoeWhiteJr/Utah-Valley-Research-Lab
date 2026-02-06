import { useState, useRef, useEffect } from 'react'
import ReactDatePicker from 'react-datepicker'
import { format } from 'date-fns'
import { Calendar, Check, X } from 'lucide-react'
import 'react-datepicker/dist/react-datepicker.css'

export default function DatePicker({
  label,
  value,
  onChange,
  placeholder = 'Select date',
  error,
  className = '',
  required = false
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(value ? new Date(value) : null)
  const containerRef = useRef(null)

  // Update internal state when value prop changes
  useEffect(() => {
    setSelectedDate(value ? new Date(value) : null)
  }, [value])

  const handleDateChange = (date) => {
    setSelectedDate(date)
  }

  const handleConfirm = () => {
    onChange(selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '')
    setIsOpen(false)
  }

  const handleClear = () => {
    setSelectedDate(null)
    onChange('')
    setIsOpen(false)
  }

  const handleCancel = () => {
    // Reset to original value
    setSelectedDate(value ? new Date(value) : null)
    setIsOpen(false)
  }

  // Format display value
  const displayValue = value
    ? format(new Date(value), 'MMM d, yyyy')
    : ''

  return (
    <div className={className} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-text-primary mb-1.5">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`
            w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-organic border bg-white
            text-left
            focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400
            transition-colors
            ${error ? 'border-red-400 focus:ring-red-300 focus:border-red-400' : 'border-gray-300'}
            ${displayValue ? 'text-text-primary' : 'text-text-secondary'}
          `}
        >
          <span>{displayValue || placeholder}</span>
          <Calendar size={18} className="text-text-secondary flex-shrink-0" />
        </button>

        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={handleCancel}
            />

            {/* Calendar Popup */}
            <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
              <ReactDatePicker
                selected={selectedDate}
                onChange={handleDateChange}
                inline
                calendarClassName="custom-datepicker"
                dayClassName={() => 'hover:bg-primary-100 rounded-full'}
              />

              {/* Action buttons */}
              <div className="flex items-center justify-between gap-2 p-3 border-t border-gray-200 bg-gray-50">
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  <X size={14} />
                  Clear
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="flex items-center gap-1 px-4 py-1.5 text-sm font-medium bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
                  >
                    <Check size={14} />
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {error && (
        <p className="mt-1.5 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
