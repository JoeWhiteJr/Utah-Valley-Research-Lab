import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { useAuthStore } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'
import { usersApi, filesApi } from '../services/api'
import Button from '../components/Button'
import Modal from '../components/Modal'
import Input from '../components/Input'
import ActionItem from '../components/ActionItem'
import FileCard from '../components/FileCard'
import NoteCard from '../components/NoteCard'
import MeetingCard from '../components/MeetingCard'
import {
  ArrowLeft, Edit3, Trash2, Plus, Upload, ListTodo, FileText,
  StickyNote, Mic, Image
} from 'lucide-react'

const tabs = [
  { id: 'overview', label: 'Overview', icon: FileText },
  { id: 'actions', label: 'Action Items', icon: ListTodo },
  { id: 'files', label: 'Files', icon: Upload },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'meetings', label: 'Meetings', icon: Mic }
]

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const {
    currentProject, fetchProject, updateProject, deleteProject, uploadCover,
    actions, fetchActions, createAction, updateAction, deleteAction, reorderActions,
    files, fetchFiles, uploadFile, deleteFile,
    notes, fetchNotes, createNote, updateNote, deleteNote,
    meetings, fetchMeetings, createMeeting, deleteMeeting,
    clearCurrentProject, isLoading
  } = useProjectStore()

  const [activeTab, setActiveTab] = useState('overview')
  const [teamMembers, setTeamMembers] = useState([])
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editData, setEditData] = useState({ title: '', description: '', status: 'active', progress: 0 })

  // Action modals
  const [showActionModal, setShowActionModal] = useState(false)
  const [newAction, setNewAction] = useState({ title: '', due_date: '', assigned_to: '' })

  // Note modals
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [editingNote, setEditingNote] = useState(null)
  const [noteData, setNoteData] = useState({ title: '', content: '' })

  // Meeting modals
  const [showMeetingModal, setShowMeetingModal] = useState(false)
  const [meetingData, setMeetingData] = useState({ title: '', recorded_at: '' })
  const [audioFile, setAudioFile] = useState(null)

  const coverInputRef = useRef(null)

  const canEdit = user?.role === 'admin' || user?.role === 'project_lead'
  const canEditMeta = user?.role === 'admin'
  const canDelete = user?.role === 'admin'

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    fetchProject(id)
    fetchActions(id)
    fetchFiles(id)
    fetchNotes(id)
    fetchMeetings(id)
    usersApi.team().then(({ data }) => setTeamMembers(data.users))

    return () => clearCurrentProject()
  }, [id, fetchProject, fetchActions, fetchFiles, fetchNotes, fetchMeetings, clearCurrentProject])

  useEffect(() => {
    if (currentProject) {
      setEditData({
        title: currentProject.title,
        description: currentProject.description || '',
        status: currentProject.status,
        progress: currentProject.progress || 0
      })
    }
  }, [currentProject])

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event
    if (active.id !== over?.id) {
      const oldIndex = actions.findIndex((a) => a.id === active.id)
      const newIndex = actions.findIndex((a) => a.id === over.id)
      const newOrder = arrayMove(actions, oldIndex, newIndex)
      reorderActions(newOrder)
    }
  }, [actions, reorderActions])

  const handleUpdateProject = async (e) => {
    e.preventDefault()
    const dataToSend = canEditMeta
      ? editData
      : { description: editData.description }
    await updateProject(id, dataToSend)
    setShowEditModal(false)
  }

  const handleDeleteProject = async () => {
    const success = await deleteProject(id)
    if (success) navigate('/dashboard/projects')
  }

  const handleAddAction = async (e) => {
    e.preventDefault()
    await createAction(id, {
      title: newAction.title,
      due_date: newAction.due_date || null,
      assigned_to: newAction.assigned_to || null
    })
    setShowActionModal(false)
    setNewAction({ title: '', due_date: '', assigned_to: '' })
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (file) {
      await uploadFile(id, file)
      e.target.value = ''
    }
  }

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0]
    if (file) {
      await uploadCover(id, file)
      e.target.value = ''
    }
  }

  const handleDownloadFile = async (file) => {
    const response = await filesApi.download(file.id)
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.download = file.original_filename
    link.click()
    window.URL.revokeObjectURL(url)
  }

  const handleSaveNote = async (e) => {
    e.preventDefault()
    if (editingNote) {
      await updateNote(editingNote.id, noteData)
    } else {
      await createNote(id, noteData)
    }
    setShowNoteModal(false)
    setEditingNote(null)
    setNoteData({ title: '', content: '' })
  }

  const handleEditNote = (note) => {
    setEditingNote(note)
    setNoteData({ title: note.title, content: note.content || '' })
    setShowNoteModal(true)
  }

  const handleAddMeeting = async (e) => {
    e.preventDefault()
    await createMeeting(id, meetingData, audioFile)
    setShowMeetingModal(false)
    setMeetingData({ title: '', recorded_at: '' })
    setAudioFile(null)
  }

  if (isLoading || !currentProject) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-48 bg-gray-200 rounded-xl" />
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-4 bg-gray-200 rounded w-2/3" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/dashboard/projects')}
        className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft size={18} />
        Back to Projects
      </button>

      {/* Header image */}
      <div className="relative h-48 md:h-64 rounded-xl overflow-hidden bg-gradient-to-br from-primary-200 to-secondary-200">
        {currentProject.header_image ? (
          <img src={currentProject.header_image} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm" />
          </div>
        )}
        {canEdit && (
          <>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCoverUpload}
            />
            <button
              onClick={() => coverInputRef.current?.click()}
              className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur-sm rounded-lg text-sm font-medium text-text-primary hover:bg-white"
            >
              <Image size={16} />
              Change cover
            </button>
          </>
        )}
      </div>

      {/* Title and actions */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display font-bold text-2xl md:text-3xl text-text-primary">
              {currentProject.title}
            </h1>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
              currentProject.status === 'active' ? 'bg-secondary-100 text-secondary-700' :
              currentProject.status === 'completed' ? 'bg-green-100 text-green-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {currentProject.status}
            </span>
          </div>
          {currentProject.description && (
            <p className="mt-2 text-text-secondary max-w-2xl">{currentProject.description}</p>
          )}

          {/* Progress */}
          <div className="mt-4 max-w-md">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-text-secondary">Progress</span>
              <span className="font-medium text-text-primary">{currentProject.progress || 0}%</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary-400 to-primary-500 rounded-full"
                style={{ width: `${currentProject.progress || 0}%` }}
              />
            </div>
          </div>
        </div>

        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowEditModal(true)}>
              <Edit3 size={16} />
              Edit
            </Button>
            {canDelete && (
              <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 size={16} />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:border-gray-300'
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="min-h-[400px]">
        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-display font-semibold text-lg mb-4">Project Overview</h3>
            <p className="text-text-secondary">
              {currentProject.description || 'No description provided.'}
            </p>
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-text-primary">{actions.length}</p>
                <p className="text-sm text-text-secondary">Total tasks</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-text-primary">
                  {actions.filter(a => a.completed).length}
                </p>
                <p className="text-sm text-text-secondary">Completed</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-text-primary">{files.length}</p>
                <p className="text-sm text-text-secondary">Files</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-text-primary">{notes.length}</p>
                <p className="text-sm text-text-secondary">Notes</p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        {activeTab === 'actions' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-display font-semibold text-lg">Action Items</h3>
              <Button size="sm" onClick={() => setShowActionModal(true)}>
                <Plus size={16} />
                Add Task
              </Button>
            </div>
            {actions.length > 0 ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={actions.map(a => a.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {actions.map((action) => (
                      <ActionItem
                        key={action.id}
                        action={action}
                        users={teamMembers}
                        onToggle={(id, completed) => updateAction(id, { completed })}
                        onDelete={deleteAction}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <ListTodo size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-text-secondary">No tasks yet. Add your first action item.</p>
              </div>
            )}
          </div>
        )}

        {/* Files */}
        {activeTab === 'files' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-display font-semibold text-lg">Files</h3>
              <label className="cursor-pointer">
                <input type="file" className="hidden" onChange={handleFileUpload} />
                <Button size="sm" as="span">
                  <Upload size={16} />
                  Upload
                </Button>
              </label>
            </div>
            {files.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {files.map((file) => (
                  <FileCard
                    key={file.id}
                    file={file}
                    onDownload={handleDownloadFile}
                    onDelete={deleteFile}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <Upload size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-text-secondary">No files uploaded yet.</p>
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        {activeTab === 'notes' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-display font-semibold text-lg">Notes</h3>
              <Button size="sm" onClick={() => { setEditingNote(null); setNoteData({ title: '', content: '' }); setShowNoteModal(true) }}>
                <Plus size={16} />
                Add Note
              </Button>
            </div>
            {notes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {notes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onEdit={handleEditNote}
                    onDelete={deleteNote}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <StickyNote size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-text-secondary">No notes yet. Create your first note.</p>
              </div>
            )}
          </div>
        )}

        {/* Meetings */}
        {activeTab === 'meetings' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-display font-semibold text-lg">Meetings</h3>
              <Button size="sm" onClick={() => setShowMeetingModal(true)}>
                <Plus size={16} />
                Add Meeting
              </Button>
            </div>
            {meetings.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {meetings.map((meeting) => (
                  <MeetingCard
                    key={meeting.id}
                    meeting={meeting}
                    onView={() => {}}
                    onDelete={deleteMeeting}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <Mic size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-text-secondary">No meetings recorded yet.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Project Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Project">
        <form onSubmit={handleUpdateProject} className="space-y-5">
          {canEditMeta ? (
            <Input
              label="Title"
              value={editData.title}
              onChange={(e) => setEditData({ ...editData, title: e.target.value })}
              required
            />
          ) : (
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Title</label>
              <p className="px-4 py-2.5 rounded-organic border border-gray-200 bg-gray-50 text-text-secondary">
                {editData.title}
              </p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Description</label>
            <textarea
              value={editData.description}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              rows={4}
              className="w-full px-4 py-2.5 rounded-organic border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 resize-none"
            />
          </div>
          {canEditMeta && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">Status</label>
                <select
                  value={editData.status}
                  onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-organic border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300"
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <Input
                label="Progress %"
                type="number"
                min="0"
                max="100"
                value={editData.progress}
                onChange={(e) => setEditData({ ...editData, progress: parseInt(e.target.value) || 0 })}
              />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete Project" size="sm">
        <p className="text-text-secondary">Are you sure you want to delete this project? This action cannot be undone.</p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDeleteProject}>Delete Project</Button>
        </div>
      </Modal>

      {/* Add Action Modal */}
      <Modal isOpen={showActionModal} onClose={() => setShowActionModal(false)} title="Add Action Item">
        <form onSubmit={handleAddAction} className="space-y-5">
          <Input
            label="Task"
            value={newAction.title}
            onChange={(e) => setNewAction({ ...newAction, title: e.target.value })}
            placeholder="What needs to be done?"
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Due date"
              type="date"
              value={newAction.due_date}
              onChange={(e) => setNewAction({ ...newAction, due_date: e.target.value })}
            />
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Assign to</label>
              <select
                value={newAction.assigned_to}
                onChange={(e) => setNewAction({ ...newAction, assigned_to: e.target.value })}
                className="w-full px-4 py-2.5 rounded-organic border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                <option value="">Unassigned</option>
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowActionModal(false)}>Cancel</Button>
            <Button type="submit">Add Task</Button>
          </div>
        </form>
      </Modal>

      {/* Note Modal */}
      <Modal isOpen={showNoteModal} onClose={() => setShowNoteModal(false)} title={editingNote ? 'Edit Note' : 'Add Note'} size="lg">
        <form onSubmit={handleSaveNote} className="space-y-5">
          <Input
            label="Title"
            value={noteData.title}
            onChange={(e) => setNoteData({ ...noteData, title: e.target.value })}
            placeholder="Note title"
            required
          />
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Content</label>
            <textarea
              value={noteData.content}
              onChange={(e) => setNoteData({ ...noteData, content: e.target.value })}
              rows={8}
              placeholder="Write your note..."
              className="w-full px-4 py-2.5 rounded-organic border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowNoteModal(false)}>Cancel</Button>
            <Button type="submit">{editingNote ? 'Save' : 'Create Note'}</Button>
          </div>
        </form>
      </Modal>

      {/* Meeting Modal */}
      <Modal isOpen={showMeetingModal} onClose={() => setShowMeetingModal(false)} title="Add Meeting">
        <form onSubmit={handleAddMeeting} className="space-y-5">
          <Input
            label="Title"
            value={meetingData.title}
            onChange={(e) => setMeetingData({ ...meetingData, title: e.target.value })}
            placeholder="Meeting name"
            required
          />
          <Input
            label="Date"
            type="datetime-local"
            value={meetingData.recorded_at}
            onChange={(e) => setMeetingData({ ...meetingData, recorded_at: e.target.value })}
          />
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Audio file (optional)</label>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
              className="w-full px-4 py-2.5 rounded-organic border border-gray-300 bg-white"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowMeetingModal(false)}>Cancel</Button>
            <Button type="submit">Add Meeting</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
