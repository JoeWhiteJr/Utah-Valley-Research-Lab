import { useState, useEffect } from 'react'
import { Image, FileText, Download, Loader2 } from 'lucide-react'
import { chatApi, getUploadUrl } from '../../services/api'
import Modal from '../Modal'
import { format } from 'date-fns'

export default function MediaViewer({ roomId, isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('media')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen || !roomId) return
    setLoading(true)
    chatApi.getMedia(roomId, activeTab)
      .then(({ data }) => setItems(data.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [isOpen, roomId, activeTab])

  if (!isOpen) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Media & Files" size="lg">
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
        <button
          onClick={() => setActiveTab('media')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'media'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Image size={16} className="inline mr-1.5 -mt-0.5" />
          Media
        </button>
        <button
          onClick={() => setActiveTab('files')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'files'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <FileText size={16} className="inline mr-1.5 -mt-0.5" />
          Files
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400 dark:text-gray-500">
          {activeTab === 'media' ? 'No media shared yet' : 'No files shared yet'}
        </div>
      ) : activeTab === 'media' ? (
        <div className="grid grid-cols-3 gap-2 max-h-96 overflow-y-auto">
          {items.map((item) => {
            const url = getUploadUrl(item.file_url || item.audio_url)
            const isAudio = item.type === 'audio'
            return (
              <a
                key={item.id}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 hover:opacity-80 transition-opacity flex items-center justify-center"
              >
                {isAudio ? (
                  <div className="text-center p-2">
                    <div className="w-10 h-10 mx-auto rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-1">
                      <span className="text-lg">🎵</span>
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Audio</p>
                  </div>
                ) : (
                  <img src={url} alt={item.file_name || 'Media'} className="w-full h-full object-cover" />
                )}
              </a>
            )
          })}
        </div>
      ) : (
        <div className="max-h-96 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
          {items.map((item) => {
            const url = getUploadUrl(item.file_url)
            return (
              <a
                key={item.id}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <FileText size={18} className="text-gray-400 dark:text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary dark:text-gray-100 truncate">{item.file_name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {item.sender_name} · {format(new Date(item.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
                <Download size={16} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
              </a>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
