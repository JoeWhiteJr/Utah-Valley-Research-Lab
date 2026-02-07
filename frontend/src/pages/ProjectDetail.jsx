import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { useAuthStore } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'
import { usersApi, filesApi, aiApi, getUploadUrl } from '../services/api'
import Button from '../components/Button'
import Modal from '../components/Modal'
import Input from '../components/Input'
import ActionItem from '../components/ActionItem'
import FileCard from '../components/FileCard'
import FilePreviewModal from '../components/FilePreviewModal'
import NoteCard from '../components/NoteCard'
import MeetingCard from '../components/MeetingCard'
import DatePicker from '../components/DatePicker'
import RichTextEditor from '../components/RichTextEditor'
import AudioRecorder from '../components/AudioRecorder'
import CategoryManager from '../components/CategoryManager'
import {
  ArrowLeft, Edit3, Trash2, Plus, Upload, ListTodo, FileText,
  StickyNote, Mic, Image, Settings, MoreVertical, Check, Users, Sparkles, Loader2
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
    categories, fetchCategories, createCategory, updateCategory, deleteCategory,
    files, fetchFiles, uploadFile, deleteFile,
    notes, fetchNotes, createNote, updateNote, deleteNote,
    meetings, fetchMeetings, createMeeting, updateMeeting, deleteMeeting,
    clearCurrentProject, isLoading,
    uploadProgress, isUploading,
    setParentTask, calculateProgress
  } = useProjectStore()

  const [activeTab, setActiveTab] = useState('overview')
  const [teamMembers, setTeamMembers] = useState([])
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editData, setEditData] = useState({ title: '', description: '', status: 'active', progress: 0 })

  // Action modals
  const [showActionModal, setShowActionModal] = useState(false)
  const [newAction, setNewAction] = useState({ title: '', due_date: '', assigned_to: '', assignee_ids: [], category_id: '', parent_task_id: '' })

  // Note modals
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [editingNote, setEditingNote] = useState(null)
  const [noteData, setNoteData] = useState({ title: '', content: '' })

  // Meeting modals
  const [showMeetingModal, setShowMeetingModal] = useState(false)
  const [meetingData, setMeetingData] = useState({ title: '', recorded_at: '', notes: '' })
  const [audioFile, setAudioFile] = useState(null)
  const [showRecorder, setShowRecorder] = useState(false)
  const [editingMeeting, setEditingMeeting] = useState(null)
  const [showEditMeetingModal, setShowEditMeetingModal] = useState(false)

  // File upload state
  const [isDragging, setIsDragging] = useState(false)
  const [previewFile, setPreviewFile] = useState(null)

  // Cover upload preview state
  const [coverPreview, setCoverPreview] = useState(null)
  const [coverFile, setCoverFile] = useState(null)
  const [isUploadingCover, setIsUploadingCover] = useState(false)

  // Settings menu state
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)

  // AI Summary state
  const [showAiSummary, setShowAiSummary] = useState(false)
  const [aiSummary, setAiSummary] = useState(null)
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false)
  const [aiSummaryError, setAiSummaryError] = useState(null)

  // Category filter state
  const [categoryFilter, setCategoryFilter] = useState(null)

  const coverInputRef = useRef(null)
  const fileInputRef = useRef(null)

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
    fetchCategories(id)
    fetchFiles(id)
    fetchNotes(id)
    fetchMeetings(id)
    usersApi.team().then(({ data }) => setTeamMembers(data.users))

    return () => clearCurrentProject()
  }, [id, fetchProject, fetchActions, fetchCategories, fetchFiles, fetchNotes, fetchMeetings, clearCurrentProject])

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
    if (!over || active.id === over.id) return
    const oldIndex = actions.findIndex((a) => a.id === active.id)
    const newIndex = actions.findIndex((a) => a.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const newOrder = arrayMove(actions, oldIndex, newIndex)
    reorderActions(newOrder)
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
      assigned_to: newAction.assignee_ids.length > 0 ? newAction.assignee_ids[0] : (newAction.assigned_to || null),
      assignee_ids: newAction.assignee_ids.length > 0 ? newAction.assignee_ids : (newAction.assigned_to ? [newAction.assigned_to] : []),
      category_id: newAction.category_id || null,
      parent_task_id: newAction.parent_task_id || null
    })
    setShowActionModal(false)
    setNewAction({ title: '', due_date: '', assigned_to: '', assignee_ids: [], category_id: '', parent_task_id: '' })
  }

  // Handle drag-and-drop to make subtask
  const handleMakeSubtask = async (childId, parentId) => {
    if (childId === parentId) return
    await setParentTask(childId, parentId)
  }

  // Get parent tasks (top-level only)
  const parentTasks = actions.filter(a => !a.parent_task_id)

  // Group actions: parent tasks and their subtasks
  const getSubtasks = (parentId) => actions.filter(a => a.parent_task_id === parentId)

  // Auto-calculated progress
  const autoProgress = calculateProgress()

  // Handle project status change (admin only)
  const handleStatusChange = async (newStatus) => {
    await updateProject(id, { status: newStatus })
    setShowSettingsMenu(false)
  }

  // Handle AI Summary generation
  const handleGenerateAiSummary = async () => {
    setShowAiSummary(true)
    setAiSummaryLoading(true)
    setAiSummaryError(null)
    setAiSummary(null)
    try {
      const { data } = await aiApi.summarizeProject(id)
      setAiSummary(data)
    } catch (error) {
      setAiSummaryError(
        error.response?.data?.error?.message || 'Failed to generate AI summary. Please try again.'
      )
    } finally {
      setAiSummaryLoading(false)
    }
  }

  // Handle category creation for the project
  const handleCreateCategory = async (categoryData) => {
    return await createCategory(id, categoryData)
  }

  // Filter actions by category
  const filteredActions = categoryFilter
    ? actions.filter(a => a.category_id === categoryFilter)
    : actions

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (file) {
      await uploadFile(id, file)
      e.target.value = ''
    }
  }

  // Drag and drop handlers for file upload
  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      await uploadFile(id, file)
    }
  }, [id, uploadFile])

  const handleCoverSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setCoverFile(file)
      setCoverPreview(URL.createObjectURL(file))
      e.target.value = ''
    }
  }

  const handleCoverConfirm = async () => {
    if (!coverFile) return
    setIsUploadingCover(true)
    await uploadCover(id, coverFile)
    setIsUploadingCover(false)
    setCoverFile(null)
    setCoverPreview(null)
  }

  const handleCoverCancel = () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview)
    setCoverFile(null)
    setCoverPreview(null)
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
    setMeetingData({ title: '', recorded_at: '', notes: '' })
    setAudioFile(null)
    setShowRecorder(false)
  }

  const handleEditMeeting = (meeting) => {
    setEditingMeeting(meeting)
    setMeetingData({
      title: meeting.title,
      recorded_at: meeting.recorded_at ? meeting.recorded_at.split('T')[0] : '',
      notes: meeting.notes || ''
    })
    setShowEditMeetingModal(true)
  }

  const handleSaveMeeting = async (e) => {
    e.preventDefault()
    if (editingMeeting) {
      await updateMeeting(editingMeeting.id, {
        title: meetingData.title,
        notes: meetingData.notes
      })
    }
    setShowEditMeetingModal(false)
    setEditingMeeting(null)
    setMeetingData({ title: '', recorded_at: '', notes: '' })
  }

  const handleRecordedAudio = (file) => {
    setAudioFile(file)
    setShowRecorder(false)
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
          <img src={getUploadUrl(currentProject.header_image)} alt="" className="w-full h-full object-cover" />
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
              onChange={handleCoverSelect}
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

      {/* Cover upload confirmation modal */}
      <Modal
        isOpen={!!coverPreview}
        onClose={handleCoverCancel}
        title="Upload Cover Image"
      >
        <div className="space-y-4">
          <div className="rounded-lg overflow-hidden border border-gray-200">
            <img src={coverPreview} alt="Preview" className="w-full h-48 object-cover" />
          </div>
          <p className="text-sm text-text-secondary">{coverFile?.name}</p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={handleCoverCancel}>Cancel</Button>
            <Button variant="primary" onClick={handleCoverConfirm} loading={isUploadingCover}>
              Upload
            </Button>
          </div>
        </div>
      </Modal>

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
              currentProject.status === 'inactive' ? 'bg-amber-100 text-amber-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {currentProject.status}
            </span>
          </div>
          {currentProject.description && (
            <p className="mt-2 text-text-secondary max-w-2xl">{currentProject.description}</p>
          )}

          {/* Progress - auto-calculated from tasks */}
          <div className="mt-4 max-w-md">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-text-secondary">Progress</span>
              <span className="font-medium text-text-primary">
                {autoProgress}% ({actions.filter(a => a.completed).length}/{actions.length} tasks)
              </span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary-400 to-primary-500 rounded-full transition-all duration-500"
                style={{ width: `${autoProgress}%` }}
              />
            </div>
          </div>
        </div>

        {canEdit && (
          <div className="flex gap-2 items-center">
            <Button variant="outline" onClick={handleGenerateAiSummary}>
              <Sparkles size={16} />
              AI Summary
            </Button>
            <Button variant="outline" onClick={() => setShowEditModal(true)}>
              <Edit3 size={16} />
              Edit
            </Button>
            {canDelete && (
              <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 size={16} />
              </Button>
            )}
            {/* Settings menu for status changes - admin only */}
            {canEditMeta && (
              <div className="relative">
                <Button
                  variant="outline"
                  onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                  className="!p-2"
                >
                  <MoreVertical size={16} />
                </Button>
                {showSettingsMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowSettingsMenu(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                      <div className="px-3 py-2 text-xs font-semibold text-text-secondary uppercase tracking-wider">
                        Set Status
                      </div>
                      {['active', 'completed', 'inactive', 'archived'].map((status) => (
                        <button
                          key={status}
                          onClick={() => handleStatusChange(status)}
                          className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-gray-50 ${
                            currentProject.status === status ? 'bg-gray-50 text-primary-600' : 'text-text-primary'
                          }`}
                        >
                          <span className="capitalize">{status}</span>
                          {currentProject.status === status && <Check size={16} />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
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

            {/* Category Manager and Filter Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Category filter buttons */}
              <div className="lg:col-span-2">
                {categories.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    <button
                      onClick={() => setCategoryFilter(null)}
                      className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
                        categoryFilter === null
                          ? 'bg-primary-100 text-primary-700'
                          : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
                      }`}
                    >
                      All ({actions.length})
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setCategoryFilter(cat.id)}
                        className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
                          categoryFilter === cat.id
                            ? 'ring-2 ring-offset-1 ring-gray-400'
                            : 'hover:opacity-80'
                        }`}
                        style={{
                          backgroundColor: cat.color + '20',
                          color: cat.color
                        }}
                      >
                        {cat.name} ({actions.filter(a => a.category_id === cat.id).length})
                      </button>
                    ))}
                    <button
                      onClick={() => setCategoryFilter('uncategorized')}
                      className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
                        categoryFilter === 'uncategorized'
                          ? 'bg-gray-200 text-text-primary'
                          : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
                      }`}
                    >
                      Uncategorized ({actions.filter(a => !a.category_id).length})
                    </button>
                  </div>
                )}

                {/* Action items list */}
                {filteredActions.length > 0 || (categoryFilter === 'uncategorized' && actions.filter(a => !a.category_id).length > 0) ? (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext
                      items={(categoryFilter === 'uncategorized'
                        ? actions.filter(a => !a.category_id)
                        : filteredActions
                      ).filter(a => !a.parent_task_id).map(a => a.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {(categoryFilter === 'uncategorized'
                          ? actions.filter(a => !a.category_id)
                          : filteredActions
                        ).filter(a => !a.parent_task_id).map((action) => (
                          <ActionItem
                            key={action.id}
                            action={action}
                            users={teamMembers}
                            categories={categories}
                            subtasks={getSubtasks(action.id)}
                            onToggle={(actionId, completed) => updateAction(actionId, { completed })}
                            onToggleSubtask={(actionId, completed) => updateAction(actionId, { completed })}
                            onDelete={deleteAction}
                            onDeleteSubtask={deleteAction}
                            onUpdateCategory={updateAction}
                            onDrop={handleMakeSubtask}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                ) : actions.length > 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                    <ListTodo size={40} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-text-secondary">No tasks in this category.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                    <ListTodo size={40} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-text-secondary">No tasks yet. Add your first action item.</p>
                  </div>
                )}
              </div>

              {/* Category Manager Panel */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <CategoryManager
                    categories={categories}
                    onCreateCategory={handleCreateCategory}
                    onUpdateCategory={updateCategory}
                    onDeleteCategory={deleteCategory}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Files */}
        {activeTab === 'files' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-display font-semibold text-lg">Files</h3>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Upload size={16} />
                  {isUploading ? 'Uploading...' : 'Upload'}
                </Button>
              </div>
            </div>

            {/* Upload Progress Bar */}
            {isUploading && uploadProgress !== null && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-text-secondary">Uploading file...</span>
                  <span className="text-sm font-medium text-primary-600">{uploadProgress}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary-400 to-primary-500 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Drag and Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                isDragging
                  ? 'border-primary-400 bg-primary-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <Upload size={32} className={`mx-auto mb-2 ${isDragging ? 'text-primary-500' : 'text-gray-400'}`} />
              <p className="text-sm text-text-secondary">
                {isDragging ? 'Drop file here' : 'Drag and drop files here, or click Upload'}
              </p>
            </div>

            {files.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {files.map((file) => (
                  <FileCard
                    key={file.id}
                    file={file}
                    onDownload={handleDownloadFile}
                    onDelete={deleteFile}
                    onPreview={setPreviewFile}
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
                    onEdit={handleEditMeeting}
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
                  <option value="inactive">Inactive</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">Progress</label>
                <div className="px-4 py-2.5 rounded-organic border border-gray-200 bg-gray-50 text-text-secondary text-sm">
                  Auto-calculated: {autoProgress}%
                </div>
              </div>
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
              <label className="block text-sm font-medium text-text-primary mb-1.5">Parent Task (optional)</label>
              <select
                value={newAction.parent_task_id}
                onChange={(e) => setNewAction({ ...newAction, parent_task_id: e.target.value })}
                className="w-full px-4 py-2.5 rounded-organic border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                <option value="">No parent (top-level task)</option>
                {parentTasks.map((task) => (
                  <option key={task.id} value={task.id}>{task.title}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              <span className="flex items-center gap-1.5">
                <Users size={14} />
                Assign to (select multiple)
              </span>
            </label>
            <div className="border border-gray-300 rounded-organic p-2 max-h-40 overflow-y-auto bg-white">
              {teamMembers.length > 0 ? teamMembers.map((member) => (
                <label
                  key={member.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={newAction.assignee_ids.includes(member.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewAction({ ...newAction, assignee_ids: [...newAction.assignee_ids, member.id] })
                      } else {
                        setNewAction({ ...newAction, assignee_ids: newAction.assignee_ids.filter(id => id !== member.id) })
                      }
                    }}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-300"
                  />
                  <span className="text-sm text-text-primary">{member.name}</span>
                </label>
              )) : (
                <p className="text-sm text-text-secondary px-2 py-1">No team members found</p>
              )}
            </div>
            {newAction.assignee_ids.length > 0 && (
              <p className="text-xs text-text-secondary mt-1">
                {newAction.assignee_ids.length} member{newAction.assignee_ids.length !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>
          {categories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Category</label>
              <select
                value={newAction.category_id}
                onChange={(e) => setNewAction({ ...newAction, category_id: e.target.value })}
                className="w-full px-4 py-2.5 rounded-organic border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                <option value="">No category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          )}
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
      <Modal isOpen={showMeetingModal} onClose={() => { setShowMeetingModal(false); setShowRecorder(false); setAudioFile(null); }} title="Add Meeting" size="lg">
        <form onSubmit={handleAddMeeting} className="space-y-5">
          <Input
            label="Title"
            value={meetingData.title}
            onChange={(e) => setMeetingData({ ...meetingData, title: e.target.value })}
            placeholder="Meeting name"
            required
          />
          <DatePicker
            label="Date"
            value={meetingData.recorded_at}
            onChange={(date) => setMeetingData({ ...meetingData, recorded_at: date })}
            placeholder="Select meeting date"
          />

          <RichTextEditor
            label="Meeting Notes (optional)"
            value={meetingData.notes}
            onChange={(content) => setMeetingData({ ...meetingData, notes: content })}
            placeholder="Add meeting notes, agenda, or key points..."
            minHeight="150px"
          />

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Audio (optional)</label>

            {!showRecorder && !audioFile && (
              <div className="flex gap-3">
                <label className="flex-1 cursor-pointer">
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                  />
                  <div className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors">
                    <Upload size={18} className="text-text-secondary" />
                    <span className="text-sm text-text-secondary">Upload audio file</span>
                  </div>
                </label>
                <button
                  type="button"
                  onClick={() => setShowRecorder(true)}
                  className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-red-400 hover:bg-red-50 transition-colors"
                >
                  <Mic size={18} className="text-text-secondary" />
                  <span className="text-sm text-text-secondary">Record audio</span>
                </button>
              </div>
            )}

            {showRecorder && (
              <div className="border border-gray-200 rounded-lg p-4">
                <AudioRecorder
                  onSave={handleRecordedAudio}
                  onCancel={() => setShowRecorder(false)}
                />
              </div>
            )}

            {audioFile && !showRecorder && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2">
                  <Mic size={18} className="text-secondary-600" />
                  <span className="text-sm text-text-primary truncate max-w-[200px]">
                    {audioFile.name}
                  </span>
                  <span className="text-xs text-text-secondary">
                    ({(audioFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAudioFile(null)}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setShowMeetingModal(false); setShowRecorder(false); setAudioFile(null); }}>Cancel</Button>
            <Button type="submit">Add Meeting</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Meeting Modal */}
      <Modal isOpen={showEditMeetingModal} onClose={() => { setShowEditMeetingModal(false); setEditingMeeting(null); }} title="Edit Meeting Notes" size="lg">
        <form onSubmit={handleSaveMeeting} className="space-y-5">
          <Input
            label="Title"
            value={meetingData.title}
            onChange={(e) => setMeetingData({ ...meetingData, title: e.target.value })}
            placeholder="Meeting name"
            required
          />

          <RichTextEditor
            label="Meeting Notes"
            value={meetingData.notes}
            onChange={(content) => setMeetingData({ ...meetingData, notes: content })}
            placeholder="Add meeting notes, key decisions, action items..."
            minHeight="250px"
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setShowEditMeetingModal(false); setEditingMeeting(null); }}>Cancel</Button>
            <Button type="submit">Save Notes</Button>
          </div>
        </form>
      </Modal>

      {/* AI Summary Modal */}
      <Modal
        isOpen={showAiSummary}
        onClose={() => { setShowAiSummary(false); setAiSummary(null); setAiSummaryError(null); }}
        title="AI Project Summary"
        size="lg"
      >
        <div className="space-y-4">
          {aiSummaryLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 size={36} className="text-primary-500 animate-spin mb-4" />
              <p className="text-text-secondary">Generating AI summary...</p>
              <p className="text-xs text-text-secondary mt-1">Analyzing project data, action items, notes, and meetings</p>
            </div>
          )}
          {aiSummaryError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {aiSummaryError}
            </div>
          )}
          {aiSummary && (
            <>
              {/* Stats bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-primary-50 rounded-lg text-center">
                  <p className="text-lg font-bold text-primary-700">{aiSummary.stats?.totalActions || 0}</p>
                  <p className="text-xs text-primary-600">Total Tasks</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg text-center">
                  <p className="text-lg font-bold text-green-700">{aiSummary.stats?.completedActions || 0}</p>
                  <p className="text-xs text-green-600">Completed</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg text-center">
                  <p className="text-lg font-bold text-amber-700">{aiSummary.stats?.pendingActions || 0}</p>
                  <p className="text-xs text-amber-600">Pending</p>
                </div>
                <div className="p-3 bg-secondary-50 rounded-lg text-center">
                  <p className="text-lg font-bold text-secondary-700">{aiSummary.stats?.notesCount || 0}</p>
                  <p className="text-xs text-secondary-600">Notes</p>
                </div>
              </div>
              {/* Summary content */}
              <div className="prose prose-sm max-w-none bg-gray-50 rounded-lg p-5 border border-gray-200">
                <div className="whitespace-pre-wrap text-text-primary text-sm leading-relaxed">
                  {aiSummary.summary}
                </div>
              </div>
            </>
          )}
          <div className="flex justify-end gap-3 pt-2">
            {aiSummary && (
              <Button variant="secondary" onClick={handleGenerateAiSummary} disabled={aiSummaryLoading}>
                <Sparkles size={16} />
                Regenerate
              </Button>
            )}
            <Button variant="outline" onClick={() => { setShowAiSummary(false); setAiSummary(null); setAiSummaryError(null); }}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* File Preview Modal */}
      <FilePreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
        onDownload={handleDownloadFile}
        onDelete={(fileId) => {
          deleteFile(fileId)
          setPreviewFile(null)
        }}
      />
    </div>
  )
}
