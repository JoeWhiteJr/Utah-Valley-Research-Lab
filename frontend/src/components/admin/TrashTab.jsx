import { useState, useEffect, useCallback } from 'react'
import { trashApi } from '../../services/api'
import { toast } from '../../store/toastStore'
import Button from '../Button'
import ConfirmDialog from '../ConfirmDialog'
import { Trash2, RotateCcw, FolderKanban, StickyNote, ListTodo, Mic, FileText } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const TABS = [
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'actions', label: 'Tasks', icon: ListTodo },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'meetings', label: 'Meetings', icon: Mic },
  { id: 'files', label: 'Files', icon: FileText }
]

export default function TrashTab() {
  const [activeType, setActiveType] = useState('projects')
  const [trash, setTrash] = useState({ projects: [], notes: [], actions: [], meetings: [], files: [] })
  const [loading, setLoading] = useState(true)
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState(null)

  const loadTrash = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await trashApi.list()
      setTrash(data)
    } catch {
      toast.error('Failed to load trash')
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadTrash() }, [loadTrash])

  const handleRestore = async (type, id) => {
    try {
      await trashApi.restore(type, id)
      toast.success('Item restored')
      loadTrash()
    } catch {
      toast.error('Failed to restore item')
    }
  }

  const handlePermanentDelete = async () => {
    if (!permanentDeleteTarget) return
    try {
      await trashApi.permanentDelete(permanentDeleteTarget.type, permanentDeleteTarget.id)
      toast.success('Item permanently deleted')
      setPermanentDeleteTarget(null)
      loadTrash()
    } catch {
      toast.error('Failed to delete item')
    }
  }

  const items = trash[activeType] || []
  const totalCount = Object.values(trash).reduce((sum, arr) => sum + arr.length, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-lg text-text-primary dark:text-gray-100">
          Trash ({totalCount} items)
        </h2>
      </div>

      {/* Type tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveType(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeType === id
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <Icon size={14} />
            {label} ({(trash[id] || []).length})
          </button>
        ))}
      </div>

      {/* Items list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-text-primary dark:text-gray-100 truncate">{item.title}</p>
                <p className="text-xs text-text-secondary dark:text-gray-400">
                  Deleted {item.deleted_at ? formatDistanceToNow(new Date(item.deleted_at), { addSuffix: true }) : 'recently'}
                  {item.deleted_by_name ? ` by ${item.deleted_by_name}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRestore(activeType, item.id)}
                >
                  <RotateCcw size={14} />
                  Restore
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => setPermanentDeleteTarget({ type: activeType, id: item.id, title: item.title })}
                >
                  <Trash2 size={14} />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Trash2 size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-text-secondary dark:text-gray-400">No deleted {activeType} found.</p>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!permanentDeleteTarget}
        onClose={() => setPermanentDeleteTarget(null)}
        onConfirm={handlePermanentDelete}
        title="Permanently Delete"
        message={`Are you sure you want to permanently delete "${permanentDeleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete Forever"
        variant="danger"
      />
    </div>
  )
}
