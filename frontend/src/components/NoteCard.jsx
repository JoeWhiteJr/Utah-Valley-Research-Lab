import { memo } from 'react'
import { Edit3, Trash2, User, Calendar, Pin } from 'lucide-react'
import { format } from 'date-fns'

const NoteCard = memo(function NoteCard({ note, onEdit, onDelete, onTogglePin, onToggleProjectPin, canManageProject }) {
  // Strip HTML tags for preview
  const previewText = note.content
    ? note.content.replace(/<[^>]*>/g, '').slice(0, 150)
    : 'No content'

  const isPinned = note.is_pinned || note.pinned_for_project

  return (
    <div className={`group bg-white dark:bg-gray-800 rounded-lg border ${isPinned ? 'border-primary-300 dark:border-primary-600' : 'border-gray-200 dark:border-gray-700'} p-4 hover:border-primary-300 dark:hover:border-primary-500 hover:shadow-sm transition-all`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <h4 className="font-medium text-text-primary dark:text-gray-100 line-clamp-1" title={note.title}>{note.title}</h4>
          {note.pinned_for_project && (
            <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300 rounded">
              Project Pin
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onTogglePin && (
            <button
              onClick={() => onTogglePin(note.id)}
              className={`p-1.5 rounded ${note.is_pinned ? 'text-primary-600 dark:text-primary-400' : 'text-text-secondary dark:text-gray-400'} hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30`}
              aria-label={note.is_pinned ? 'Unpin note' : 'Pin note'}
              title={note.is_pinned ? 'Unpin' : 'Pin for me'}
            >
              <Pin size={16} className={note.is_pinned ? 'fill-current' : ''} />
            </button>
          )}
          {canManageProject && onToggleProjectPin && (
            <button
              onClick={() => onToggleProjectPin(note.id)}
              className={`p-1.5 rounded text-xs font-medium ${note.pinned_for_project ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30' : 'text-text-secondary dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30'}`}
              title={note.pinned_for_project ? 'Unpin from project' : 'Pin for project'}
            >
              P
            </button>
          )}
          <button
            onClick={() => onEdit(note)}
            className="p-1.5 rounded text-text-secondary dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30"
            aria-label="Edit note"
          >
            <Edit3 size={16} />
          </button>
          <button
            onClick={() => onDelete(note.id)}
            className="p-1.5 rounded text-text-secondary dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
            aria-label="Delete note"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <p className="mt-2 text-sm text-text-secondary dark:text-gray-400 line-clamp-3">
        {previewText}
      </p>

      <div className="mt-3 flex items-center gap-4 text-xs text-text-secondary dark:text-gray-400">
        <span className="flex items-center gap-1">
          <User size={12} />
          {note.creator_name}
        </span>
        <span className="flex items-center gap-1">
          <Calendar size={12} />
          {format(new Date(note.updated_at), 'MMM d, yyyy')}
        </span>
      </div>
    </div>
  )
})

export default NoteCard
