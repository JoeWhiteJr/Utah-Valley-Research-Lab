import { FileText, Image, File, Download, Trash2, Music, Video, FileSpreadsheet, Eye } from 'lucide-react'
import { format } from 'date-fns'
import { getUploadUrl } from '../services/api'

const fileIcons = {
  'application/pdf': FileText,
  'image/jpeg': Image,
  'image/png': Image,
  'image/gif': Image,
  'image/webp': Image,
  'audio/mpeg': Music,
  'audio/wav': Music,
  'audio/ogg': Music,
  'video/mp4': Video,
  'video/webm': Video,
  'application/vnd.ms-excel': FileSpreadsheet,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': FileSpreadsheet,
  'text/csv': FileSpreadsheet,
  default: File
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export default function FileCard({ file, onDownload, onDelete, onPreview }) {
  const Icon = fileIcons[file.file_type] || fileIcons.default
  const isImage = file.file_type?.startsWith('image/')

  const handleClick = (e) => {
    // Don't trigger preview if clicking on action buttons
    if (e.target.closest('button')) return
    if (onPreview) onPreview(file)
  }

  return (
    <div
      className="group bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-sm transition-all cursor-pointer"
      onClick={handleClick}
    >
      {/* Preview area */}
      <div className="h-32 bg-gray-50 dark:bg-gray-900 flex items-center justify-center relative">
        {isImage ? (
          <img
            src={getUploadUrl(`/uploads/${file.filename}`)}
            alt={file.original_filename}
            className="w-full h-full object-cover"
          />
        ) : (
          <Icon size={40} className="text-gray-400 dark:text-gray-500" />
        )}

        {/* Hover actions */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          {onPreview && (
            <button
              onClick={(e) => { e.stopPropagation(); onPreview(file); }}
              className="p-2 bg-white dark:bg-gray-700 rounded-lg text-text-primary hover:bg-gray-100 dark:hover:bg-gray-600"
              title="Preview"
            >
              <Eye size={18} />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDownload(file); }}
            className="p-2 bg-white dark:bg-gray-700 rounded-lg text-text-primary hover:bg-gray-100 dark:hover:bg-gray-600"
            title="Download"
          >
            <Download size={18} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(file.id); }}
            className="p-2 bg-white dark:bg-gray-700 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
            title="Delete"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-sm font-medium text-text-primary dark:text-gray-100 truncate" title={file.original_filename}>
          {file.original_filename}
        </p>
        <div className="flex items-center justify-between mt-1 text-xs text-text-secondary dark:text-gray-400">
          <span>{formatFileSize(file.file_size)}</span>
          <span>{format(new Date(file.uploaded_at), 'MMM d')}</span>
        </div>
      </div>
    </div>
  )
}
