import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { useAuthStore } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'
import { usersApi, filesApi, aiApi, meetingsApi } from '../services/api'
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
import AudioPlayer from '../components/AudioPlayer'
import CategoryManager from '../components/CategoryManager'
import ConfirmDialog from '../components/ConfirmDialog'
import ProjectChat from '../components/ProjectChat'
import {
  ArrowLeft, Edit3, Trash2, Plus, Upload, ListTodo, FileText,
  StickyNote, Mic, MoreVertical, Check, Users, Sparkles, Loader2,
  Calendar, UserPlus, UserMinus, Crown, Clock, Shield,
  MessageCircle, FolderPlus, Folder, ChevronRight, Search, Pin, X, ChevronDown, Filter
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
  { id: 'meetings', label: 'Meetings', icon: Mic },
  { id: 'chat', label: 'Chat', icon: MessageCircle }
]

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const {
    currentProject, fetchProject, updateProject, deleteProject,
    actions, fetchActions, createAction, updateAction, deleteAction, reorderActions,
    categories, fetchCategories, createCategory, updateCategory, deleteCategory,
    files, fetchFiles, uploadFile, deleteFile, moveFile,
    folders, fetchFolders, createFolder, renameFolder, deleteFolder,
    notes, fetchNotes, createNote, updateNote, deleteNote, toggleNotePin, toggleNoteProjectPin,
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
  const [noteSearch, setNoteSearch] = useState('')
  const [noteSearchDebounced, setNoteSearchDebounced] = useState('')

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
  const [meetingViewTab, setMeetingViewTab] = useState('summary')
  const [meetingViewNotes, setMeetingViewNotes] = useState('')
  const [meetingViewTitle, setMeetingViewTitle] = useState('')
  const [meetingAudioUploadFile, setMeetingAudioUploadFile] = useState(null)

  // File upload state
  const [isDragging, setIsDragging] = useState(false)
  const [previewFile, setPreviewFile] = useState(null)

  // Folder state
  const [currentFolderId, setCurrentFolderId] = useState(null)
  const [showNewFolderModal, setShowNewFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

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
  const [categoryFilters, setCategoryFilters] = useState([])
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [assigneeFilter, setAssigneeFilter] = useState('me')
  const [taskStatusFilter, setTaskStatusFilter] = useState('current')

  // Members sidebar collapsed state
  const [membersSidebarCollapsed, setMembersSidebarCollapsed] = useState(false)

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
    fetchFolders(id)
    fetchNotes(id)
    fetchMeetings(id)
    fetchMembers(id)
    fetchMembershipStatus(id)
    fetchJoinRequests(id)
    usersApi.team().then(({ data }) => setTeamMembers(data.users))

    return () => clearCurrentProject()
  }, [id, fetchProject, fetchActions, fetchCategories, fetchFiles, fetchFolders, fetchNotes, fetchMeetings, fetchMembers, fetchMembershipStatus, fetchJoinRequests, clearCurrentProject])

  useEffect(() => {
    if (currentProject) {
      setEditData({
        title: currentProject.title,
        description: currentProject.description || '',
        status: currentProject.status,
        progress: currentProject.progress || 0,
        subheader: currentProject.subheader || '',
      })
    }
  }, [currentProject])

  // Debounce note search
  useEffect(() => {
    const timer = setTimeout(() => setNoteSearchDebounced(noteSearch), 300)
    return () => clearTimeout(timer)
  }, [noteSearch])

  useEffect(() => {
    if (id) fetchNotes(id, noteSearchDebounced || undefined)
  }, [noteSearchDebounced, id, fetchNotes])

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
      : { description: editData.description, subheader: editData.subheader }
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

  const autoProgress = calculateProgress()

  const handleStatusChange = async (newStatus) => {
    await updateProject(id, { status: newStatus })
    setShowSettingsMenu(false)
  }

  const handleGenerateAiSummary = async () => {
    setShowAiSummary(true)
    setAiSummaryLoading(true)
    setAiSummaryError(null)
    setAiSummary(null)
    try {
      const { data } = await aiApi.summarizeProject(id)
      setAiSummary(data)
    } catch (error) {
      setAiSummaryError(error.response?.data?.error?.message || 'Failed to generate AI summary. Please try again.')
    } finally {
      setAiSummaryLoading(false)
    }
  }

  const handleSaveImportantInfo = async () => {
    await updateProject(id, { important_info: importantInfoDraft })
    setEditingImportantInfo(false)
    toast.success('Important info saved')
  }

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

  const handleCreateCategory = async (categoryData) => {
    return await createCategory(id, categoryData)
  }

  const filteredActions = actions.filter(a => {
    if (categoryFilters.length > 0) {
      const hasMatch = categoryFilters.some(cf => {
        if (cf === 'uncategorized') return !a.category_id
        return a.category_id === cf
      })
      if (!hasMatch) return false
    }
    if (taskStatusFilter === 'current' && a.completed) return false
    if (taskStatusFilter === 'completed' && !a.completed) return false
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
    if (file) await uploadFile(id, file)
  }, [id, uploadFile])

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

  // Meeting view
  const handleViewMeeting = async (meeting) => {
    setViewingMeeting(meeting)
    setMeetingViewTitle(meeting.title)
    setMeetingViewNotes(meeting.notes || '')
    setMeetingViewTab('summary')
    setMeetingAudioUploadFile(null)
    if (meeting.audio_path) {
      try {
        const { data } = await meetingsApi.getAudio(meeting.id)
        setMeetingAudioUrl(URL.createObjectURL(data))
      } catch { setMeetingAudioUrl(null) }
    } else {
      setMeetingAudioUrl(null)
    }
  }

  const handleCloseMeetingView = () => {
    setViewingMeeting(null)
    if (meetingAudioUrl) { URL.revokeObjectURL(meetingAudioUrl); setMeetingAudioUrl(null) }
  }

  const handleSaveMeetingView = async () => {
    if (!viewingMeeting) return
    await updateMeeting(viewingMeeting.id, { title: meetingViewTitle, notes: meetingViewNotes })
    // Upload audio if a new file was selected
    if (meetingAudioUploadFile) {
      try {
        await meetingsApi.uploadAudio(viewingMeeting.id, meetingAudioUploadFile)
        toast.success('Audio uploaded')
      } catch { toast.error('Failed to upload audio') }
    }
    toast.success('Meeting saved')
    handleCloseMeetingView()
    fetchMeetings(id)
  }

  // Folder helpers
  const currentFolderBreadcrumbs = useCallback(() => {
    const crumbs = [{ id: null, name: 'Root' }]
    if (!currentFolderId) return crumbs
    const buildPath = (folderId) => {
      const folder = folders.find(f => f.id === folderId)
      if (!folder) return
      if (folder.parent_id) buildPath(folder.parent_id)
      crumbs.push({ id: folder.id, name: folder.name })
    }
    buildPath(currentFolderId)
    return crumbs
  }, [currentFolderId, folders])

  const foldersInCurrentDir = folders.filter(f => f.parent_id === currentFolderId)
  const filesInCurrentDir = files.filter(f => (f.folder_id || null) === currentFolderId)

  const handleCreateFolder = async (e) => {
    e.preventDefault()
    if (!newFolderName.trim()) return
    await createFolder(id, { name: newFolderName.trim(), parent_id: currentFolderId })
    setShowNewFolderModal(false)
    setNewFolderName('')
  }

  const handleMoveFileToFolder = async (fileId, folderId) => {
    await moveFile(fileId, folderId)
    fetchFiles(id)
  }

  // Note helpers — project pins first, then personal pins
  const projectPinnedNotes = notes.filter(n => n.pinned_for_project)
  const personalPinnedNotes = notes.filter(n => n.is_pinned && !n.pinned_for_project)
  const pinnedNotes = [...projectPinnedNotes, ...personalPinnedNotes]
  const unpinnedNotes = notes.filter(n => !n.is_pinned && !n.pinned_for_project)

  // Sort members with lead on top
  const sortedMembers = [...members].sort((a, b) => {
    if (a.role === 'lead') return -1
    if (b.role === 'lead') return 1
    return 0
  })

  if (isLoading || !currentProject) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
        <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        onClick={() => navigate('/dashboard/projects')}
        className="inline-flex items-center gap-2 text-text-secondary dark:text-gray-400 hover:text-text-primary dark:hover:text-gray-100"
      >
        <ArrowLeft size={18} />
        Back to Projects
      </button>

      {/* Title and actions — always visible */}
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
          {/* Subtitle/description/progress only on overview */}
          {activeTab === 'overview' && (
            <>
              {currentProject.subheader && (
                <p className="mt-1 text-text-secondary dark:text-gray-400">{currentProject.subheader}</p>
              )}
              {currentProject.description && (
                <p className="mt-2 text-text-secondary dark:text-gray-400 max-w-2xl">{currentProject.description}</p>
              )}
            </>
          )}
        </div>

        {canEdit && (
          <div className="flex gap-2 items-center flex-shrink-0">
            <Button variant="outline" onClick={handleGenerateAiSummary} disabled={aiSummaryLoading}>
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
            {canEditMeta && (
              <div className="relative">
                <Button variant="outline" onClick={() => setShowSettingsMenu(!showSettingsMenu)} className="!p-2">
                  <MoreVertical size={16} />
                </Button>
                {showSettingsMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowSettingsMenu(false)} />
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
                      <div className="px-3 py-2 text-xs font-semibold text-text-secondary dark:text-gray-400 uppercase tracking-wider">Set Status</div>
                      {PROJECT_STATUSES.map((status) => (
                        <button key={status} onClick={() => handleStatusChange(status)}
                          className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 ${
                            currentProject.status === status ? 'bg-gray-50 dark:bg-gray-700 text-primary-600 dark:text-primary-300' : 'text-text-primary dark:text-gray-100'
                          }`}>
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

      {/* Tabs — larger */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {tabs.map(({ id: tabId, label, icon: Icon }) => (
            <button
              key={tabId}
              onClick={() => setActiveTab(tabId)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm md:text-base font-semibold border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tabId
                  ? 'border-primary-500 text-primary-600 dark:text-primary-300'
                  : 'border-transparent text-text-secondary dark:text-gray-400 hover:text-text-primary dark:hover:text-gray-100 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <Icon size={20} />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="min-h-[400px]">
        {/* Overview with right sidebar */}
        {activeTab === 'overview' && (
          <div className="flex gap-6">
            {/* Main content */}
            <div className="flex-1 space-y-6 min-w-0">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-semibold text-lg dark:text-gray-100">Important Information</h3>
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
                      placeholder="Add important information, links, or notes for the team..."
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setEditingImportantInfo(false)}>Cancel</Button>
                      <Button size="sm" onClick={handleSaveImportantInfo}>Save</Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-text-secondary dark:text-gray-400 whitespace-pre-wrap">
                    {currentProject.important_info || 'No important information added yet.'}
                  </p>
                )}
                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <p className="text-2xl font-bold text-text-primary dark:text-gray-100">{actions.length}</p>
                    <p className="text-sm text-text-secondary dark:text-gray-400">Total tasks</p>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <p className="text-2xl font-bold text-text-primary dark:text-gray-100">{actions.filter(a => a.completed).length}</p>
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
            </div>

            {/* Right sidebar — Members */}
            <div className="w-72 flex-shrink-0 hidden lg:block space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setMembersSidebarCollapsed(!membersSidebarCollapsed)}
                  className="w-full flex items-center justify-between p-4"
                >
                  <h3 className="font-display font-semibold text-sm dark:text-gray-100 flex items-center gap-2">
                    <Users size={16} />
                    Members ({members.length})
                  </h3>
                  <ChevronRight size={16} className={`text-text-secondary dark:text-gray-400 transition-transform ${membersSidebarCollapsed ? '' : 'rotate-90'}`} />
                </button>

                {!membersSidebarCollapsed && (
                  <div className="px-4 pb-4 space-y-2">
                    {canEdit && (
                      <button
                        onClick={handleOpenAddMember}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-primary-600 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
                      >
                        <Plus size={14} />
                        Add Member
                      </button>
                    )}

                    {/* Join/Leave buttons */}
                    {membershipStatus?.status === 'none' && (
                      <button onClick={() => requestJoin(id)} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-primary-500 text-white text-xs font-medium rounded-lg hover:bg-primary-600 transition-colors">
                        <UserPlus size={14} /> Request to Join
                      </button>
                    )}
                    {membershipStatus?.status === 'pending' && (
                      <span className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-medium rounded-lg">
                        <Clock size={14} /> Request Pending
                      </span>
                    )}
                    {membershipStatus?.status === 'member' && membershipStatus?.role !== 'lead' && (
                      <button onClick={() => setShowLeaveConfirm(true)} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-text-secondary dark:text-gray-400 text-xs font-medium rounded-lg hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors">
                        <UserMinus size={14} /> Leave Project
                      </button>
                    )}

                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {sortedMembers.map((member) => (
                        <div key={member.id} className="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                          {member.avatar_url ? (
                            <img src={member.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                              <span className="text-xs font-medium text-primary-600 dark:text-primary-300">{member.name?.charAt(0)?.toUpperCase() || '?'}</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-medium text-text-primary dark:text-gray-100 truncate">{member.name}</span>
                              {member.role === 'lead' && <Crown size={10} className="text-amber-500 flex-shrink-0" />}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Join Requests */}
              {(membershipStatus?.role === 'lead' || user?.role === 'admin') && joinRequests.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-amber-200 dark:border-amber-700 p-4">
                  <h3 className="font-display font-semibold text-sm dark:text-gray-100 flex items-center gap-2 mb-3">
                    <Shield size={16} className="text-amber-500" />
                    Requests ({joinRequests.length})
                  </h3>
                  <div className="space-y-2">
                    {joinRequests.map((req) => (
                      <div key={req.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                            <span className="text-[10px] font-medium text-primary-600 dark:text-primary-300">{req.user_name?.charAt(0)?.toUpperCase() || '?'}</span>
                          </div>
                          <span className="text-xs font-medium text-text-primary dark:text-gray-100 truncate">{req.user_name}</span>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => reviewJoinRequest(id, req.id, 'approve')} className="px-2 py-1 bg-green-500 text-white text-[10px] font-medium rounded hover:bg-green-600">Approve</button>
                          <button onClick={() => reviewJoinRequest(id, req.id, 'reject')} className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-text-secondary dark:text-gray-400 text-[10px] font-medium rounded hover:bg-red-100 hover:text-red-600">Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Schedule */}
        {activeTab === 'schedule' && (
          <div className="min-h-[calc(100vh-200px)]">
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

            {/* Progress bar in actions tab */}
            <div className="max-w-md">
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

            {/* Task status filter tabs */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5 w-fit">
              {[
                { id: 'current', label: 'Current' },
                { id: 'all', label: 'All' },
                { id: 'completed', label: 'Completed' },
              ].map((tab) => (
                <button key={tab.id} onClick={() => setTaskStatusFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    taskStatusFilter === tab.id
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Assignee filter */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => setAssigneeFilter(assigneeFilter === 'me' ? null : 'me')}
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

            {/* Category filter dropdown */}
            {categories.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full font-medium border transition-colors ${
                      categoryFilters.length > 0
                        ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-600 text-primary-700 dark:text-primary-300'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-text-secondary dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <Filter size={12} />
                    Categories {categoryFilters.length > 0 && `(${categoryFilters.length})`}
                    <ChevronDown size={12} />
                  </button>
                  {showCategoryDropdown && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowCategoryDropdown(false)} />
                      <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[180px]">
                        {categories.map((cat) => (
                          <label key={cat.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={categoryFilters.includes(cat.id)}
                              onChange={() => setCategoryFilters(prev =>
                                prev.includes(cat.id) ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                              )}
                              className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-300"
                            />
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                            <span className="text-xs text-text-primary dark:text-gray-100">{cat.name}</span>
                          </label>
                        ))}
                        <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-t border-gray-100 dark:border-gray-700">
                          <input
                            type="checkbox"
                            checked={categoryFilters.includes('uncategorized')}
                            onChange={() => setCategoryFilters(prev =>
                              prev.includes('uncategorized') ? prev.filter(id => id !== 'uncategorized') : [...prev, 'uncategorized']
                            )}
                            className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-300"
                          />
                          <span className="text-xs text-text-secondary dark:text-gray-400">Uncategorized</span>
                        </label>
                        {categoryFilters.length > 0 && (
                          <button
                            onClick={() => setCategoryFilters([])}
                            className="w-full px-3 py-1.5 text-xs text-primary-600 dark:text-primary-400 hover:bg-gray-50 dark:hover:bg-gray-700 text-left border-t border-gray-100 dark:border-gray-700"
                          >
                            Clear all
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
                {categoryFilters.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {categoryFilters.map(cf => {
                      const cat = categories.find(c => c.id === cf)
                      return (
                        <span key={cf} className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full"
                          style={cat ? { backgroundColor: cat.color + '20', color: cat.color } : {}}
                        >
                          {cat ? cat.name : 'Uncategorized'}
                          <button onClick={() => setCategoryFilters(prev => prev.filter(id => id !== cf))} className="hover:opacity-70">
                            <X size={10} />
                          </button>
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {(categoryFilters.length > 0 || (assigneeFilter && assigneeFilter !== 'me')) && (
              <div className="flex items-center justify-between px-1">
                <p className="text-xs text-text-secondary dark:text-gray-400">
                  Showing {filteredActions.length} {filteredActions.length === 1 ? 'task' : 'tasks'}
                  {assigneeFilter === 'me' ? ' assigned to you' : assigneeFilter ? ` assigned to ${teamMembers.find(m => m.id === assigneeFilter)?.name || 'member'}` : ''}
                </p>
                <button onClick={() => { setCategoryFilters([]); setAssigneeFilter('me') }} className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium">Clear filters</button>
              </div>
            )}

            {/* Action items and Category Manager */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
              <div className="lg:col-span-2">

                {filteredActions.length > 0 ? (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={filteredActions.map(a => a.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {filteredActions.map((action) => (
                          <ActionItem key={action.id} action={action} users={teamMembers} categories={categories}
                            onToggle={(actionId, completed) => updateAction(actionId, { completed })}
                            onDelete={deleteAction} onEdit={handleEditAction} onUpdateCategory={updateAction} />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                ) : actions.length > 0 ? (
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
                    <ListTodo size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-text-secondary dark:text-gray-400">
                      {taskStatusFilter === 'completed' ? 'No completed tasks.' : taskStatusFilter === 'current' ? 'All tasks are completed!' : 'No tasks match the current filters.'}
                    </p>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
                    <ListTodo size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-text-secondary dark:text-gray-400">No tasks yet. Add your first action item.</p>
                  </div>
                )}
              </div>

              <div className="lg:col-span-1">
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <CategoryManager categories={categories} onCreateCategory={handleCreateCategory} onUpdateCategory={updateCategory} onDeleteCategory={deleteCategory} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Files with folders */}
        {activeTab === 'files' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-display font-semibold text-lg dark:text-gray-100">Files</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setNewFolderName(''); setShowNewFolderModal(true) }}>
                  <FolderPlus size={16} />
                  New Folder
                </Button>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
                <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                  <Upload size={16} />
                  {isUploading ? 'Uploading...' : 'Upload'}
                </Button>
              </div>
            </div>

            {/* Breadcrumbs */}
            <div className="flex items-center gap-1 text-sm">
              {currentFolderBreadcrumbs().map((crumb, i, arr) => (
                <span key={crumb.id || 'root'} className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentFolderId(crumb.id)}
                    className={`hover:text-primary-600 dark:hover:text-primary-400 transition-colors ${
                      i === arr.length - 1 ? 'font-medium text-text-primary dark:text-gray-100' : 'text-text-secondary dark:text-gray-400'
                    }`}
                  >
                    {crumb.name}
                  </button>
                  {i < arr.length - 1 && <ChevronRight size={14} className="text-gray-300 dark:text-gray-600" />}
                </span>
              ))}
            </div>

            {/* Upload Progress */}
            {isUploading && uploadProgress !== null && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-text-secondary dark:text-gray-400">Uploading file...</span>
                  <span className="text-sm font-medium text-primary-600 dark:text-primary-300">{uploadProgress}%</span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary-400 to-primary-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}

            {/* Drop zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                isDragging ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/30' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
            >
              <Upload size={32} className={`mx-auto mb-2 ${isDragging ? 'text-primary-500' : 'text-gray-400'}`} />
              <p className="text-sm text-text-secondary dark:text-gray-400">{isDragging ? 'Drop file here' : 'Drag and drop files here, or click Upload'}</p>
            </div>

            {/* Folders and files grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {foldersInCurrentDir.map((folder) => (
                <div
                  key={folder.id}
                  className="group bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-primary-300 dark:hover:border-primary-500 hover:shadow-sm transition-all cursor-pointer"
                  onClick={() => setCurrentFolderId(folder.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const fileId = e.dataTransfer.getData('text/file-id')
                    if (fileId) handleMoveFileToFolder(fileId, folder.id)
                  }}
                >
                  <Folder size={32} className="text-primary-400 dark:text-primary-500 mb-2" />
                  <p className="text-sm font-medium text-text-primary dark:text-gray-100 truncate">{folder.name}</p>
                  <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); const name = prompt('Rename folder:', folder.name); if (name) renameFolder(folder.id, name) }}
                      className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700">Rename</button>
                    <span className="text-gray-300">|</span>
                    <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this folder?')) deleteFolder(folder.id) }}
                      className="text-xs text-red-500 hover:text-red-700">Delete</button>
                  </div>
                </div>
              ))}
              {filesInCurrentDir.map((file) => (
                <div key={file.id} draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/file-id', file.id)}>
                  <FileCard file={file} onDownload={handleDownloadFile} onDelete={deleteFile} onPreview={setPreviewFile} />
                </div>
              ))}
            </div>

            {foldersInCurrentDir.length === 0 && filesInCurrentDir.length === 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
                <Upload size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-text-secondary dark:text-gray-400">{currentFolderId ? 'This folder is empty.' : 'No files uploaded yet.'}</p>
              </div>
            )}
          </div>
        )}

        {/* Notes — two-panel layout */}
        {activeTab === 'notes' && (
          <div className="flex gap-4">
            {/* Left pinned sidebar */}
            <div className="w-56 flex-shrink-0 hidden md:block space-y-3">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                <h4 className="font-display font-semibold text-sm dark:text-gray-100 flex items-center gap-2 mb-3">
                  <Pin size={14} className="text-primary-500" />
                  Pinned
                </h4>
                {pinnedNotes.length > 0 ? (
                  <div className="space-y-1">
                    {projectPinnedNotes.length > 0 && (
                      <>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary-500 dark:text-primary-400 px-2 pt-1">Project Pins</p>
                        {projectPinnedNotes.map((note) => (
                          <div key={note.id} className="group/pin flex items-center gap-1 border-l-2 border-primary-400 dark:border-primary-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                            <button
                              onClick={() => handleEditNote(note)}
                              className="flex-1 text-left px-2 py-2 min-w-0"
                            >
                              <p className="text-xs font-medium text-text-primary dark:text-gray-100 truncate">{note.title}</p>
                            </button>
                            {canEdit && (
                              <button
                                onClick={() => toggleNoteProjectPin(note.id)}
                                className="p-1 mr-1 rounded text-gray-400 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover/pin:opacity-100 transition-opacity flex-shrink-0"
                                title="Unpin from project"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        ))}
                      </>
                    )}
                    {personalPinnedNotes.length > 0 && (
                      <>
                        <p className={`text-[10px] font-semibold uppercase tracking-wider text-text-secondary dark:text-gray-400 px-2 ${projectPinnedNotes.length > 0 ? 'pt-2 mt-1 border-t border-gray-100 dark:border-gray-700' : 'pt-1'}`}>My Pins</p>
                        {personalPinnedNotes.map((note) => (
                          <div key={note.id} className="group/pin flex items-center gap-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                            <button
                              onClick={() => handleEditNote(note)}
                              className="flex-1 text-left px-2 py-2 min-w-0"
                            >
                              <p className="text-xs font-medium text-text-primary dark:text-gray-100 truncate">{note.title}</p>
                            </button>
                            <button
                              onClick={() => toggleNotePin(note.id)}
                              className="p-1 mr-1 rounded text-gray-400 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover/pin:opacity-100 transition-opacity flex-shrink-0"
                              title="Unpin"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-text-secondary dark:text-gray-400">No pinned notes</p>
                )}
              </div>
            </div>

            {/* Right main notes area */}
            <div className="flex-1 space-y-4 min-w-0">
              <div className="flex justify-between items-center gap-3">
                <div className="flex-1 relative max-w-sm">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={noteSearch}
                    onChange={(e) => setNoteSearch(e.target.value)}
                    placeholder="Search notes..."
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                </div>
                <Button size="sm" onClick={() => { setEditingNote(null); setNoteData({ title: '', content: '' }); setShowNoteModal(true) }}>
                  <Plus size={16} />
                  New Note
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* New Note card */}
                <button
                  onClick={() => { setEditingNote(null); setNoteData({ title: '', content: '' }); setShowNoteModal(true) }}
                  className="bg-white dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-4 hover:border-primary-400 dark:hover:border-primary-500 transition-all flex flex-col items-center justify-center min-h-[140px]"
                >
                  <Plus size={24} className="text-gray-400 dark:text-gray-500 mb-2" />
                  <span className="text-sm font-medium text-text-secondary dark:text-gray-400">New Note</span>
                </button>

                {unpinnedNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onEdit={handleEditNote}
                    onDelete={deleteNote}
                    onTogglePin={toggleNotePin}
                    onToggleProjectPin={toggleNoteProjectPin}
                    canManageProject={canEdit}
                  />
                ))}
              </div>

              {unpinnedNotes.length === 0 && pinnedNotes.length === 0 && !noteSearch && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
                  <StickyNote size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                  <p className="text-text-secondary dark:text-gray-400">No notes yet. Create your first note.</p>
                </div>
              )}
            </div>
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
                  <MeetingCard key={meeting.id} meeting={meeting} onView={handleViewMeeting} onDelete={deleteMeeting} />
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

        {/* Chat */}
        {activeTab === 'chat' && (
          <ProjectChat projectId={id} />
        )}
      </div>

      {/* Edit Project Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Project">
        <form onSubmit={handleUpdateProject} className="space-y-5">
          {canEditMeta ? (
            <Input label="Title" value={editData.title} onChange={(e) => setEditData({ ...editData, title: e.target.value })} required />
          ) : (
            <div>
              <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1.5">Title</label>
              <p className="px-4 py-2.5 rounded-organic border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-text-secondary dark:text-gray-400">{editData.title}</p>
            </div>
          )}
          <Input label="Subheader (optional)" value={editData.subheader} onChange={(e) => setEditData({ ...editData, subheader: e.target.value })} placeholder="Short tagline for this project..." maxLength={200} />
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1.5">Description</label>
            <textarea value={editData.description} onChange={(e) => setEditData({ ...editData, description: e.target.value })} rows={4}
              className="w-full px-4 py-2.5 rounded-organic border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 resize-none" />
          </div>
          {canEditMeta && (
            <div>
              <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1.5">Status</label>
              <select value={editData.status} onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                className="w-full px-4 py-2.5 rounded-organic border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300">
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

      {/* Delete Confirmation */}
      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete Project" size="sm">
        <p className="text-text-secondary dark:text-gray-400">Are you sure you want to delete this project? This action cannot be undone.</p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDeleteProject}>Delete Project</Button>
        </div>
      </Modal>

      {/* Leave Project */}
      <ConfirmDialog isOpen={showLeaveConfirm} onClose={() => setShowLeaveConfirm(false)}
        onConfirm={() => { leaveProject(id); setShowLeaveConfirm(false) }}
        title="Leave Project" message="Are you sure you want to leave this project? You will lose access to its resources."
        confirmLabel="Leave" variant="danger" />

      {/* Add Action Modal */}
      <Modal isOpen={showActionModal} onClose={() => setShowActionModal(false)} title="Add Action Item">
        <form onSubmit={handleAddAction} className="space-y-5">
          <Input label="Task" value={newAction.title} onChange={(e) => setNewAction({ ...newAction, title: e.target.value })} placeholder="What needs to be done?" required />
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1.5">Description (optional)</label>
            <textarea value={newAction.description} onChange={(e) => setNewAction({ ...newAction, description: e.target.value })} rows={3} placeholder="Add more details..."
              className="w-full px-4 py-2.5 rounded-organic border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Due date (optional)" type="date" value={newAction.due_date} onChange={(e) => setNewAction({ ...newAction, due_date: e.target.value })} />
            <div>
              <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1.5">Priority (optional)</label>
              <select value={newAction.priority} onChange={(e) => setNewAction({ ...newAction, priority: e.target.value })}
                className="w-full px-4 py-2.5 rounded-organic border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300">
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
              <span className="flex items-center gap-1.5"><Users size={14} /> Assign to (optional)</span>
            </label>
            <div className="border border-gray-300 dark:border-gray-600 rounded-organic p-2 max-h-40 overflow-y-auto bg-white dark:bg-gray-800">
              {teamMembers.length > 0 ? teamMembers.map((member) => (
                <label key={member.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                  <input type="checkbox" checked={newAction.assignee_ids.includes(member.id)}
                    onChange={(e) => {
                      if (e.target.checked) setNewAction({ ...newAction, assignee_ids: [...newAction.assignee_ids, member.id] })
                      else setNewAction({ ...newAction, assignee_ids: newAction.assignee_ids.filter(id => id !== member.id) })
                    }}
                    className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-300" />
                  <span className="text-sm text-text-primary dark:text-gray-100">{member.name}</span>
                </label>
              )) : <p className="text-sm text-text-secondary dark:text-gray-400 px-2 py-1">No team members found</p>}
            </div>
          </div>
          {categories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1.5">Category (optional)</label>
              <select value={newAction.category_id} onChange={(e) => setNewAction({ ...newAction, category_id: e.target.value })}
                className="w-full px-4 py-2.5 rounded-organic border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300">
                <option value="">No category</option>
                {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
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
          <Input label="Title" value={editForm.title} onChange={(e) => setEditForm({...editForm, title: e.target.value})} required />
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1.5">Description (optional)</label>
            <textarea value={editForm.description} onChange={(e) => setEditForm({...editForm, description: e.target.value})} rows={3} placeholder="Add more details..."
              className="w-full px-4 py-2.5 rounded-organic border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1.5">Due Date (optional)</label>
            <div className="flex gap-2">
              <input type="date" value={editForm.due_date} onChange={(e) => setEditForm({...editForm, due_date: e.target.value})}
                className="flex-1 px-4 py-2.5 rounded-organic border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300" />
              {editForm.due_date && <button type="button" onClick={() => setEditForm({...editForm, due_date: ''})}
                className="px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-organic hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors">Clear</button>}
            </div>
          </div>
          {categories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1.5">Category (optional)</label>
              <select value={editForm.category_id} onChange={(e) => setEditForm({...editForm, category_id: e.target.value})}
                className="w-full px-4 py-2.5 rounded-organic border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300">
                <option value="">No category</option>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1.5">Priority (optional)</label>
            <select value={editForm.priority} onChange={(e) => setEditForm({...editForm, priority: e.target.value})}
              className="w-full px-4 py-2.5 rounded-organic border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300">
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
                  <input type="checkbox" checked={editForm.assignee_ids.includes(u.id)}
                    onChange={() => {
                      const ids = editForm.assignee_ids.includes(u.id) ? editForm.assignee_ids.filter(id => id !== u.id) : [...editForm.assignee_ids, u.id]
                      setEditForm({...editForm, assignee_ids: ids})
                    }}
                    className="rounded border-gray-300 dark:border-gray-600 text-primary-600" />
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

      {/* Note Modal — large */}
      <Modal isOpen={showNoteModal} onClose={() => setShowNoteModal(false)} title={editingNote ? 'Edit Note' : 'Add Note'} size="full">
        <form onSubmit={handleSaveNote} className="space-y-5">
          <input
            value={noteData.title}
            onChange={(e) => setNoteData({ ...noteData, title: e.target.value })}
            placeholder="Note title"
            required
            className="w-full text-xl font-display font-semibold text-text-primary dark:text-gray-100 bg-transparent border-none outline-none placeholder:text-gray-400"
          />
          <div className="flex-1">
            <RichTextEditor
              value={noteData.content}
              onChange={(content) => setNoteData({ ...noteData, content })}
              placeholder="Write your note..."
              minHeight="400px"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowNoteModal(false)}>Cancel</Button>
            <Button type="submit">{editingNote ? 'Save' : 'Create Note'}</Button>
          </div>
        </form>
      </Modal>

      {/* Meeting Modal */}
      <Modal isOpen={showMeetingModal} onClose={() => { setShowMeetingModal(false); setShowRecorder(false); setAudioFile(null) }} title="Add Meeting" size="lg">
        <form onSubmit={handleAddMeeting} className="space-y-5">
          <Input label="Title" value={meetingData.title} onChange={(e) => setMeetingData({ ...meetingData, title: e.target.value })} placeholder="Meeting name" required />
          <DatePicker label="Date" value={meetingData.recorded_at} onChange={(date) => setMeetingData({ ...meetingData, recorded_at: date })} placeholder="Select meeting date" />
          <RichTextEditor label="Meeting Notes (optional)" value={meetingData.notes} onChange={(content) => setMeetingData({ ...meetingData, notes: content })} placeholder="Add meeting notes..." minHeight="150px" />
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1.5">Audio (optional)</label>
            {!showRecorder && !audioFile && (
              <div className="flex gap-3">
                <label className="flex-1 cursor-pointer">
                  <input type="file" accept="audio/*" className="hidden" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
                  <div className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors">
                    <Upload size={18} className="text-text-secondary dark:text-gray-400" />
                    <span className="text-sm text-text-secondary dark:text-gray-400">Upload audio file</span>
                  </div>
                </label>
                <button type="button" onClick={() => setShowRecorder(true)}
                  className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                  <Mic size={18} className="text-text-secondary dark:text-gray-400" />
                  <span className="text-sm text-text-secondary dark:text-gray-400">Record audio</span>
                </button>
              </div>
            )}
            {showRecorder && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <AudioRecorder onSave={handleRecordedAudio} onCancel={() => setShowRecorder(false)} />
              </div>
            )}
            {audioFile && !showRecorder && (
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <Mic size={18} className="text-secondary-600 dark:text-secondary-400" />
                  <span className="text-sm text-text-primary dark:text-gray-100 truncate max-w-[200px]">{audioFile.name}</span>
                  <span className="text-xs text-text-secondary dark:text-gray-400">({(audioFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
                <button type="button" onClick={() => setAudioFile(null)} className="text-sm text-red-600 hover:text-red-700 dark:text-red-400">Remove</button>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setShowMeetingModal(false); setShowRecorder(false); setAudioFile(null) }}>Cancel</Button>
            <Button type="submit">Add Meeting</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Meeting Modal */}
      <Modal isOpen={showEditMeetingModal} onClose={() => { setShowEditMeetingModal(false); setEditingMeeting(null) }} title="Edit Meeting Notes" size="lg">
        <form onSubmit={handleSaveMeeting} className="space-y-5">
          <Input label="Title" value={meetingData.title} onChange={(e) => setMeetingData({ ...meetingData, title: e.target.value })} placeholder="Meeting name" required />
          <RichTextEditor label="Meeting Notes" value={meetingData.notes} onChange={(content) => setMeetingData({ ...meetingData, notes: content })} placeholder="Add meeting notes..." minHeight="250px" />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setShowEditMeetingModal(false); setEditingMeeting(null) }}>Cancel</Button>
            <Button type="submit">Save Notes</Button>
          </div>
        </form>
      </Modal>

      {/* AI Summary Modal */}
      <Modal isOpen={showAiSummary} onClose={() => { setShowAiSummary(false); setAiSummary(null); setAiSummaryError(null) }} title="AI Project Summary" size="lg">
        <div className="space-y-4">
          {aiSummaryLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 size={36} className="text-primary-500 animate-spin mb-4" />
              <p className="text-text-secondary dark:text-gray-400">Generating AI summary...</p>
            </div>
          )}
          {aiSummaryError && <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">{aiSummaryError}</div>}
          {aiSummary && (
            <>
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
              <div className="prose prose-sm max-w-none bg-gray-50 dark:bg-gray-900 rounded-lg p-5 border border-gray-200 dark:border-gray-700">
                <div className="whitespace-pre-wrap text-text-primary dark:text-gray-100 text-sm leading-relaxed">{aiSummary.summary}</div>
              </div>
            </>
          )}
          <div className="flex justify-end gap-3 pt-2">
            {aiSummary && <Button variant="secondary" onClick={handleGenerateAiSummary} disabled={aiSummaryLoading}><Sparkles size={16} /> Regenerate</Button>}
            <Button variant="outline" onClick={() => { setShowAiSummary(false); setAiSummary(null); setAiSummaryError(null) }}>Close</Button>
          </div>
        </div>
      </Modal>

      {/* Meeting View Modal — near full screen */}
      <Modal isOpen={!!viewingMeeting} onClose={handleCloseMeetingView} title="" size="full">
        {viewingMeeting && (
          <div className="flex flex-col h-[80vh]">
            {/* Editable title */}
            <div className="flex items-baseline gap-2 mb-1">
              <input
                value={meetingViewTitle}
                onChange={(e) => setMeetingViewTitle(e.target.value)}
                className="text-xl font-display font-semibold text-text-primary dark:text-gray-100 bg-transparent border-none outline-none flex-1 placeholder:text-gray-400"
                placeholder="Meeting title"
              />
              <span className="text-xs italic text-gray-400 dark:text-gray-500 flex-shrink-0">click to edit</span>
            </div>
            {viewingMeeting.recorded_at && (
              <p className="text-xs text-text-secondary dark:text-gray-400 mb-4">
                {new Date(viewingMeeting.recorded_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            )}

            <div className="flex-1 flex gap-4 min-h-0">
              {/* Left side: Audio + Notes */}
              <div className="flex-1 flex flex-col gap-4 min-w-0">
                {/* Audio */}
                <div className="flex-shrink-0">
                  {viewingMeeting.audio_path || meetingAudioUrl ? (
                    <AudioPlayer src={meetingAudioUrl} meetingId={!meetingAudioUrl ? viewingMeeting.id : undefined} />
                  ) : (
                    <div>
                      <label className="cursor-pointer">
                        <input type="file" accept="audio/*" className="hidden" onChange={(e) => setMeetingAudioUploadFile(e.target.files?.[0] || null)} />
                        <div className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors">
                          <Upload size={18} className="text-text-secondary dark:text-gray-400" />
                          <span className="text-sm text-text-secondary dark:text-gray-400">
                            {meetingAudioUploadFile ? meetingAudioUploadFile.name : 'Upload Audio'}
                          </span>
                        </div>
                      </label>
                    </div>
                  )}
                </div>

                {/* Notes editor */}
                <div className="flex-1 min-h-0 flex flex-col">
                  <h4 className="text-sm font-semibold text-text-primary dark:text-gray-100 mb-2">Notes</h4>
                  <div className="flex-1 [&_.ql-container]:!min-h-0 [&_.ql-container]:flex-1 [&_.ql-container]:flex [&_.ql-container]:flex-col [&_.ql-editor]:flex-1">
                    <RichTextEditor
                      value={meetingViewNotes}
                      onChange={setMeetingViewNotes}
                      placeholder="Add meeting notes..."
                      minHeight="100%"
                      className="h-full flex flex-col [&>div]:flex-1 [&>div]:flex [&>div]:flex-col"
                    />
                  </div>
                </div>
              </div>

              {/* Right side: Summary/Transcript tabs */}
              <div className="w-1/2 flex flex-col min-h-0 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex border-b border-gray-200 dark:border-gray-700">
                  <button onClick={() => setMeetingViewTab('summary')}
                    className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${meetingViewTab === 'summary' ? 'text-primary-600 dark:text-primary-300 border-b-2 border-primary-500' : 'text-text-secondary dark:text-gray-400'}`}>
                    Summary
                  </button>
                  <button onClick={() => setMeetingViewTab('transcript')}
                    className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${meetingViewTab === 'transcript' ? 'text-primary-600 dark:text-primary-300 border-b-2 border-primary-500' : 'text-text-secondary dark:text-gray-400'}`}>
                    Transcript
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {meetingViewTab === 'summary' && (
                    viewingMeeting.summary ? (
                      <p className="text-sm text-text-secondary dark:text-gray-400 whitespace-pre-wrap">{viewingMeeting.summary}</p>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <Sparkles size={32} className="text-gray-300 dark:text-gray-600 mb-3" />
                        <p className="text-sm text-text-secondary dark:text-gray-400 mb-3">No summary yet</p>
                        <button className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 px-4 py-2 rounded-lg bg-primary-50 dark:bg-primary-900/20">
                          Generate Summary
                        </button>
                      </div>
                    )
                  )}
                  {meetingViewTab === 'transcript' && (
                    viewingMeeting.transcript ? (
                      <p className="text-sm text-text-secondary dark:text-gray-400 whitespace-pre-wrap">{viewingMeeting.transcript}</p>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <FileText size={32} className="text-gray-300 dark:text-gray-600 mb-3" />
                        <p className="text-sm text-text-secondary dark:text-gray-400 mb-3">No transcript yet</p>
                        <button className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 px-4 py-2 rounded-lg bg-primary-50 dark:bg-primary-900/20">
                          Upload Transcript
                        </button>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Save button */}
            <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
              <Button variant="outline" onClick={handleCloseMeetingView}>Cancel</Button>
              <Button onClick={handleSaveMeetingView}>Save Changes</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* File Preview Modal */}
      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} onDownload={handleDownloadFile}
        onDelete={(fileId) => { deleteFile(fileId); setPreviewFile(null) }} />

      {/* New Folder Modal */}
      <Modal isOpen={showNewFolderModal} onClose={() => setShowNewFolderModal(false)} title="New Folder" size="sm">
        <form onSubmit={handleCreateFolder} className="space-y-4">
          <Input label="Folder Name" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Enter folder name..." required autoFocus />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setShowNewFolderModal(false)}>Cancel</Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Modal>

      {/* Add Member Modal */}
      <Modal isOpen={showAddMemberModal} onClose={() => setShowAddMemberModal(false)} title="Add Members">
        <div className="space-y-4">
          <Input placeholder="Search users by name..." value={addMemberSearch} onChange={(e) => setAddMemberSearch(e.target.value)} />
          <div className="border border-gray-300 dark:border-gray-600 rounded-organic max-h-60 overflow-y-auto">
            {(() => {
              const existingIds = new Set(members.map(m => m.user_id))
              const filtered = allUsers.filter(u => !existingIds.has(u.id) && u.name?.toLowerCase().includes(addMemberSearch.toLowerCase()))
              if (filtered.length === 0) return <p className="text-sm text-text-secondary dark:text-gray-400 px-3 py-4 text-center">No users found</p>
              return filtered.map(u => (
                <label key={u.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                  <input type="checkbox" checked={selectedUserIds.includes(u.id)}
                    onChange={() => setSelectedUserIds(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                    className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-300" />
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-primary-600 dark:text-primary-300">{u.name?.charAt(0)?.toUpperCase() || '?'}</span>
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
          {selectedUserIds.length > 0 && <p className="text-xs text-text-secondary dark:text-gray-400">{selectedUserIds.length} user{selectedUserIds.length !== 1 ? 's' : ''} selected</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowAddMemberModal(false)}>Cancel</Button>
            <Button onClick={handleAddSelectedMembers} disabled={selectedUserIds.length === 0}>
              <UserPlus size={16} /> Add Selected
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
