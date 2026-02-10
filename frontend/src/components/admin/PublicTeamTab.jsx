import { useState, useEffect } from 'react'
import { adminApi } from '../../services/api'
import Button from '../Button'
import Modal from '../Modal'
import { Plus, Edit3, Trash2, Eye, EyeOff } from 'lucide-react'

const CATEGORIES = [
  { value: 'leadership', label: 'Leadership' },
  { value: 'lab_lead', label: 'Lab Lead' },
  { value: 'member', label: 'Member' },
  { value: 'partner', label: 'Partner' },
]

const CATEGORY_LABELS = {
  leadership: 'Leadership',
  lab_lead: 'Lab Leads',
  member: 'Members',
  partner: 'Partners',
}

const emptyForm = {
  name: '',
  role: '',
  title: '',
  bio: '',
  category: 'member',
  email: '',
  linkedin_url: '',
  photo_url: '',
  display_order: 0,
  is_visible: true,
}

export default function PublicTeamTab() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    loadMembers()
  }, [])

  const loadMembers = async () => {
    setLoading(true)
    try {
      const { data } = await adminApi.getTeamMembers()
      setMembers(data.members)
    } catch {
      setMessage({ type: 'error', text: 'Failed to load team members' })
    }
    setLoading(false)
  }

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  const openEdit = (member) => {
    setEditing(member)
    setForm({
      name: member.name || '',
      role: member.role || '',
      title: member.title || '',
      bio: member.bio || '',
      category: member.category || 'member',
      email: member.email || '',
      linkedin_url: member.linkedin_url || '',
      photo_url: member.photo_url || '',
      display_order: member.display_order || 0,
      is_visible: member.is_visible !== false,
    })
    setShowModal(true)
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (editing) {
        const { data } = await adminApi.updateTeamMember(editing.id, form)
        setMembers(m => m.map(mem => mem.id === editing.id ? data.member : mem))
        setMessage({ type: 'success', text: 'Member updated' })
      } else {
        const { data } = await adminApi.createTeamMember(form)
        setMembers(m => [...m, data.member])
        setMessage({ type: 'success', text: 'Member added' })
      }
      setShowModal(false)
      setTimeout(() => setMessage(null), 3000)
    } catch {
      setMessage({ type: 'error', text: 'Failed to save member' })
    }
    setSaving(false)
  }

  const handleDelete = async (member) => {
    try {
      await adminApi.deleteTeamMember(member.id)
      setMembers(m => m.filter(mem => mem.id !== member.id))
      setShowDeleteConfirm(null)
      setMessage({ type: 'success', text: 'Member removed' })
      setTimeout(() => setMessage(null), 3000)
    } catch {
      setMessage({ type: 'error', text: 'Failed to delete member' })
    }
  }

  const toggleVisibility = async (member) => {
    try {
      const { data } = await adminApi.updateTeamMember(member.id, { is_visible: !member.is_visible })
      setMembers(m => m.map(mem => mem.id === member.id ? data.member : mem))
    } catch {
      setMessage({ type: 'error', text: 'Failed to update visibility' })
    }
  }

  // Group members by category
  const grouped = {}
  for (const m of members) {
    if (!grouped[m.category]) grouped[m.category] = []
    grouped[m.category].push(m)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-lg text-text-primary dark:text-gray-100">Public Team Members</h2>
        <Button size="sm" onClick={openAdd}>
          <Plus size={16} />
          Add Member
        </Button>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${
          message.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-300'
            : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {['leadership', 'lab_lead', 'member', 'partner'].map((cat) => {
        const catMembers = grouped[cat]
        if (!catMembers || catMembers.length === 0) return null

        return (
          <div key={cat}>
            <h3 className="text-sm font-semibold text-text-primary dark:text-gray-100 mb-3 uppercase tracking-wide">
              {CATEGORY_LABELS[cat]} ({catMembers.length})
            </h3>
            <div className="space-y-2">
              {catMembers.map((member) => (
                <div
                  key={member.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    member.is_visible
                      ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                      : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                      {member.photo_url ? (
                        <img src={member.photo_url} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span className="text-primary-700 dark:text-primary-300 font-medium text-sm">
                          {member.name?.charAt(0)?.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-text-primary dark:text-gray-100 text-sm">{member.name}</p>
                      <p className="text-xs text-text-secondary dark:text-gray-400">{member.role}{member.email ? ` · ${member.email}` : ''}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleVisibility(member)}
                      className="p-1.5 rounded text-text-secondary dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                      title={member.is_visible ? 'Hide from public' : 'Show on public site'}
                    >
                      {member.is_visible ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                    <button
                      onClick={() => openEdit(member)}
                      className="p-1.5 rounded text-text-secondary dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30"
                      title="Edit"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(member)}
                      className="p-1.5 rounded text-text-secondary dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {members.length === 0 && (
        <div className="text-center py-12 text-text-secondary dark:text-gray-400">
          <p>No team members yet.</p>
          <p className="text-sm mt-1">Click &quot;Add Member&quot; to get started.</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Edit Team Member' : 'Add Team Member'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1">Role</label>
              <input
                type="text"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                placeholder="e.g. Director, Lab Lead"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1">Category *</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1">Bio</label>
            <textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1">LinkedIn URL</label>
              <input
                type="text"
                value={form.linkedin_url}
                onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1">Photo URL</label>
              <input
                type="text"
                value={form.photo_url}
                onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1">Display Order</label>
              <input
                type="number"
                value={form.display_order}
                onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setForm({ ...form, is_visible: !form.is_visible })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                form.is_visible ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                form.is_visible ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
            <span className="text-sm text-text-primary dark:text-gray-100">Visible on public site</span>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving} disabled={!form.name.trim() || saving}>
            {editing ? 'Save Changes' : 'Add Member'}
          </Button>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        title="Delete Team Member"
        size="sm"
      >
        <p className="text-text-secondary dark:text-gray-400">
          Are you sure you want to delete <strong className="text-text-primary dark:text-gray-100">{showDeleteConfirm?.name}</strong>?
          This cannot be undone.
        </p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setShowDeleteConfirm(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => handleDelete(showDeleteConfirm)}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}
