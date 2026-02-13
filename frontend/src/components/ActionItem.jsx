import { useState, useEffect, useCallback, memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2, Pencil, Calendar, User, Users, Tag, Flag, MessageSquare, Send as SendIcon } from 'lucide-react'
import { format } from 'date-fns'
import CategoryBadge from './CategoryBadge'
import ConfirmDialog from './ConfirmDialog'
import { commentsApi } from '../services/api'
import { toast } from '../store/toastStore'

const PRIORITY_COLORS = {
  urgent: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
  high: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300' },
  medium: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300' },
  low: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-400' }
}

const ActionItem = memo(function ActionItem({
  action,
  onToggle,
  onDelete,
  onEdit,
  onUpdateCategory,
  users = [],
  categories = []
}) {
  const [isHovered, setIsHovered] = useState(false)
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [loadingComments, setLoadingComments] = useState(false)
  const [commentCount, setCommentCount] = useState(action.comment_count || 0)
  const [deleteCommentTarget, setDeleteCommentTarget] = useState(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: action.id, data: { type: 'action', action } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  // Support multiple assignees
  const assignees = action.assignees || []
  const assignedUser = users.find(u => u.id === action.assigned_to)

  const handleCategorySelect = (categoryId) => {
    if (onUpdateCategory) {
      onUpdateCategory(action.id, { category_id: categoryId })
    }
    setShowCategoryPicker(false)
  }

  const fetchComments = useCallback(() => {
    setLoadingComments(true)
    commentsApi.list(action.id)
      .then(({ data }) => setComments(data.comments || []))
      .catch(() => toast.error('Failed to load comments'))
      .finally(() => setLoadingComments(false))
  }, [action.id])

  useEffect(() => {
    if (showComments && comments.length === 0) {
      fetchComments()
    }
  }, [showComments, comments.length, fetchComments])

  const isOverdue = action.due_date && !action.completed && new Date(action.due_date) < new Date()

  return (
    <div>
      <div
        ref={setNodeRef}
        style={style}
        className={`group flex items-start gap-3 p-3 rounded-lg border transition-colors ${
          action.completed
            ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
            : isOverdue
            ? 'bg-red-50/50 dark:bg-red-900/20 border-red-300 dark:border-red-700 hover:border-red-400 dark:hover:border-red-600'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-primary-200 dark:hover:border-primary-700'
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <button
          {...attributes}
          {...listeners}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical size={16} />
        </button>

        <button
          onClick={() => onToggle(action.id, !action.completed)}
          className={`flex-shrink-0 w-5 h-5 mt-0.5 rounded-md border-2 transition-colors ${
            action.completed
              ? 'bg-secondary-500 border-secondary-500'
              : 'border-gray-300 dark:border-gray-600 hover:border-primary-400'
          }`}
        >
          {action.completed && (
            <svg className="w-full h-full text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-sm ${action.completed ? 'text-text-secondary dark:text-gray-400 line-through' : 'text-text-primary dark:text-gray-100'}`}>
              {action.title}
            </p>
            {action.category_name && (
              <CategoryBadge
                name={action.category_name}
                color={action.category_color}
                size="xs"
              />
            )}
            {action.priority && PRIORITY_COLORS[action.priority] && (
              <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[action.priority].bg} ${PRIORITY_COLORS[action.priority].text}`}>
                <Flag size={10} />
                {action.priority.charAt(0).toUpperCase() + action.priority.slice(1)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {action.due_date && (
              <span className={`flex items-center gap-1 text-xs ${
                new Date(action.due_date) < new Date() && !action.completed
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-text-secondary dark:text-gray-400'
              }`}>
                <Calendar size={12} />
                {format(new Date(action.due_date), 'MMM d')}
              </span>
            )}
            {/* Display multiple assignees */}
            {assignees.length > 0 ? (
              <span className="flex items-center gap-1 text-xs text-text-secondary dark:text-gray-400">
                {assignees.length === 1 ? <User size={12} /> : <Users size={12} />}
                {assignees.map(a => a.user_name).join(', ')}
              </span>
            ) : assignedUser ? (
              <span className="flex items-center gap-1 text-xs text-text-secondary dark:text-gray-400">
                <User size={12} />
                {assignedUser.name}
              </span>
            ) : null}
            {/* Category picker button - only show if categories exist and handler provided */}
            {categories.length > 0 && onUpdateCategory && (
              <div className="relative">
                <button
                  onClick={() => setShowCategoryPicker(!showCategoryPicker)}
                  className={`flex items-center gap-1 text-xs text-text-secondary dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-opacity ${
                    isHovered || showCategoryPicker ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  <Tag size={12} />
                  {action.category_name ? 'Change' : 'Add category'}
                </button>
                {showCategoryPicker && (
                  <div className="absolute top-full left-0 mt-1 z-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[140px]">
                    {action.category_id && (
                      <button
                        onClick={() => handleCategorySelect(null)}
                        className="w-full px-3 py-1.5 text-left text-xs text-text-secondary dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        Remove category
                      </button>
                    )}
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => handleCategorySelect(cat.id)}
                        className={`w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 ${
                          cat.id === action.category_id ? 'bg-gray-50 dark:bg-gray-700' : ''
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => setShowComments(!showComments)}
              className={`flex items-center gap-1 text-xs text-text-secondary dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 ${showComments ? 'text-primary-600 dark:text-primary-400' : ''}`}
            >
              <MessageSquare size={12} />
              {commentCount > 0 && <span>{commentCount}</span>}
            </button>
          </div>
        </div>

        {onEdit && (
          <button
            onClick={() => onEdit(action)}
            className={`p-1.5 rounded text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-all ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
            aria-label="Edit task"
          >
            <Pencil size={16} />
          </button>
        )}

        <button
          onClick={() => onDelete(action.id)}
          className={`p-1.5 rounded text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
          aria-label="Delete task"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {showComments && (
        <div className="ml-8 mt-1 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700">
          {loadingComments ? (
            <p className="text-xs text-text-secondary dark:text-gray-400">Loading...</p>
          ) : (
            <>
              {comments.map(c => (
                <div key={c.id} className="mb-2 last:mb-0 group/comment">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium text-text-primary dark:text-gray-100">{c.user_name}</span>
                    <span className="text-[10px] text-text-secondary dark:text-gray-400">
                      {new Date(c.created_at).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => setDeleteCommentTarget(c)}
                      className="ml-auto opacity-0 group-hover/comment:opacity-100 p-0.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-opacity"
                      title="Delete comment"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                  <p className="text-xs text-text-secondary dark:text-gray-400 mt-0.5">{c.content}</p>
                </div>
              ))}
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!newComment.trim()) return
                  try {
                    const { data } = await commentsApi.create(action.id, newComment.trim())
                    setComments(prev => [...prev, data.comment])
                    setCommentCount(prev => prev + 1)
                    setNewComment('')
                  } catch {
                    toast.error('Failed to post comment')
                  }
                }}
                className="flex gap-2 mt-2"
              >
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 text-xs px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-text-primary dark:text-gray-100 placeholder:text-text-secondary dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-300"
                />
                <button type="submit" className="p-1.5 rounded bg-primary-500 text-white hover:bg-primary-600">
                  <SendIcon size={12} />
                </button>
              </form>
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteCommentTarget}
        onClose={() => setDeleteCommentTarget(null)}
        onConfirm={async () => {
          try {
            await commentsApi.delete(action.id, deleteCommentTarget.id)
            setComments(prev => prev.filter(x => x.id !== deleteCommentTarget.id))
            setCommentCount(prev => prev - 1)
          } catch { toast.error('Failed to delete comment') }
          setDeleteCommentTarget(null)
        }}
        title="Delete Comment"
        message="Are you sure you want to delete this comment?"
        confirmLabel="Delete"
      />
    </div>
  )
})

export default ActionItem
