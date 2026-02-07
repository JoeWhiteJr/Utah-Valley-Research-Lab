import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2, Calendar, User, Users, Tag, ChevronDown, ChevronRight, CornerDownRight } from 'lucide-react'
import { format } from 'date-fns'
import CategoryBadge from './CategoryBadge'

export default function ActionItem({
  action,
  onToggle,
  onDelete,
  onUpdateCategory,
  users = [],
  categories = [],
  subtasks = [],
  onToggleSubtask,
  onDeleteSubtask,
  isSubtask = false,
  onDrop
}) {
  const [isHovered, setIsHovered] = useState(false)
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [showSubtasks, setShowSubtasks] = useState(true)

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

  // Handle drop on this task (to make subtask)
  const handleDragOver = (e) => {
    if (!isSubtask && onDrop) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  const handleDropOnTask = (e) => {
    if (!isSubtask && onDrop) {
      e.preventDefault()
      e.stopPropagation()
      const draggedId = e.dataTransfer.getData('text/action-id')
      if (draggedId && draggedId !== action.id) {
        onDrop(draggedId, action.id)
      }
    }
  }

  const handleDragStart = (e) => {
    e.dataTransfer.setData('text/action-id', action.id)
  }

  return (
    <div>
      <div
        ref={setNodeRef}
        style={style}
        className={`group flex items-start gap-3 p-3 rounded-lg border transition-colors ${
          isSubtask ? 'ml-8 border-l-2 border-l-primary-200' : ''
        } ${
          action.completed
            ? 'bg-gray-50 border-gray-200'
            : 'bg-white border-gray-200 hover:border-primary-200'
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onDragOver={handleDragOver}
        onDrop={handleDropOnTask}
        draggable
        onDragStart={handleDragStart}
      >
        <button
          {...attributes}
          {...listeners}
          className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
        >
          <GripVertical size={16} />
        </button>

        {isSubtask && (
          <CornerDownRight size={14} className="text-gray-400 mt-1 flex-shrink-0" />
        )}

        <button
          onClick={() => {
            if (isSubtask && onToggleSubtask) {
              onToggleSubtask(action.id, !action.completed)
            } else {
              onToggle(action.id, !action.completed)
            }
          }}
          className={`flex-shrink-0 w-5 h-5 mt-0.5 rounded-md border-2 transition-colors ${
            action.completed
              ? 'bg-secondary-500 border-secondary-500'
              : 'border-gray-300 hover:border-primary-400'
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
            {!isSubtask && subtasks.length > 0 && (
              <button
                onClick={() => setShowSubtasks(!showSubtasks)}
                className="p-0.5 text-gray-400 hover:text-gray-600"
              >
                {showSubtasks ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            )}
            <p className={`text-sm ${action.completed ? 'text-text-secondary line-through' : 'text-text-primary'}`}>
              {action.title}
            </p>
            {action.category_name && (
              <CategoryBadge
                name={action.category_name}
                color={action.category_color}
                size="xs"
              />
            )}
            {!isSubtask && subtasks.length > 0 && (
              <span className="text-xs text-text-secondary bg-gray-100 px-1.5 py-0.5 rounded">
                {subtasks.filter(s => s.completed).length}/{subtasks.length} subtasks
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {action.due_date && (
              <span className={`flex items-center gap-1 text-xs ${
                new Date(action.due_date) < new Date() && !action.completed
                  ? 'text-red-600'
                  : 'text-text-secondary'
              }`}>
                <Calendar size={12} />
                {format(new Date(action.due_date), 'MMM d')}
              </span>
            )}
            {/* Display multiple assignees */}
            {assignees.length > 0 ? (
              <span className="flex items-center gap-1 text-xs text-text-secondary">
                {assignees.length === 1 ? <User size={12} /> : <Users size={12} />}
                {assignees.map(a => a.user_name).join(', ')}
              </span>
            ) : assignedUser ? (
              <span className="flex items-center gap-1 text-xs text-text-secondary">
                <User size={12} />
                {assignedUser.name}
              </span>
            ) : null}
            {/* Category picker button - only show if categories exist and handler provided */}
            {categories.length > 0 && onUpdateCategory && (
              <div className="relative">
                <button
                  onClick={() => setShowCategoryPicker(!showCategoryPicker)}
                  className={`flex items-center gap-1 text-xs text-text-secondary hover:text-primary-600 transition-opacity ${
                    isHovered || showCategoryPicker ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  <Tag size={12} />
                  {action.category_name ? 'Change' : 'Add category'}
                </button>
                {showCategoryPicker && (
                  <div className="absolute top-full left-0 mt-1 z-10 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[140px]">
                    {action.category_id && (
                      <button
                        onClick={() => handleCategorySelect(null)}
                        className="w-full px-3 py-1.5 text-left text-xs text-text-secondary hover:bg-gray-50"
                      >
                        Remove category
                      </button>
                    )}
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => handleCategorySelect(cat.id)}
                        className={`w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 flex items-center gap-2 ${
                          cat.id === action.category_id ? 'bg-gray-50' : ''
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
          </div>
        </div>

        <button
          onClick={() => {
            if (isSubtask && onDeleteSubtask) {
              onDeleteSubtask(action.id)
            } else {
              onDelete(action.id)
            }
          }}
          className={`p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Render subtasks */}
      {!isSubtask && showSubtasks && subtasks.length > 0 && (
        <div className="space-y-1 mt-1">
          {subtasks.map((subtask) => (
            <ActionItem
              key={subtask.id}
              action={subtask}
              onToggle={onToggleSubtask || onToggle}
              onDelete={onDeleteSubtask || onDelete}
              onUpdateCategory={onUpdateCategory}
              users={users}
              categories={categories}
              subtasks={[]}
              isSubtask={true}
            />
          ))}
        </div>
      )}
    </div>
  )
}
