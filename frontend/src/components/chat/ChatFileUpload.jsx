import { useRef, useState, useEffect } from 'react'
import { Paperclip, FileText, Download } from 'lucide-react'
import { getUploadUrl, fetchAuthenticatedBlobUrl } from '../../services/api'

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm',
  'video/mp4', 'video/webm'
]

const MAX_FILE_SIZE = 25 * 1024 * 1024

export default function ChatFileUpload({ onFileSelect, disabled }) {
  const fileInputRef = useRef(null)

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ALLOWED_TYPES.includes(file.type)) {
      alert('File type not supported. Please upload images, documents, audio, or video files.')
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      alert('File is too large. Maximum size is 25MB.')
      return
    }

    onFileSelect(file)
    e.target.value = ''
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
        accept={ALLOWED_TYPES.join(',')}
        className="hidden"
      />
      <button
        onClick={handleClick}
        disabled={disabled}
        className="p-2.5 rounded-xl text-text-secondary hover:text-primary-600 hover:bg-primary-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Attach file"
      >
        <Paperclip size={18} />
      </button>
    </>
  )
}

export function FileAttachment({ fileUrl, fileName, type }) {
  const isChatUpload = fileUrl && fileUrl.startsWith('/uploads/chat/')
  const [blobUrl, setBlobUrl] = useState(null)
  const blobUrlRef = useRef(null)
  const directUrl = getUploadUrl(fileUrl)
  const isImage = type === 'file' && fileName && /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName)

  useEffect(() => {
    if (isChatUpload && fileUrl) {
      let cancelled = false
      fetchAuthenticatedBlobUrl(fileUrl).then((url) => {
        if (!cancelled && url) {
          blobUrlRef.current = url
          setBlobUrl(url)
        }
      })
      return () => {
        cancelled = true
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
      }
    }
  }, [fileUrl, isChatUpload])

  const url = isChatUpload ? blobUrl : directUrl

  if (!url) {
    return (
      <div className="flex items-center gap-2 mt-1.5 px-3 py-2 bg-black/10 rounded-lg opacity-50">
        <FileText size={16} />
        <span className="text-sm truncate flex-1">{fileName || 'Loading...'}</span>
      </div>
    )
  }

  if (isImage) {
    return (
      <div className="mt-1.5">
        <img
          src={url}
          alt={fileName}
          loading="lazy"
          decoding="async"
          className="max-w-full max-h-60 rounded-lg cursor-pointer"
          onClick={() => window.open(url, '_blank')}
        />
        <p className="text-xs opacity-75 mt-1">{fileName}</p>
      </div>
    )
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 mt-1.5 px-3 py-2 bg-black/10 rounded-lg hover:bg-black/15 transition-colors"
    >
      <FileText size={16} />
      <span className="text-sm truncate flex-1">{fileName || 'File'}</span>
      <Download size={14} className="shrink-0" />
    </a>
  )
}

export function LinkPreview({ url }) {
  let hostname = ''
  try {
    hostname = new URL(url).hostname
  } catch { /* ignore */ }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block mt-1.5 px-3 py-2 bg-black/10 rounded-lg hover:bg-black/15 transition-colors text-xs"
    >
      <span className="font-medium">{hostname}</span>
      <span className="block truncate opacity-75 mt-0.5">{url}</span>
    </a>
  )
}
