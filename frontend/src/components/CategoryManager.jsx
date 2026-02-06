import { useState } from 'react'
import { Plus, Edit2, Trash2, X, Check } from 'lucide-react'
import Button from './Button'
import Modal from './Modal'
import Input from './Input'
import CategoryBadge from './CategoryBadge'

const DEFAULT_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#6b7280', // Gray
  '#78716c', // Stone
]

export default function CategoryManager({
  categories,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory
}) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [formData, setFormData] = useState({ name: '', color: '#6366f1' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleOpenCreate = () => {
    setFormData({ name: '', color: '#6366f1' })
    setError('')
    setShowCreateModal(true)
  }

  const handleOpenEdit = (category) => {
    setEditingCategory(category)
    setFormData({ name: category.name, color: category.color || '#6366f1' })
    setError('')
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setError('Category name is required')
      return
    }

    setIsSubmitting(true)
    setError('')
    const result = await onCreateCategory(formData)
    setIsSubmitting(false)

    if (result) {
      setShowCreateModal(false)
      setFormData({ name: '', color: '#6366f1' })
    } else {
      setError('Failed to create category. Name may already exist.')
    }
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setError('Category name is required')
      return
    }

    setIsSubmitting(true)
    setError('')
    const result = await onUpdateCategory(editingCategory.id, formData)
    setIsSubmitting(false)

    if (result) {
      setEditingCategory(null)
      setFormData({ name: '', color: '#6366f1' })
    } else {
      setError('Failed to update category. Name may already exist.')
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return

    setIsSubmitting(true)
    const success = await onDeleteCategory(deleteConfirm.id)
    setIsSubmitting(false)

    if (success) {
      setDeleteConfirm(null)
    }
  }

  const handleCancelEdit = () => {
    setEditingCategory(null)
    setFormData({ name: '', color: '#6366f1' })
    setError('')
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-text-primary">Categories</h4>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
        >
          <Plus size={14} />
          Add Category
        </button>
      </div>

      {/* Category list */}
      {categories.length > 0 ? (
        <div className="space-y-2">
          {categories.map((category) => (
            <div
              key={category.id}
              className="flex items-center justify-between p-2 rounded-lg bg-gray-50 group"
            >
              {editingCategory?.id === category.id ? (
                <form onSubmit={handleUpdate} className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="flex-1 px-2 py-1 text-sm rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-300"
                    autoFocus
                  />
                  <div className="flex items-center gap-1">
                    {DEFAULT_COLORS.slice(0, 6).map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData({ ...formData, color })}
                        className={`w-5 h-5 rounded-full transition-transform ${
                          formData.color === color ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : ''
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                  >
                    <X size={16} />
                  </button>
                </form>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <CategoryBadge name={category.name} color={category.color} />
                    {category.action_count > 0 && (
                      <span className="text-xs text-text-secondary">
                        ({category.action_count} tasks)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleOpenEdit(category)}
                      className="p-1 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(category)}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-text-secondary text-center py-4">
          No categories yet. Create one to organize your tasks.
        </p>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Category"
        size="sm"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Category name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Analysis, Documentation"
            maxLength={50}
            required
          />

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, color })}
                  className={`w-8 h-8 rounded-lg transition-all ${
                    formData.color === color
                      ? 'ring-2 ring-offset-2 ring-primary-400 scale-110'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="pt-2">
            <label className="block text-sm font-medium text-text-primary mb-2">
              Preview
            </label>
            <CategoryBadge
              name={formData.name || 'Category Name'}
              color={formData.color}
              size="md"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Create Category
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Category"
        size="sm"
      >
        <p className="text-text-secondary">
          Are you sure you want to delete the category "{deleteConfirm?.name}"?
          Tasks in this category will become uncategorized.
        </p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={isSubmitting}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  )
}
