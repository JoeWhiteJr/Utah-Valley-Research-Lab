import { useState, useEffect, useCallback } from 'react'
import { Lightbulb, Trash2, ChevronDown, ChevronUp, User, Clock } from 'lucide-react'
import { recommendationsApi } from '../../services/api'
import { toast } from '../../store/toastStore'
import Modal from '../Modal'
import Button from '../Button'

const STATUS_OPTIONS = [
  { value: 'new', label: 'New', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' }
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400' },
  { value: 'medium', label: 'Medium', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
  { value: 'high', label: 'High', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' }
]

const PAGE_SIZE = 10

export default function RecommendationsTab() {
  const [recommendations, setRecommendations] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(0)
  const [expandedId, setExpandedId] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [editingNotes, setEditingNotes] = useState({})

  const fetchRecommendations = useCallback(async () => {
    setLoading(true)
    try {
      const params = { limit: PAGE_SIZE, offset: page * PAGE_SIZE }
      if (statusFilter) params.status = statusFilter
      const { data } = await recommendationsApi.list(params)
      setRecommendations(data.recommendations)
      setTotal(data.total)
    } catch {
      toast.error('Failed to load recommendations')
    }
    setLoading(false)
  }, [statusFilter, page])

  useEffect(() => {
    fetchRecommendations()
  }, [fetchRecommendations])

  useEffect(() => {
    setPage(0)
  }, [statusFilter])

  const handleStatusChange = async (id, status) => {
    try {
      await recommendationsApi.update(id, { status })
      setRecommendations(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    } catch {
      toast.error('Failed to update status')
    }
  }

  const handlePriorityChange = async (id, priority) => {
    try {
      await recommendationsApi.update(id, { priority })
      setRecommendations(prev => prev.map(r => r.id === id ? { ...r, priority } : r))
    } catch {
      toast.error('Failed to update priority')
    }
  }

  const handleNotesBlur = async (id) => {
    const notes = editingNotes[id]
    if (notes === undefined) return
    try {
      await recommendationsApi.update(id, { admin_notes: notes })
      setRecommendations(prev => prev.map(r => r.id === id ? { ...r, admin_notes: notes } : r))
    } catch {
      toast.error('Failed to save notes')
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    try {
      await recommendationsApi.delete(deleteConfirm.id)
      setRecommendations(prev => prev.filter(r => r.id !== deleteConfirm.id))
      setTotal(t => t - 1)
      setDeleteConfirm(null)
      toast.success('Recommendation deleted')
    } catch {
      toast.error('Failed to delete recommendation')
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const statusColor = (status) => STATUS_OPTIONS.find(s => s.value === status)?.color || ''
  const priorityColor = (priority) => PRIORITY_OPTIONS.find(p => p.value === priority)?.color || ''

  return (
    <div>
      {/* Status filter sub-tabs */}
      <div className="flex gap-2 mb-6">
        {[{ value: '', label: 'All' }, ...STATUS_OPTIONS].map(opt => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === opt.value
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-text-secondary dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : recommendations.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Lightbulb size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <h3 className="font-display font-semibold text-lg text-text-primary dark:text-gray-100 mb-1">No recommendations</h3>
          <p className="text-text-secondary dark:text-gray-400 text-sm">
            {statusFilter ? `No ${statusFilter.replace('_', ' ')} recommendations found.` : 'No recommendations have been submitted yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {recommendations.map(rec => {
            const isExpanded = expandedId === rec.id
            const isMember = !!rec.submitter_user_id
            return (
              <div key={rec.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Header row */}
                <div className="p-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <User size={14} className="text-text-secondary dark:text-gray-400" />
                        <span className="font-medium text-text-primary dark:text-gray-100 text-sm">
                          {rec.submitter_name || 'Anonymous'}
                        </span>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        isMember ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}>
                        {isMember ? 'Member' : 'Visitor'}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-text-secondary dark:text-gray-500">
                        <Clock size={12} />
                        {new Date(rec.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                    <p className={`text-sm text-text-primary dark:text-gray-200 ${isExpanded ? '' : 'line-clamp-2'}`}>
                      {rec.message}
                    </p>
                    {rec.message.length > 150 && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                        className="flex items-center gap-1 text-xs text-primary-500 hover:text-primary-600 mt-1"
                      >
                        {isExpanded ? <><ChevronUp size={14} /> Show less</> : <><ChevronDown size={14} /> Show more</>}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Status dropdown */}
                    <select
                      value={rec.status}
                      onChange={(e) => handleStatusChange(rec.id, e.target.value)}
                      className={`px-2 py-1 rounded-lg text-xs font-medium border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-300 ${statusColor(rec.status)}`}
                    >
                      {STATUS_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>

                    {/* Priority dropdown */}
                    <select
                      value={rec.priority}
                      onChange={(e) => handlePriorityChange(rec.id, e.target.value)}
                      className={`px-2 py-1 rounded-lg text-xs font-medium border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-300 ${priorityColor(rec.priority)}`}
                    >
                      {PRIORITY_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>

                    {/* Delete button */}
                    <button
                      onClick={() => setDeleteConfirm(rec)}
                      className="p-1.5 rounded-lg text-text-secondary dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Admin notes (expandable) */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 pt-3">
                    <label className="block text-xs font-medium text-text-secondary dark:text-gray-400 mb-1">Admin Notes</label>
                    <textarea
                      value={editingNotes[rec.id] ?? rec.admin_notes ?? ''}
                      onChange={(e) => setEditingNotes(prev => ({ ...prev, [rec.id]: e.target.value }))}
                      onBlur={() => handleNotesBlur(rec.id)}
                      placeholder="Add internal notes..."
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-text-primary dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
          <span className="text-sm text-text-secondary dark:text-gray-400">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => p - 1)}
              disabled={page === 0}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-text-secondary dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page + 1 >= totalPages}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-text-secondary dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Recommendation"
        size="sm"
      >
        <p className="text-text-secondary dark:text-gray-400">
          Are you sure you want to delete this recommendation? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  )
}
