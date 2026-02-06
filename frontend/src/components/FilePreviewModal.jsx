import { useEffect, useCallback } from 'react'
import { X, Download, Trash2, FileText, File, Music, Video, FileSpreadsheet } from 'lucide-react'
import { format } from 'date-fns'
import { getUploadUrl } from '../services/api'
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
  if (mimeType.includes('word') || mimeType.includes('document')) return 'document'
  return 'other'
}

export default function FilePreviewModal({ file, onClose, onDownload, onDelete }) {
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

  if (!file) return null

  const fileUrl = getUploadUrl(`/uploads/${file.filename}`)
  const fileType = getFileTypeCategory(file.file_type)

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  const renderPreview = () => {
    switch (fileType) {
      case 'image':
        return (
          <img
            src={fileUrl}
            alt={file.original_filename}
            className="max-w-full max-h-[70vh] object-contain rounded-lg"
          />
        )

      case 'pdf':
        return (
          <iframe
            src={fileUrl}
            title={file.original_filename}
            className="w-full h-[70vh] rounded-lg bg-white"
          />
        )

      case 'audio':
        return (
          <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4">
            <Music size={64} className="text-primary-500" />
            <p className="text-lg font-medium text-text-primary">{file.original_filename}</p>
            <audio controls className="w-full max-w-md" src={fileUrl}>
              Your browser does not support the audio element.
            </audio>
          </div>
        )

      case 'video':
        return (
          <video
            controls
            className="max-w-full max-h-[70vh] rounded-lg"
            src={fileUrl}
          >
            Your browser does not support the video element.
          </video>
        )

      case 'spreadsheet':
        return (
          <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4">
            <FileSpreadsheet size={64} className="text-green-600" />
            <p className="text-lg font-medium text-text-primary">{file.original_filename}</p>
            <p className="text-text-secondary">Spreadsheet preview not available</p>
            <p className="text-sm text-text-secondary">Download the file to view it</p>
          </div>
        )

      case 'document':
        return (
          <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4">
            <FileText size={64} className="text-blue-600" />
            <p className="text-lg font-medium text-text-primary">{file.original_filename}</p>
            <p className="text-text-secondary">Document preview not available</p>
            <p className="text-sm text-text-secondary">Download the file to view it</p>
          </div>
        )

      default:
        return (
          <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4">
            <File size={64} className="text-gray-500" />
            <p className="text-lg font-medium text-text-primary">{file.original_filename}</p>
            <p className="text-text-secondary">Preview not available for this file type</p>
            <p className="text-sm text-text-secondary">Download the file to view it</p>
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
        <div className="flex items-center justify-between bg-white rounded-t-xl px-4 py-3 border-b border-gray-200">
          <div className="flex-1 min-w-0 mr-4">
            <h3 className="font-medium text-text-primary truncate" title={file.original_filename}>
              {file.original_filename}
            </h3>
            <div className="flex items-center gap-3 text-sm text-text-secondary">
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
              className="p-2 text-text-secondary hover:text-text-primary hover:bg-gray-100 rounded-lg transition-colors"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-gray-100 rounded-b-xl p-4 flex items-center justify-center">
          {renderPreview()}
        </div>
      </div>
    </div>
  )
}
