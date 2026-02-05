import { useState, useRef } from 'react'
import { Upload, FileUp } from 'lucide-react'

export default function DropZone({
  onFiles,
  accept,
  multiple = true,
  maxSizeMB = 50,
  label = 'Drop files here or click to upload',
  sublabel,
  compact = false,
  className = '',
}) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef(null)

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    processFiles(files)
  }

  const handleInputChange = (e) => {
    const files = Array.from(e.target.files)
    processFiles(files)
    e.target.value = ''
  }

  const processFiles = (files) => {
    const maxBytes = maxSizeMB * 1024 * 1024
    const valid = files.filter((f) => f.size <= maxBytes)
    if (valid.length > 0) {
      onFiles?.(multiple ? valid : [valid[0]])
    }
  }

  if (compact) {
    return (
      <button
        onClick={() => inputRef.current?.click()}
        className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-organic hover:bg-primary-100 transition-colors ${className}`}
      >
        <FileUp size={16} />
        Upload
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          className="hidden"
        />
      </button>
    )
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`
        relative rounded-xl border-2 border-dashed cursor-pointer transition-colors
        ${
          isDragging
            ? 'border-primary-400 bg-primary-50'
            : 'border-gray-300 bg-gray-50 hover:border-primary-300 hover:bg-primary-50/50'
        }
        ${className}
      `}
    >
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <div className={`p-3 rounded-full mb-3 ${isDragging ? 'bg-primary-100' : 'bg-gray-100'}`}>
          <Upload size={24} className={isDragging ? 'text-primary-500' : 'text-text-secondary'} />
        </div>
        <p className="text-sm font-medium text-text-primary">{label}</p>
        <p className="text-xs text-text-secondary mt-1">
          {sublabel || `Max ${maxSizeMB}MB per file`}
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleInputChange}
        className="hidden"
      />
    </div>
  )
}
