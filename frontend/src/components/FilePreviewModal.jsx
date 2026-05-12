import { useState, useEffect, useCallback } from 'react'
import { X, Download, Trash2, FileText, File, Music, FileSpreadsheet, Loader2, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { getUploadUrl, filesApi } from '../services/api'
import Button from './Button'

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function getFileTypeCategory(mimeType) {
  if (!mimeType) return 'other'
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv') return 'spreadsheet'
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation'
  if (mimeType.includes('word') || mimeType.includes('document')) return 'document'
  if (mimeType === 'text/plain' || mimeType === 'application/json' || mimeType === 'text/markdown') return 'text'
  return 'other'
}

const MEDIA_TYPES = ['image', 'pdf', 'audio', 'video']
const RENDERED_TYPES = ['document', 'spreadsheet', 'presentation', 'text']

export default function FilePreviewModal({ file, onClose, onDownload, onDelete }) {
  const [viewUrl, setViewUrl] = useState(null)
  const [previewHtml, setPreviewHtml] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Handle escape key
  const handleEscape = useCallback((e) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (file) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [file, handleEscape])

  // Fetch a view-url for inline media or rendered HTML for documents. Bail
  // out fast for "other" files (we just render a friendly placeholder) so we
  // don't fire useless requests. AbortController guards against a stale
  // response landing after the modal switches to a different file.
  useEffect(() => {
    if (!file) return undefined

    const fileType = getFileTypeCategory(file.file_type)
    setLoading(MEDIA_TYPES.includes(fileType) || RENDERED_TYPES.includes(fileType))
    setError(null)
    setViewUrl(null)
    setPreviewHtml(null)

    let cancelled = false

    if (MEDIA_TYPES.includes(fileType)) {
      filesApi.getViewUrl(file.id)
        .then((res) => {
          if (cancelled) return
          setViewUrl(res.data?.url || null)
          setLoading(false)
        })
        .catch(() => {
          if (cancelled) return
          // Last-ditch fallback to the public /uploads path so users still
          // see something for local-storage deployments where the endpoint
          // is unreachable for some reason.
          setViewUrl(getUploadUrl(`/uploads/${file.filename}`))
          setLoading(false)
        })
    } else if (RENDERED_TYPES.includes(fileType)) {
      filesApi.getPreviewHtml(file.id)
        .then((res) => {
          if (cancelled) return
          const html = typeof res.data === 'string' ? res.data : (res.data?.html || '')
          setPreviewHtml(html)
          setLoading(false)
        })
        .catch(() => {
          if (cancelled) return
          setError('Preview not available. Download the file to view it.')
          setLoading(false)
        })
    }

    return () => {
      cancelled = true
    }
  }, [file])

  if (!file) return null

  const fileType = getFileTypeCategory(file.file_type)

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  const renderPreview = () => {
    if (loading) {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 flex flex-col items-center gap-4">
          <Loader2 size={48} className="text-primary-500 animate-spin" />
          <p className="text-text-secondary dark:text-gray-400">Loading preview...</p>
        </div>
      )
    }

    if (error) {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 flex flex-col items-center gap-4">
          <AlertCircle size={48} className="text-red-500" />
          <p className="text-text-secondary dark:text-gray-400">{error}</p>
          <Button size="sm" variant="secondary" onClick={() => onDownload(file)}>
            <Download size={16} /> Download
          </Button>
        </div>
      )
    }

    switch (fileType) {
      case 'image':
        return (
          <img
            src={viewUrl}
            alt={file.original_filename}
            loading="lazy"
            decoding="async"
            className="max-w-full max-h-[70vh] object-contain rounded-lg"
          />
        )

      case 'pdf':
        return (
          <iframe
            src={viewUrl}
            title={file.original_filename}
            className="w-full h-[70vh] rounded-lg bg-white dark:bg-gray-800"
          />
        )

      case 'audio':
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 flex flex-col items-center gap-4">
            <Music size={64} className="text-primary-500" />
            <p className="text-lg font-medium text-text-primary dark:text-gray-100">{file.original_filename}</p>
            <audio controls className="w-full max-w-md" src={viewUrl}>
              Your browser does not support the audio element.
            </audio>
          </div>
        )

      case 'video':
        return (
          <video
            controls
            className="max-w-full max-h-[70vh] rounded-lg"
            src={viewUrl}
          >
            Your browser does not support the video element.
          </video>
        )

      case 'document':
      case 'spreadsheet':
      case 'presentation':
      case 'text':
        if (previewHtml) {
          return (
            <iframe
              srcDoc={previewHtml}
              sandbox="allow-same-origin"
              title={file.original_filename}
              className="w-full h-[70vh] rounded-lg bg-white"
            />
          )
        }
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 flex flex-col items-center gap-4">
            {fileType === 'spreadsheet'
              ? <FileSpreadsheet size={64} className="text-green-600" />
              : <FileText size={64} className="text-blue-600" />}
            <p className="text-lg font-medium text-text-primary dark:text-gray-100">{file.original_filename}</p>
            <p className="text-text-secondary dark:text-gray-400">Preview not available</p>
            <p className="text-sm text-text-secondary dark:text-gray-400">Download the file to view it</p>
          </div>
        )

      default:
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 flex flex-col items-center gap-4">
            <File size={64} className="text-gray-500" />
            <p className="text-lg font-medium text-text-primary dark:text-gray-100">{file.original_filename}</p>
            <p className="text-text-secondary dark:text-gray-400">Preview not available for this file type</p>
            <p className="text-sm text-text-secondary dark:text-gray-400">Download the file to view it</p>
          </div>
        )
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-t-xl px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex-1 min-w-0 mr-4">
            <h3 className="font-medium text-text-primary dark:text-gray-100 truncate" title={file.original_filename}>
              {file.original_filename}
            </h3>
            <div className="flex items-center gap-3 text-sm text-text-secondary dark:text-gray-400">
              <span>{formatFileSize(file.file_size)}</span>
              <span>Uploaded {format(new Date(file.uploaded_at), 'MMM d, yyyy')}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onDownload(file)}
              title="Download"
            >
              <Download size={16} />
              Download
            </Button>
            {onDelete && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => onDelete(file.id)}
                title="Delete"
              >
                <Trash2 size={16} />
              </Button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-text-secondary dark:text-gray-400 hover:text-text-primary dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900 rounded-b-xl p-4 flex items-center justify-center">
          {renderPreview()}
        </div>
      </div>
    </div>
  )
}
