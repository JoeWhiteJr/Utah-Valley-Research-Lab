import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { useAuthStore } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'
import { usersApi, filesApi, aiApi, meetingsApi, getUploadUrl } from '../services/api'
import Button from '../components/Button'
import Modal from '../components/Modal'
import Input from '../components/Input'
import ActionItem from '../components/ActionItem'
import FileCard from '../components/FileCard'
import FilePreviewModal from '../components/FilePreviewModal'
import NoteCard from '../components/NoteCard'
import MeetingCard from '../components/MeetingCard'
import DatePicker from '../components/DatePicker'
import RichTextEditor, { RichTextContent } from '../components/RichTextEditor'
import AudioRecorder from '../components/AudioRecorder'
import CategoryManager from '../components/CategoryManager'
import ConfirmDialog from '../components/ConfirmDialog'
import {
  ArrowLeft, Edit3, Trash2, Plus, Upload, ListTodo, FileText,
  StickyNote, Mic, Image, MoreVertical, Check, Users, Sparkles, Loader2,
  Calendar, UserPlus, UserMinus, Crown, Clock, Mail, Shield
} from 'lucide-react'
import { CalendarView } from '../components/calendar/CalendarView'
import { toast } from '../store/toastStore'
import { PROJECT_STATUSES } from '../constants'

const tabs = [
  { id: 'overview', label: 'Overview', icon: FileText },
  { id: 'actions', label: 'Action Items', icon: ListTodo },
  { id: 'schedule', label: 'Schedule', icon: Calendar },
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
    calculateProgress,
    members, membershipStatus, joinRequests,
    fetchMembers, fetchMembershipStatus, requestJoin, leaveProject,
    fetchJoinRequests, reviewJoinRequest, addMember
  } = useProjectStore()

  const [activeTab, setActiveTab] = useState('overview')
  const [teamMembers, setTeamMembers] = useState([])
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [editData, setEditData] = useState({ title: '', description: '', status: 'active', progress: 0 })

  // Action modals
  const [showActionModal, setShowActionModal] = useState(false)
  const [newAction, setNewAction] = useState({ title: '', description: '', due_date: '', assigned_to: '', assignee_ids: [], category_id: '', priority: '' })

  // Edit action state
  const [editingAction, setEditingAction] = useState(null)
  const [editForm, setEditForm] = useState({ title: '', description: '', due_date: '', assignee_ids: [], category_id: '', priority: '' })

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

  // Meeting view modal state
  const [viewingMeeting, setViewingMeeting] = useState(null)
  const [meetingAudioUrl, setMeetingAudioUrl] = useState(null)

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

  // Important Info editing state
  const [editingImportantInfo, setEditingImportantInfo] = useState(false)
  const [importantInfoDraft, setImportantInfoDraft] = useState('')

  // Add Member modal state
  const [showAddMemberModal, setShowAddMemberModal] = useState(false)
  const [allUsers, setAllUsers] = useState([])
  const [addMemberSearch, setAddMemberSearch] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState([])

  // Category filter state
  const [categoryFilter, setCategoryFilter] = useState(null)

  // Assignee filter state: null = all, 'me' = current user, or a user_id string
  const [assigneeFilter, setAssigneeFilter] = useState(null)

  // Task completion status filter state
  const [taskStatusFilter, setTaskStatusFilter] = useState('current')

  const coverInputRef = useRef(null)
  const fileInputRef = useRef(null)

  const canEdit = user?.role === 'admin' || user?.role === 'project_lead' || membershipStatus?.role === 'lead'
  const canEditMeta = user?.role === 'admin'
  const canDelete = user?.role === 'admin'

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Page title
  useEffect(() => {
    document.title = currentProject?.title ? `${currentProject.title} - Stats Lab` : 'Project - Stats Lab'
  }, [currentProject?.title])

  // Warn before navigating away with unsaved important info edits
  useEffect(() => {
    if (!editingImportantInfo) return
    const handler = (e) => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [editingImportantInfo])

  useEffect(() => {
    fetchProject(id)
    fetchActions(id)
    fetchCategories(id)
    fetchFiles(id)
    fetchNotes(id)
    fetchMeetings(id)
    fetchMembers(id)
    fetchMembershipStatus(id)
    fetchJoinRequests(id)
    usersApi.team().then(({ data }) => setTeamMembers(data.users))

    return () => clearCurrentProject()
  }, [id, fetchProject, fetchActions, fetchCategories, fetchFiles, fetchNotes, fetchMeetings, fetchMembers, fetchMembershipStatus, fetchJoinRequests, clearCurrentProject])

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
      description: newAction.description || null,
      due_date: newAction.due_date || null,
      assigned_to: newAction.assignee_ids.length > 0 ? newAction.assignee_ids[0] : (newAction.assigned_to || null),
      assignee_ids: newAction.assignee_ids.length > 0 ? newAction.assignee_ids : (newAction.assigned_to ? [newAction.assigned_to] : []),
      category_id: newAction.category_id || null,
      priority: newAction.priority || null
    })
    setShowActionModal(false)
    setNewAction({ title: '', description: '', due_date: '', assigned_to: '', assignee_ids: [], category_id: '', priority: '' })
  }

  // Handle editing an action
  const handleEditAction = (action) => {
    setEditingAction(action)
    setEditForm({
      title: action.title || '',
      description: action.description || '',
      due_date: action.due_date ? action.due_date.split('T')[0] : '',
      assignee_ids: action.assignees?.map(a => a.user_id) || [],
      category_id: action.category_id || '',
      priority: action.priority || ''
    })
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!editForm.title.trim()) return
    try {
      await updateAction(editingAction.id, {
        title: editForm.title.trim(),
        description: editForm.description || null,
        due_date: editForm.due_date || null,
        assignee_ids: editForm.assignee_ids,
        category_id: editForm.category_id || null,
        priority: editForm.priority || null
      })
      setEditingAction(null)
    } catch {
      toast.error('Failed to save task changes')
    }
  }

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

  // Handle saving Important Information
  const handleSaveImportantInfo = async () => {
    await updateProject(id, { important_info: importantInfoDraft })
    setEditingImportantInfo(false)
    toast.success('Subtitle saved')
  }

  // Handle Add Member modal
  const handleOpenAddMember = async () => {
    try {
      const { data } = await usersApi.team()
      setAllUsers(data.users || [])
    } catch { toast.error('Failed to load users') }
    setAddMemberSearch('')
    setSelectedUserIds([])
    setShowAddMemberModal(true)
  }

  const handleAddSelectedMembers = async () => {
    for (const userId of selectedUserIds) {
      await addMember(id, userId)
    }
    setShowAddMemberModal(false)
    setSelectedUserIds([])
    toast.success(`Added ${selectedUserIds.length} member${selectedUserIds.length !== 1 ? 's' : ''}`)
  }

  // Handle category creation for the project
  const handleCreateCategory = async (categoryData) => {
    return await createCategory(id, categoryData)
  }

  // Filter actions by category, completion status, and assignee
  const filteredActions = actions.filter(a => {
    // Category filter
    if (categoryFilter && categoryFilter !== 'uncategorized' && a.category_id !== categoryFilter) return false
    if (categoryFilter === 'uncategorized' && a.category_id) return false
    // Status filter
    if (taskStatusFilter === 'current' && a.completed) return false
    if (taskStatusFilter === 'completed' && !a.completed) return false
    // Assignee filter
    if (assigneeFilter === 'me') {
      const hasMe = a.assignees?.some(x => x.user_id === user?.id) || a.assigned_to === user?.id
      if (!hasMe) return false
    } else if (assigneeFilter) {
      const hasUser = a.assignees?.some(x => x.user_id === assigneeFilter) || a.assigned_to === assigneeFilter
      if (!hasUser) return false
    }
    return true
  })

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

  // Handle viewing a meeting's details
  const handleViewMeeting = async (meeting) => {
    setViewingMeeting(meeting)
    // Fetch audio blob if meeting has audio
    if (meeting.audio_path) {
      try {
        const { data } = await meetingsApi.getAudio(meeting.id)
        setMeetingAudioUrl(URL.createObjectURL(data))
      } catch {
        setMeetingAudioUrl(null)
      }
    } else {
      setMeetingAudioUrl(null)
    }
  }

  const handleCloseMeetingView = () => {
    setViewingMeeting(null)
    if (meetingAudioUrl) {
      URL.revokeObjectURL(meetingAudioUrl)
      setMeetingAudioUrl(null)
    }
  }

  if (isLoading || !currentProject) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/dashboard/projects')}
        className="inline-flex items-center gap-2 text-text-secondary dark:text-gray-400 hover:text-text-primary dark:hover:text-gray-100"
      >
        <ArrowLeft size={18} />
        Back to Projects
      </button>

      {/* Header image */}
      <div className="relative h-48 md:h-64 rounded-xl overflow-hidden bg-gradient-to-br from-primary-200 to-secondary-200 dark:from-primary-900 dark:to-secondary-900">
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
              className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg text-sm font-medium text-text-primary dark:text-gray-100 hover:bg-white dark:hover:bg-gray-700"
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
          <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            <img src={coverPreview} alt="Preview" className="w-full h-48 object-cover" />
          </div>
          <p className="text-sm text-text-secondary dark:text-gray-400">{coverFile?.name}</p>
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
            <h1 className="font-display font-bold text-2xl md:text-3xl text-text-primary dark:text-gray-100">
              {currentProject.title}
            </h1>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
              currentProject.status === 'active' ? 'bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-300' :
              currentProject.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
              currentProject.status === 'inactive' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
              'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            }`}>
              {currentProject.status}
            </span>
          </div>
          {currentProject.description && (
            <p className="mt-2 text-text-secondary dark:text-gray-400 max-w-2xl">{currentProject.description}</p>
          )}

          {/* Progress - auto-calculated from tasks */}
          <div className="mt-4 max-w-md">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-text-secondary dark:text-gray-400">Progress</span>
              <span className="font-medium text-text-primary dark:text-gray-100">
                {autoProgress}% ({actions.filter(a => a.completed).length}/{actions.length} tasks)
              </span>
            </div>
            <div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary-400 to-primary-500 rounded-full transition-all duration-500"
                style={{ width: `${autoProgress}%` }}
              />
            </div>
          </div>
        </div>

        {canEdit && (
          <div className="flex gap-2 items-center">
            <Button
              variant="outline"
              onClick={handleGenerateAiSummary}
              disabled={aiSummaryLoading}
            >
              {aiSummaryLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
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
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
                      <div className="px-3 py-2 text-xs font-semibold text-text-secondary dark:text-gray-400 uppercase tracking-wider">
                        Set Status
                      </div>
                      {PROJECT_STATUSES.map((status) => (
                        <button
                          key={status}
                          onClick={() => handleStatusChange(status)}
                          className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 ${
                            currentProject.status === status ? 'bg-gray-50 dark:bg-gray-700 text-primary-600 dark:text-primary-300' : 'text-text-primary dark:text-gray-100'
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
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === id
                  ? 'border-primary-500 text-primary-600 dark:text-primary-300'
                  : 'border-transparent text-text-secondary dark:text-gray-400 hover:text-text-primary dark:hover:text-gray-100 hover:border-gray-300 dark:hover:border-gray-600'
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
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-lg dark:text-gray-100">Subtitle</h3>
                {canEdit && !editingImportantInfo && (
                  <button
                    onClick={() => { setImportantInfoDraft(currentProject.important_info || ''); setEditingImportantInfo(true) }}
                    className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
                  >
                    Edit
                  </button>
                )}
              </div>
              {editingImportantInfo ? (
                <div className="space-y-3">
                  <textarea
                    value={importantInfoDraft}
                    onChange={(e) => setImportantInfoDraft(e.target.value)}
                    rows={6}
                    className="w-full px-4 py-2.5 rounded-organic border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 resize-y"
                    placeholder="Add a subtitle for this project..."
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setEditingImportantInfo(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleSaveImportantInfo}>Save</Button>
                  </div>
                </div>
              ) : (
                <p className="text-text-secondary dark:text-gray-400 whitespace-pre-wrap">
                  {currentProject.important_info || 'No subtitle added yet.'}
                </p>
              )}
              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <p className="text-2xl font-bold text-text-primary dark:text-gray-100">{actions.length}</p>
                  <p className="text-sm text-text-secondary dark:text-gray-400">Total tasks</p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <p className="text-2xl font-bold text-text-primary dark:text-gray-100">
                    {actions.filter(a => a.completed).length}
                  </p>
                  <p className="text-sm text-text-secondary dark:text-gray-400">Completed</p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <p className="text-2xl font-bold text-text-primary dark:text-gray-100">{files.length}</p>
                  <p className="text-sm text-text-secondary dark:text-gray-400">Files</p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <p className="text-2xl font-bold text-text-primary dark:text-gray-100">{notes.length}</p>
                  <p className="text-sm text-text-secondary dark:text-gray-400">Notes</p>
                </div>
              </div>
            </div>

            {/* Team Members Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-lg dark:text-gray-100 flex items-center gap-2">
                  <Users size={20} />
                  Team Members ({members.length})
                </h3>
                {/* Add Member button (lead/admin) */}
                {canEdit && (
                  <button
                    onClick={handleOpenAddMember}
                    className="flex items-center gap-1.5 px-3 py-2 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300 text-sm font-medium rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors"
                  >
                    <UserPlus size={16} />
                    Add Member
                  </button>
                )}
                {/* Join/Leave buttons */}
                {membershipStatus?.status === 'none' && (
                  <button
                    onClick={() => requestJoin(id)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors"
                  >
                    <UserPlus size={16} />
                    Request to Join
                  </button>
                )}
                {membershipStatus?.status === 'pending' && (
                  <span className="flex items-center gap-1.5 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-sm font-medium rounded-lg">
                    <Clock size={16} />
                    Request Pending
                  </span>
                )}
                {membershipStatus?.status === 'member' && membershipStatus?.role !== 'lead' && (
                  <button
                    onClick={() => setShowLeaveConfirm(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-text-secondary dark:text-gray-400 text-sm font-medium rounded-lg hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors"
                  >
                    <UserMinus size={16} />
                    Leave Project
                  </button>
                )}
              </div>
              {members.length > 0 ? (
                <div className="space-y-3">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                      {member.avatar_url ? (
                        <img src={member.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary-600 dark:text-primary-300">
                            {member.name?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-text-primary dark:text-gray-100 truncate">{member.name}</span>
                          {member.role === 'lead' && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-medium rounded-full">
                              <Crown size={12} />
                              Lead
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-text-secondary dark:text-gray-400">
                          <Mail size={12} />
                          <span className="truncate">{member.email}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-secondary dark:text-gray-400">No members yet.</p>
              )}
            </div>

            {/* Join Requests Panel (lead/admin only) */}
            {(membershipStatus?.role === 'lead' || user?.role === 'admin') && joinRequests.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-amber-200 dark:border-amber-700 p-6">
                <h3 className="font-display font-semibold text-lg dark:text-gray-100 flex items-center gap-2 mb-4">
                  <Shield size={20} className="text-amber-500" />
                  Join Requests ({joinRequests.length})
                </h3>
                <div className="space-y-3">
                  {joinRequests.map((req) => (
                    <div key={req.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <div className="flex items-center gap-3">
                        {req.user_avatar ? (
                          <img src={req.user_avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                            <span className="text-sm font-medium text-primary-600 dark:text-primary-300">
                              {req.user_name?.charAt(0)?.toUpperCase() || '?'}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-text-primary dark:text-gray-100 text-sm">{req.user_name}</p>
                          <p className="text-xs text-text-secondary dark:text-gray-400">{req.user_email}</p>
                          {req.message && <p className="text-xs text-text-secondary dark:text-gray-400 mt-1 italic">&ldquo;{req.message}&rdquo;</p>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => reviewJoinRequest(id, req.id, 'approve')}
                          className="px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => reviewJoinRequest(id, req.id, 'reject')}
                          className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-text-secondary dark:text-gray-400 text-xs font-medium rounded-lg hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Schedule */}
        {activeTab === 'schedule' && (
          <div>
            <CalendarView scope="project" projectId={id} />
          </div>
        )}

        {/* Actions */}
        {activeTab === 'actions' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-display font-semibold text-lg dark:text-gray-100">Action Items</h3>
              <Button size="sm" onClick={() => setShowActionModal(true)}>
                <Plus size={16} />
                Add Task
              </Button>
            </div>

            {/* Task status filter tabs */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5 w-fit">
              {[
                { id: 'current', label: 'Current' },
                { id: 'all', label: 'All' },
                { id: 'completed', label: 'Completed' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setTaskStatusFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    taskStatusFilter === tab.id
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Assignee filter */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => {
                  setAssigneeFilter(assigneeFilter === 'me' ? null : 'me')
                }}
                className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
                  assigneeFilter === 'me'
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-text-secondary dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                My Tasks ({actions.filter(a => {
                  if (taskStatusFilter === 'current' && a.completed) return false
                  if (taskStatusFilter === 'completed' && !a.completed) return false
                  return a.assignees?.some(x => x.user_id === user?.id) || a.assigned_to === user?.id
                }).length})
              </button>
              <select
                value={assigneeFilter && assigneeFilter !== 'me' ? assigneeFilter : ''}
                onChange={(e) => setAssigneeFilter(e.target.value || null)}
                className="px-3 py-1.5 text-xs rounded-full font-medium border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-300"
              >
                <option value="">All Members</option>
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
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
                          ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-text-secondary dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      All ({actions.filter(a => {
                        if (taskStatusFilter === 'current' && a.completed) return false
                        if (taskStatusFilter === 'completed' && !a.completed) return false
                        return true
                      }).length})
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setCategoryFilter(cat.id)}
                        className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
                          categoryFilter === cat.id
                            ? 'ring-2 ring-offset-1 ring-gray-400 dark:ring-offset-gray-900'
                            : 'hover:opacity-80'
                        }`}
                        style={{
                          backgroundColor: cat.color + '20',
                          color: cat.color
                        }}
                      >
                        {cat.name} ({actions.filter(a => {
                          if (a.category_id !== cat.id) return false
                          if (taskStatusFilter === 'current' && a.completed) return false
                          if (taskStatusFilter === 'completed' && !a.completed) return false
                          return true
                        }).length})
                      </button>
                    ))}
                    <button
                      onClick={() => setCategoryFilter('uncategorized')}
                      className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
                        categoryFilter === 'uncategorized'
                          ? 'bg-gray-200 dark:bg-gray-600 text-text-primary dark:text-gray-100'
                          : 'bg-gray-100 dark:bg-gray-700 text-text-secondary dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      Uncategorized ({actions.filter(a => {
                        if (a.category_id) return false
                        if (taskStatusFilter === 'current' && a.completed) return false
                        if (taskStatusFilter === 'completed' && !a.completed) return false
                        return true
                      }).length})
                    </button>
                  </div>
                )}

                {/* Active filter indicator */}
                {(categoryFilter || assigneeFilter) && (
                  <div className="flex items-center justify-between mb-3 px-1">
                    <p className="text-xs text-text-secondary dark:text-gray-400">
                      Showing {filteredActions.length} {filteredActions.length === 1 ? 'task' : 'tasks'}
                      {assigneeFilter === 'me' ? ' assigned to you' : assigneeFilter ? ` assigned to ${teamMembers.find(m => m.id === assigneeFilter)?.name || 'member'}` : ''}
                      {categoryFilter && categoryFilter !== 'uncategorized' ? ` in ${categories.find(c => c.id === categoryFilter)?.name || 'category'}` : ''}
                      {categoryFilter === 'uncategorized' ? ' (uncategorized)' : ''}
                    </p>
                    <button
                      onClick={() => { setCategoryFilter(null); setAssigneeFilter(null) }}
                      className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
                    >
                      Clear filters
                    </button>
                  </div>
                )}

                {/* Action items list */}
                {filteredActions.length > 0 ? (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext
                      items={filteredActions.map(a => a.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {filteredActions.map((action) => (
                          <ActionItem
                            key={action.id}
                            action={action}
                            users={teamMembers}
                            categories={categories}
                            onToggle={(actionId, completed) => updateAction(actionId, { completed })}
                            onDelete={deleteAction}
                            onEdit={handleEditAction}
                            onUpdateCategory={updateAction}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                ) : actions.length > 0 ? (
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
                    <ListTodo size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-text-secondary dark:text-gray-400">
                      {taskStatusFilter === 'completed' ? 'No completed tasks.' :
                       taskStatusFilter === 'current' ? 'All tasks are completed!' :
                       'No tasks match the current filters.'}
                    </p>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
                    <ListTodo size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-text-secondary dark:text-gray-400">No tasks yet. Add your first action item.</p>
                  </div>
                )}
              </div>

              {/* Category Manager Panel */}
              <div className="lg:col-span-1">
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
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
              <h3 className="font-display font-semibold text-lg dark:text-gray-100">Files</h3>
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
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-text-secondary dark:text-gray-400">Uploading file...</span>
                  <span className="text-sm font-medium text-primary-600 dark:text-primary-300">{uploadProgress}%</span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
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
                  ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/30'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
            >
              <Upload size={32} className={`mx-auto mb-2 ${isDragging ? 'text-primary-500 dark:text-primary-300' : 'text-gray-400 dark:text-gray-500'}`} />
              <p className="text-sm text-text-secondary dark:text-gray-400">
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
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
                <Upload size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-text-secondary dark:text-gray-400">No files uploaded yet.</p>
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        {activeTab === 'notes' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-display font-semibold text-lg dark:text-gray-100">Notes</h3>
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
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
                <StickyNote size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-text-secondary dark:text-gray-400">No notes yet. Create your first note.</p>
              </div>
            )}
          </div>
        )}

        {/* Meetings */}
        {activeTab === 'meetings' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-display font-semibold text-lg dark:text-gray-100">Meetings</h3>
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
                    onView={handleViewMeeting}
                    onEdit={handleEditMeeting}
                    onDelete={deleteMeeting}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
                <Mic size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-text-secondary dark:text-gray-400">No meetings recorded yet.</p>
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
              <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1.5">Title</label>
              <p className="px-4 py-2.5 rounded-organic border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-text-secondary dark:text-gray-400">
                {editData.title}
              </p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1.5">Description</label>
            <textarea
              value={editData.description}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              rows={4}
              className="w-full px-4 py-2.5 rounded-organic border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 resize-none"
            />
          </div>
          {canEditMeta && (
            <div>
              <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1.5">Status</label>
              <select
                value={editData.status}
                onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                className="w-full px-4 py-2.5 rounded-organic border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
              </select>
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
        <p className="text-text-secondary dark:text-gray-400">Are you sure you want to delete this project? This action cannot be undone.</p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDeleteProject}>Delete Project</Button>
        </div>
      </Modal>

      {/* Leave Project Confirmation */}
      <ConfirmDialog
        isOpen={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        onConfirm={() => { leaveProject(id); setShowLeaveConfirm(false) }}
        title="Leave Project"
        message="Are you sure you want to leave this project? You will lose access to its resources."
        confirmLabel="Leave"
        variant="danger"
      />

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
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1.5">Description (optional)</label>
            <textarea
              value={newAction.description}
              onChange={(e) => setNewAction({ ...newAction, description: e.target.value })}
              rows={3}
              placeholder="Add more details about this task..."
              className="w-full px-4 py-2.5 rounded-organic border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Due date (optional)"
              type="date"
              value={newAction.due_date}
              onChange={(e) => setNewAction({ ...newAction, due_date: e.target.value })}
            />
            <div>
              <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1.5">Priority (optional)</label>
              <select
                value={newAction.priority}
                onChange={(e) => setNewAction({ ...newAction, priority: e.target.value })}
                className="w-full px-4 py-2.5 rounded-organic border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                <option value="">No priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Users size={14} />
                Assign to (optional)
              </span>
            </label>
            <div className="border border-gray-300 dark:border-gray-600 rounded-organic p-2 max-h-40 overflow-y-auto bg-white dark:bg-gray-800">
              {teamMembers.length > 0 ? teamMembers.map((member) => (
                <label
                  key={member.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
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
                    className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-300"
                  />
                  <span className="text-sm text-text-primary dark:text-gray-100">{member.name}</span>
                </label>
              )) : (
                <p className="text-sm text-text-secondary dark:text-gray-400 px-2 py-1">No team members found</p>
              )}
            </div>
            {newAction.assignee_ids.length > 0 && (
              <p className="text-xs text-text-secondary dark:text-gray-400 mt-1">
                {newAction.assignee_ids.length} member{newAction.assignee_ids.length !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>
          {categories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1.5">Category (optional)</label>
              <select
                value={newAction.category_id}
                onChange={(e) => setNewAction({ ...newAction, category_id: e.target.value })}
                className="w-full px-4 py-2.5 rounded-organic border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300"
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

      {/* Edit Action Modal */}
      <Modal isOpen={!!editingAction} onClose={() => setEditingAction(null)} title="Edit Task">
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <Input
            label="Title"
            value={editForm.title}
            onChange={(e) => setEditForm({...editForm, title: e.target.value})}
            required
          />
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1.5">Description (optional)</label>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm({...editForm, description: e.target.value})}
              rows={3}
              placeholder="Add more details about this task..."
              className="w-full px-4 py-2.5 rounded-organic border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1.5">Due Date (optional)</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={editForm.due_date}
                onChange={(e) => setEditForm({...editForm, due_date: e.target.value})}
                className="flex-1 px-4 py-2.5 rounded-organic border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
              {editForm.due_date && (
                <button
                  type="button"
                  onClick={() => setEditForm({...editForm, due_date: ''})}
                  className="px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-organic hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          {categories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1.5">Category (optional)</label>
              <select
                value={editForm.category_id}
                onChange={(e) => setEditForm({...editForm, category_id: e.target.value})}
                className="w-full px-4 py-2.5 rounded-organic border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                <option value="">No category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1.5">Priority (optional)</label>
            <select
              value={editForm.priority}
              onChange={(e) => setEditForm({...editForm, priority: e.target.value})}
              className="w-full px-4 py-2.5 rounded-organic border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              <option value="">No priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1.5">Assignees (optional)</label>
            <div className="max-h-32 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-organic">
              {teamMembers.map(u => (
                <label key={u.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.assignee_ids.includes(u.id)}
                    onChange={() => {
                      const ids = editForm.assignee_ids.includes(u.id)
                        ? editForm.assignee_ids.filter(id => id !== u.id)
                        : [...editForm.assignee_ids, u.id]
                      setEditForm({...editForm, assignee_ids: ids})
                    }}
                    className="rounded border-gray-300 dark:border-gray-600 text-primary-600"
                  />
                  <span className="text-sm dark:text-gray-100">{u.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setEditingAction(null)}>Cancel</Button>
            <Button type="submit">Save Changes</Button>
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
            <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1.5">Content</label>
            <textarea
              value={noteData.content}
              onChange={(e) => setNoteData({ ...noteData, content: e.target.value })}
              rows={8}
              placeholder="Write your note..."
              className="w-full px-4 py-2.5 rounded-organic border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 resize-none"
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
            <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1.5">Audio (optional)</label>

            {!showRecorder && !audioFile && (
              <div className="flex gap-3">
                <label className="flex-1 cursor-pointer">
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                  />
                  <div className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors">
                    <Upload size={18} className="text-text-secondary dark:text-gray-400" />
                    <span className="text-sm text-text-secondary dark:text-gray-400">Upload audio file</span>
                  </div>
                </label>
                <button
                  type="button"
                  onClick={() => setShowRecorder(true)}
                  className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                >
                  <Mic size={18} className="text-text-secondary dark:text-gray-400" />
                  <span className="text-sm text-text-secondary dark:text-gray-400">Record audio</span>
                </button>
              </div>
            )}

            {showRecorder && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <AudioRecorder
                  onSave={handleRecordedAudio}
                  onCancel={() => setShowRecorder(false)}
                />
              </div>
            )}

            {audioFile && !showRecorder && (
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <Mic size={18} className="text-secondary-600 dark:text-secondary-400" />
                  <span className="text-sm text-text-primary dark:text-gray-100 truncate max-w-[200px]">
                    {audioFile.name}
                  </span>
                  <span className="text-xs text-text-secondary dark:text-gray-400">
                    ({(audioFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAudioFile(null)}
                  className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
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
              <p className="text-text-secondary dark:text-gray-400">Generating AI summary...</p>
              <p className="text-xs text-text-secondary dark:text-gray-400 mt-1">Analyzing project data, action items, notes, and meetings</p>
            </div>
          )}
          {aiSummaryError && (
            <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {aiSummaryError}
            </div>
          )}
          {aiSummary && (
            <>
              {/* Stats bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-primary-50 dark:bg-primary-900/30 rounded-lg text-center">
                  <p className="text-lg font-bold text-primary-700 dark:text-primary-300">{aiSummary.stats?.totalActions || 0}</p>
                  <p className="text-xs text-primary-600 dark:text-primary-400">Total Tasks</p>
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg text-center">
                  <p className="text-lg font-bold text-green-700 dark:text-green-300">{aiSummary.stats?.completedActions || 0}</p>
                  <p className="text-xs text-green-600 dark:text-green-400">Completed</p>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg text-center">
                  <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{aiSummary.stats?.pendingActions || 0}</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">Pending</p>
                </div>
                <div className="p-3 bg-secondary-50 dark:bg-secondary-900/30 rounded-lg text-center">
                  <p className="text-lg font-bold text-secondary-700 dark:text-secondary-300">{aiSummary.stats?.notesCount || 0}</p>
                  <p className="text-xs text-secondary-600 dark:text-secondary-400">Notes</p>
                </div>
              </div>
              {/* Summary content */}
              <div className="prose prose-sm max-w-none bg-gray-50 dark:bg-gray-900 rounded-lg p-5 border border-gray-200 dark:border-gray-700">
                <div className="whitespace-pre-wrap text-text-primary dark:text-gray-100 text-sm leading-relaxed">
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

      {/* Meeting View Modal */}
      <Modal
        isOpen={!!viewingMeeting}
        onClose={handleCloseMeetingView}
        title={viewingMeeting?.title || 'Meeting Details'}
        size="lg"
      >
        {viewingMeeting && (
          <div className="space-y-4">
            {viewingMeeting.recorded_at && (
              <p className="text-sm text-text-secondary dark:text-gray-400">
                {new Date(viewingMeeting.recorded_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            )}
            {viewingMeeting.audio_path && (
              <div>
                <h4 className="text-sm font-semibold text-text-primary dark:text-gray-100 mb-1">Audio Recording</h4>
                {meetingAudioUrl ? (
                  <audio controls className="w-full" src={meetingAudioUrl} preload="metadata" />
                ) : (
                  <p className="text-sm text-text-secondary dark:text-gray-400">Loading audio...</p>
                )}
              </div>
            )}
            {viewingMeeting.summary && (
              <div>
                <h4 className="text-sm font-semibold text-text-primary dark:text-gray-100 mb-1">Summary</h4>
                <p className="text-sm text-text-secondary dark:text-gray-400 whitespace-pre-wrap">{viewingMeeting.summary}</p>
              </div>
            )}
            {viewingMeeting.transcript && (
              <div>
                <h4 className="text-sm font-semibold text-text-primary dark:text-gray-100 mb-1">Transcript</h4>
                <div className="max-h-64 overflow-y-auto bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-text-secondary dark:text-gray-400 whitespace-pre-wrap">{viewingMeeting.transcript}</p>
                </div>
              </div>
            )}
            {viewingMeeting.notes && (
              <div>
                <h4 className="text-sm font-semibold text-text-primary dark:text-gray-100 mb-1">Notes</h4>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <RichTextContent content={viewingMeeting.notes} className="text-sm" />
                </div>
              </div>
            )}
            {!viewingMeeting.summary && !viewingMeeting.transcript && !viewingMeeting.notes && !viewingMeeting.audio_path && (
              <p className="text-sm text-text-secondary dark:text-gray-400">No additional details available for this meeting.</p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={handleCloseMeetingView}>Close</Button>
            </div>
          </div>
        )}
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

      {/* Add Member Modal */}
      <Modal isOpen={showAddMemberModal} onClose={() => setShowAddMemberModal(false)} title="Add Members">
        <div className="space-y-4">
          <Input
            placeholder="Search users by name..."
            value={addMemberSearch}
            onChange={(e) => setAddMemberSearch(e.target.value)}
          />
          <div className="border border-gray-300 dark:border-gray-600 rounded-organic max-h-60 overflow-y-auto">
            {(() => {
              const existingIds = new Set(members.map(m => m.user_id))
              const filtered = allUsers.filter(u =>
                !existingIds.has(u.id) &&
                u.name?.toLowerCase().includes(addMemberSearch.toLowerCase())
              )
              if (filtered.length === 0) {
                return <p className="text-sm text-text-secondary dark:text-gray-400 px-3 py-4 text-center">No users found</p>
              }
              return filtered.map(u => (
                <label key={u.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedUserIds.includes(u.id)}
                    onChange={() => {
                      setSelectedUserIds(prev =>
                        prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]
                      )
                    }}
                    className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-300"
                  />
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-primary-600 dark:text-primary-300">
                        {u.name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary dark:text-gray-100 truncate">{u.name}</p>
                      <p className="text-xs text-text-secondary dark:text-gray-400 truncate">{u.email}</p>
                    </div>
                  </div>
                </label>
              ))
            })()}
          </div>
          {selectedUserIds.length > 0 && (
            <p className="text-xs text-text-secondary dark:text-gray-400">
              {selectedUserIds.length} user{selectedUserIds.length !== 1 ? 's' : ''} selected
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowAddMemberModal(false)}>Cancel</Button>
            <Button onClick={handleAddSelectedMembers} disabled={selectedUserIds.length === 0}>
              <UserPlus size={16} />
              Add Selected
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
