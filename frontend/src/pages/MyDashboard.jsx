import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'
import { useNotificationStore } from '../store/notificationStore'
import { usePlannerStore } from '../store/plannerStore'
import { actionsApi, usersApi, notificationsApi, personalNotesApi } from '../services/api'
import { toast } from '../store/toastStore'
import { CalendarView } from '../components/calendar/CalendarView'
import Modal from '../components/Modal'
import RichTextEditor from '../components/RichTextEditor'
import Button from '../components/Button'
import DailyPlanCard from '../components/planner/DailyPlanCard'
import PlannerEmptyState from '../components/planner/PlannerEmptyState'
import CheckinModal from '../components/planner/CheckinModal'
import WeeklyReviewCard from '../components/planner/WeeklyReviewCard'
import {
  CheckCircle2, Circle, Calendar, ArrowUpRight,
  FolderKanban, Zap, Target, Award, ChevronDown, ChevronRight, Filter, X, Pencil,
  StickyNote, Plus, Trash2
} from 'lucide-react'
import { format, isToday, isPast, parseISO } from 'date-fns'

export default function MyDashboard() {
  const { user } = useAuthStore()
  const { projects, fetchProjects, isLoading } = useProjectStore()
  const { markRead } = useNotificationStore()
  const {
    plan, steps: planSteps, checkin, weeklyReview, showCheckin, isGenerating,
    fetchToday, generatePlan, toggleStep, respondToCheckin, dismissCheckin,
    fetchWeeklyReview, generateWeeklyReview,
  } = usePlannerStore()
  const [myTasks, setMyTasks] = useState([])
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [streak, setStreak] = useState(0)
  const [expandedTaskId, setExpandedTaskId] = useState(null)
  const [highlightedTaskIds, setHighlightedTaskIds] = useState(new Map()) // taskId -> notificationId
  const [taskNotifications, setTaskNotifications] = useState([]) // raw unread task_assigned notifications
  const [taskFilters, setTaskFilters] = useState({ project_id: '', priority: '', status: '', due_before: '', due_after: '' })
  const [showFilters, setShowFilters] = useState(false)
  const [tasksExpanded, setTasksExpanded] = useState(false)
  const [collapsedProjects, setCollapsedProjects] = useState(new Set())
  const [projectsExpanded, setProjectsExpanded] = useState(false)
  const [editingDescription, setEditingDescription] = useState({})
  const [plannerTab, setPlannerTab] = useState('daily')
  const [plannerExpanded, setPlannerExpanded] = useState(false)
  const [personalNotes, setPersonalNotes] = useState([])
  const [loadingNotes, setLoadingNotes] = useState(true)
  const [notesExpanded, setNotesExpanded] = useState(false)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [editingNote, setEditingNote] = useState(null)
  const [noteData, setNoteData] = useState({ title: '', content: '' })

  const loadMyTasks = useCallback(async () => {
    setLoadingTasks(true)
    try {
      // Build clean filters object (omit empty strings)
      const params = {}
      if (taskFilters.project_id) params.project_id = taskFilters.project_id
      if (taskFilters.priority) params.priority = taskFilters.priority
      if (taskFilters.status) params.status = taskFilters.status
      if (taskFilters.due_before) params.due_before = taskFilters.due_before
      if (taskFilters.due_after) params.due_after = taskFilters.due_after
      const { data } = await actionsApi.my(Object.keys(params).length > 0 ? params : undefined)
      setMyTasks(data.actions || [])
    } catch {
      toast.error('Failed to load tasks')
    }
    setLoadingTasks(false)
  }, [taskFilters])

  const loadPersonalNotes = useCallback(async () => {
    try {
      const { data } = await personalNotesApi.list()
      setPersonalNotes(data.notes)
    } catch { /* silent */ }
    finally { setLoadingNotes(false) }
  }, [])

  useEffect(() => {
    document.title = 'My Dashboard - Stats Lab'
  }, [])

  useEffect(() => {
    fetchProjects()
    loadMyTasks()
    loadPersonalNotes()
    fetchToday()
    fetchWeeklyReview()
    // Load streak
    usersApi.getStreak().then(({ data }) => {
      setStreak(data.streak || 0)
    }).catch(() => setStreak(0))
    // Fetch unread task_assigned notifications to highlight new tasks
    notificationsApi.list({ limit: 50, unread_only: true }).then(({ data }) => {
      const taskNotifs = (data.notifications || []).filter(n => n.reference_type === 'task_assigned' && !n.read_at)
      setTaskNotifications(taskNotifs)
    }).catch(() => { /* notifications non-critical */ })
  }, [fetchProjects, loadMyTasks, loadPersonalNotes, fetchToday, fetchWeeklyReview])

  // Build highlighted task map when both tasks and notifications are loaded
  useEffect(() => {
    if (taskNotifications.length === 0 || myTasks.length === 0) return
    const map = new Map()
    for (const n of taskNotifications) {
      // New format: reference_id is the action item ID
      const directMatch = myTasks.find(t => t.id === n.reference_id)
      if (directMatch) {
        map.set(directMatch.id, n.id)
        continue
      }
      // Old format: reference_id is the project ID, match by task title from notification
      const taskTitle = n.title?.replace(/^New task:\s*/, '')
      if (taskTitle) {
        const titleMatch = myTasks.find(t => t.title === taskTitle && t.project_id === n.reference_id)
        if (titleMatch && !map.has(titleMatch.id)) {
          map.set(titleMatch.id, n.id)
        }
      }
    }
    if (map.size > 0) setHighlightedTaskIds(map)
  }, [taskNotifications, myTasks])

  const myProjects = projects.filter(
    (p) => p.membership_status === 'member'
  ).slice(0, 6)

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  const handleToggleTask = async (taskId, currentCompleted) => {
    // Optimistic update
    setMyTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, completed: !currentCompleted } : t
    ))
    try {
      await actionsApi.update(taskId, { completed: !currentCompleted })
    } catch (error) {
      // Revert on failure
      setMyTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, completed: currentCompleted } : t
      ))
      toast.error('Failed to update task')
    }
  }

  const handleTaskHover = useCallback((taskId) => {
    const notificationId = highlightedTaskIds.get(taskId)
    if (!notificationId) return
    markRead(notificationId)
    setTimeout(() => {
      setHighlightedTaskIds(prev => {
        const next = new Map(prev)
        next.delete(taskId)
        return next
      })
    }, 300)
  }, [highlightedTaskIds, markRead])

  const handleOpenNewNote = () => {
    setEditingNote(null)
    setNoteData({ title: '', content: '' })
    setShowNoteModal(true)
  }

  const handleOpenEditNote = (note) => {
    setEditingNote(note)
    setNoteData({ title: note.title, content: note.content || '' })
    setShowNoteModal(true)
  }

  const handleSaveNote = async () => {
    if (!noteData.title.trim()) return
    try {
      if (editingNote) {
        await personalNotesApi.update(editingNote.id, noteData)
      } else {
        await personalNotesApi.create(noteData)
      }
      loadPersonalNotes()
      setShowNoteModal(false)
    } catch {
      toast.error('Failed to save note')
    }
  }

  const handleDeleteNote = async (e, id) => {
    e.stopPropagation()
    try {
      await personalNotesApi.delete(id)
      setPersonalNotes(prev => prev.filter(n => n.id !== id))
    } catch {
      toast.error('Failed to delete note')
    }
  }

  const completedCount = myTasks.filter(t => t.completed).length
  const pendingTasks = myTasks.filter(t => !t.completed).length

  // Compute filtered task list for rendering
  const filteredTasks = taskFilters.status ? myTasks : myTasks.filter(t => !t.completed)

  // Group filtered tasks by project
  const tasksByProject = useMemo(() => {
    const groups = {}
    for (const task of filteredTasks) {
      const pid = task.project_id || 'unassigned'
      if (!groups[pid]) {
        groups[pid] = { title: task.project_title || 'Unassigned', tasks: [] }
      }
      groups[pid].tasks.push(task)
    }
    return groups
  }, [filteredTasks])

  return (
    <div className="space-y-6">
      {/* Row 1: Compact Personal Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-400 to-secondary-400 flex items-center justify-center text-white text-lg font-bold shadow-sm">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div>
            <h1 className="font-display font-bold text-2xl md:text-3xl text-text-primary dark:text-gray-100">
              {getGreeting()}, {user?.name?.split(' ')[0]}
            </h1>
            <p className="text-text-secondary dark:text-gray-400 text-sm">
              Here&apos;s your personal research overview
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <CheckCircle2 size={16} className="text-green-600 dark:text-green-300" />
            <div>
              <p className="text-lg font-display font-bold text-text-primary dark:text-gray-100 leading-none">{completedCount}</p>
              <p className="text-[11px] text-text-secondary dark:text-gray-400">Completed</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <Target size={16} className="text-amber-600 dark:text-amber-300" />
            <div>
              <p className="text-lg font-display font-bold text-text-primary dark:text-gray-100 leading-none">{pendingTasks}</p>
              <p className="text-[11px] text-text-secondary dark:text-gray-400">Remaining</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <Award size={16} className="text-primary-600 dark:text-primary-300" />
            <div>
              <p className="text-lg font-display font-bold text-text-primary dark:text-gray-100 leading-none">{myProjects.length}</p>
              <p className="text-[11px] text-text-secondary dark:text-gray-400">Projects</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <Zap size={14} className="text-amber-400" />
            <span className="text-sm font-medium text-text-primary dark:text-gray-100">{streak} day streak</span>
          </div>
        </div>
      </div>

      {/* Check-in Modal */}
      {showCheckin && checkin && (
        <CheckinModal
          checkin={checkin}
          onSubmit={respondToCheckin}
          onDismiss={dismissCheckin}
        />
      )}

      {/* Main grid: Calendar + AI Planner (left) | Tasks & Projects (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          {/* Collapsible AI Planner */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => setPlannerExpanded(!plannerExpanded)}
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <h2 className="font-display font-bold text-lg text-text-primary dark:text-gray-100">AI Planner</h2>
              {plannerExpanded ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
            </button>
            {plannerExpanded && (
              <>
                {/* Tab bar */}
                <div className="flex border-t border-b border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setPlannerTab('daily')}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      plannerTab === 'daily'
                        ? 'text-primary-700 dark:text-primary-300 border-b-2 border-primary-500'
                        : 'text-text-secondary dark:text-gray-400 hover:text-text-primary dark:hover:text-gray-200'
                    }`}
                  >
                    Daily
                  </button>
                  <button
                    onClick={() => setPlannerTab('weekly')}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      plannerTab === 'weekly'
                        ? 'text-primary-700 dark:text-primary-300 border-b-2 border-primary-500'
                        : 'text-text-secondary dark:text-gray-400 hover:text-text-primary dark:hover:text-gray-200'
                    }`}
                  >
                    Weekly
                  </button>
                </div>

                {/* Tab content — scrollable */}
                <div className="overflow-y-auto" style={{ maxHeight: '600px' }}>
                  {plannerTab === 'daily' ? (
                    plan ? (
                      <DailyPlanCard
                        plan={plan}
                        steps={planSteps}
                        onToggleStep={toggleStep}
                        onRegenerate={() => generatePlan(true)}
                        isGenerating={isGenerating}
                        embedded
                      />
                    ) : (
                      <PlannerEmptyState
                        onGenerate={() => generatePlan(false)}
                        isGenerating={isGenerating}
                      />
                    )
                  ) : (
                    weeklyReview ? (
                      <WeeklyReviewCard
                        review={weeklyReview}
                        onGenerate={generateWeeklyReview}
                        isGenerating={isGenerating && !plan}
                        embedded
                      />
                    ) : (
                      <PlannerEmptyState
                        onGenerate={generateWeeklyReview}
                        isGenerating={isGenerating && !plan}
                        title="AI Weekly Review"
                        description="Get an AI-generated summary of your week including accomplishments, missed items, and insights for next week."
                        buttonLabel="Generate My Weekly Review"
                      />
                    )
                  )}
                </div>
              </>
            )}
          </div>

          {/* Calendar */}
          <CalendarView scope="dashboard" compact />
        </div>
        <div className="space-y-6">
          {/* Collapsible My Tasks */}
          <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => setTasksExpanded(!tasksExpanded)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <h2 className="font-display font-bold text-lg text-text-primary dark:text-gray-100">My Tasks</h2>
              <div className="flex items-center gap-2">
                {pendingTasks > 0 && <span className="text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full">{pendingTasks}</span>}
                {tasksExpanded ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
              </div>
            </button>
            {tasksExpanded && (
              <div className="border-t border-gray-100 dark:border-gray-700">
                {/* Filter button — inside expanded content */}
                <div className="px-4 py-2">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                      showFilters || Object.values(taskFilters).some(v => v)
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-text-secondary dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <Filter size={12} />
                    Filters
                    {Object.values(taskFilters).some(v => v) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                    )}
                  </button>
                </div>

                {/* Filter panel */}
                {showFilters && (
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-text-primary dark:text-gray-100">Filter Tasks</span>
                      {Object.values(taskFilters).some(v => v) && (
                        <button
                          onClick={() => setTaskFilters({ project_id: '', priority: '', status: '', due_before: '', due_after: '' })}
                          className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
                        >
                          <X size={10} />
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-text-secondary dark:text-gray-400 mb-1">Project</label>
                        <select
                          value={taskFilters.project_id}
                          onChange={(e) => setTaskFilters({ ...taskFilters, project_id: e.target.value })}
                          className="w-full px-2 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-300"
                        >
                          <option value="">All</option>
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>{p.title}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-secondary dark:text-gray-400 mb-1">Priority</label>
                        <select
                          value={taskFilters.priority}
                          onChange={(e) => setTaskFilters({ ...taskFilters, priority: e.target.value })}
                          className="w-full px-2 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-300"
                        >
                          <option value="">Any</option>
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="urgent">Urgent</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-secondary dark:text-gray-400 mb-1">Status</label>
                        <select
                          value={taskFilters.status}
                          onChange={(e) => setTaskFilters({ ...taskFilters, status: e.target.value })}
                          className="w-full px-2 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-300"
                        >
                          <option value="">All</option>
                          <option value="pending">Pending</option>
                          <option value="completed">Completed</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-secondary dark:text-gray-400 mb-1">Due after</label>
                        <input
                          type="date"
                          value={taskFilters.due_after}
                          onChange={(e) => setTaskFilters({ ...taskFilters, due_after: e.target.value })}
                          className="w-full px-2 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-300"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-text-secondary dark:text-gray-400 mb-1">Due before</label>
                        <input
                          type="date"
                          value={taskFilters.due_before}
                          onChange={(e) => setTaskFilters({ ...taskFilters, due_before: e.target.value })}
                          className="w-full px-2 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-300"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Task list — no scroll lock, expands to fit */}
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {loadingTasks ? (
                    <div className="p-6 text-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500 mx-auto"></div>
                      <p className="text-text-secondary dark:text-gray-400 mt-2 text-sm">Loading tasks...</p>
                    </div>
                  ) : filteredTasks.length > 0 ? (
                    Object.entries(tasksByProject).map(([projectId, group]) => {
                      const isProjectCollapsed = collapsedProjects.has(projectId)
                      return (
                        <div key={projectId} className="divide-y divide-gray-100 dark:divide-gray-700">
                          <button
                            onClick={() => setCollapsedProjects(prev => {
                              const next = new Set(prev)
                              if (next.has(projectId)) next.delete(projectId)
                              else next.add(projectId)
                              return next
                            })}
                            className="w-full flex items-center gap-2 px-3 py-2.5 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors border-l-2 border-l-primary-400 dark:border-l-primary-500"
                          >
                            {isProjectCollapsed ? <ChevronRight size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                            <FolderKanban size={14} className="text-primary-500" />
                            <span className="text-xs font-semibold text-text-primary dark:text-gray-200 truncate">{group.title}</span>
                            <span className="text-[10px] font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-1.5 py-0.5 rounded-full ml-auto flex-shrink-0">
                              {group.tasks.length}
                            </span>
                          </button>
                          {!isProjectCollapsed && group.tasks.map((task) => {
                      const isNew = highlightedTaskIds.has(task.id)
                      const isExpanded = expandedTaskId === task.id
                      const isOverdue = task.due_date && !task.completed && isPast(parseISO(task.due_date))
                      return (
                        <div key={task.id}>
                          <div
                            className={`flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer ${
                              isNew ? 'bg-primary-50 dark:bg-primary-900/20 border-l-4 border-l-primary-500'
                              : isOverdue ? 'bg-red-50/30 dark:bg-red-900/10 border-l-4 border-l-red-500'
                              : ''
                            }`}
                            onMouseEnter={isNew ? () => handleTaskHover(task.id) : undefined}
                            onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                          >
                            <div className="flex-shrink-0 text-gray-400 dark:text-gray-500">
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleToggleTask(task.id, task.completed) }}
                              className="flex-shrink-0"
                            >
                              {task.completed ? (
                                <CheckCircle2 size={18} className="text-green-500" />
                              ) : (
                                <Circle size={18} className="text-gray-300 dark:text-gray-600 hover:text-primary-400" />
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className={`text-sm font-medium truncate ${task.completed ? 'line-through text-text-secondary dark:text-gray-400' : 'text-text-primary dark:text-gray-100'}`}>{task.title}</p>
                                {task.priority && (
                                  <span className={`text-[10px] font-medium px-1 py-0.5 rounded flex-shrink-0 ${
                                    task.priority === 'urgent' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                                    task.priority === 'high' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' :
                                    task.priority === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                                    'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                  }`}>
                                    {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                                  </span>
                                )}
                                {isNew && (
                                  <span className="text-[10px] font-medium text-primary-600 dark:text-primary-400 bg-primary-100 dark:bg-primary-900/30 px-1.5 py-0.5 rounded-full flex-shrink-0">
                                    New
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <p className="text-xs text-text-secondary dark:text-gray-400 truncate">{task.project_title}</p>
                                {task.due_date && (
                                  <span className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                                    isPast(parseISO(task.due_date))
                                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                      : isToday(parseISO(task.due_date))
                                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                  }`}>
                                    <Calendar size={10} />
                                    {format(parseISO(task.due_date), 'MMM d')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700">
                              <div className="space-y-2">
                                <p className="text-xs font-medium text-text-secondary dark:text-gray-400 uppercase tracking-wider">Description</p>
                                {editingDescription[task.id] !== undefined ? (
                                  <>
                                    <textarea
                                      value={editingDescription[task.id]}
                                      onChange={(e) => setEditingDescription(prev => ({ ...prev, [task.id]: e.target.value }))}
                                      placeholder="Add a description..."
                                      rows={3}
                                      className="w-full text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-300 resize-none"
                                    />
                                    <div className="flex gap-2 justify-end">
                                      <button
                                        onClick={() => setEditingDescription(prev => { const next = {...prev}; delete next[task.id]; return next; })}
                                        className="px-3 py-1 text-xs text-text-secondary dark:text-gray-400 hover:text-text-primary dark:hover:text-gray-200"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        onClick={async () => {
                                          try {
                                            await actionsApi.update(task.id, { description: editingDescription[task.id] });
                                            setMyTasks(prev => prev.map(t => t.id === task.id ? { ...t, description: editingDescription[task.id] } : t));
                                            setEditingDescription(prev => { const next = {...prev}; delete next[task.id]; return next; });
                                            toast.success('Description updated');
                                          } catch { toast.error('Failed to update description'); }
                                        }}
                                        className="px-3 py-1 text-xs bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                                      >
                                        Save
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <div>
                                    {task.description ? (
                                      <p className="text-sm text-text-primary dark:text-gray-200 whitespace-pre-wrap">{task.description}</p>
                                    ) : (
                                      <p className="text-sm italic text-text-secondary dark:text-gray-500">No description</p>
                                    )}
                                    <div className="flex justify-end mt-1">
                                      <button
                                        onClick={() => setEditingDescription(prev => ({ ...prev, [task.id]: task.description || '' }))}
                                        className="inline-flex items-center gap-1 text-xs text-text-secondary dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                                      >
                                        <Pencil size={12} />
                                        Edit
                                      </button>
                                    </div>
                                  </div>
                                )}
                                {task.due_date && (
                                  <p className="text-xs text-text-secondary dark:text-gray-400">
                                    Due: {format(parseISO(task.due_date), 'MMMM d, yyyy')}
                                  </p>
                                )}
                                <p className="text-xs text-text-secondary dark:text-gray-400">
                                  Project: <span className="font-medium">{task.project_title}</span>
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                        </div>
                      )
                    })
                  ) : (
                    <div className="p-6 text-center">
                      <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-gradient-to-br from-green-100 dark:from-green-900/30 to-secondary-100 dark:to-secondary-900/30 flex items-center justify-center">
                        <CheckCircle2 size={18} className="text-green-500" />
                      </div>
                      <h3 className="font-display font-semibold text-sm text-text-primary dark:text-gray-100 mb-1">
                        All caught up!
                      </h3>
                      <p className="text-text-secondary dark:text-gray-400 text-xs">
                        No pending tasks.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Collapsible My Projects */}
          <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => setProjectsExpanded(!projectsExpanded)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <h2 className="font-display font-bold text-lg text-text-primary dark:text-gray-100">My Projects</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full">{myProjects.length}</span>
                {projectsExpanded ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
              </div>
            </button>
            {projectsExpanded && (
              <div className="border-t border-gray-100 dark:border-gray-700">
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {isLoading ? (
                    <div className="p-6 text-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500 mx-auto"></div>
                      <p className="text-text-secondary dark:text-gray-400 mt-2 text-sm">Loading projects...</p>
                    </div>
                  ) : myProjects.length > 0 ? (
                    myProjects.map(project => (
                      <Link
                        key={project.id}
                        to={`/dashboard/projects/${project.id}`}
                        className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <FolderKanban size={16} className="text-primary-500 flex-shrink-0" />
                        <span className="text-sm font-medium text-text-primary dark:text-gray-100 truncate">{project.title}</span>
                        <ArrowUpRight size={14} className="text-gray-400 ml-auto flex-shrink-0" />
                      </Link>
                    ))
                  ) : (
                    <div className="p-6 text-center text-sm text-text-secondary dark:text-gray-400">No projects yet</div>
                  )}
                </div>
                <Link
                  to="/dashboard/projects"
                  className="flex items-center justify-center gap-1 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 text-sm font-medium py-3 border-t border-gray-100 dark:border-gray-700"
                >
                  View all projects
                  <ArrowUpRight size={14} />
                </Link>
              </div>
            )}
          </section>

          {/* Collapsible My Notes */}
          <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="w-full flex items-center justify-between p-4">
              <button
                onClick={() => setNotesExpanded(!notesExpanded)}
                className="flex items-center gap-2 flex-1 hover:opacity-80 transition-opacity"
              >
                <h2 className="font-display font-bold text-lg text-text-primary dark:text-gray-100">My Notes</h2>
                <div className="flex items-center gap-2">
                  {personalNotes.length > 0 && <span className="text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full">{personalNotes.length}</span>}
                  {notesExpanded ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
                </div>
              </button>
              <button
                onClick={handleOpenNewNote}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-primary-500 transition-colors"
                title="New note"
              >
                <Plus size={16} />
              </button>
            </div>
            {notesExpanded && (
              <div className="border-t border-gray-100 dark:border-gray-700">
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {loadingNotes ? (
                    <div className="p-6 text-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500 mx-auto"></div>
                      <p className="text-text-secondary dark:text-gray-400 mt-2 text-sm">Loading notes...</p>
                    </div>
                  ) : personalNotes.length > 0 ? (
                    personalNotes.map(note => (
                      <div
                        key={note.id}
                        onClick={() => handleOpenEditNote(note)}
                        className="group flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                      >
                        <StickyNote size={16} className="text-amber-500 flex-shrink-0" />
                        <span className="text-sm font-medium text-text-primary dark:text-gray-100 truncate flex-1">{note.title}</span>
                        <span className="text-xs text-text-secondary dark:text-gray-400 flex-shrink-0">
                          {format(parseISO(note.updated_at), 'MMM d')}
                        </span>
                        <button
                          onClick={(e) => handleDeleteNote(e, note.id)}
                          className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-all flex-shrink-0"
                          title="Delete note"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center">
                      <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-gradient-to-br from-amber-100 dark:from-amber-900/30 to-orange-100 dark:to-orange-900/30 flex items-center justify-center">
                        <StickyNote size={18} className="text-amber-500" />
                      </div>
                      <h3 className="font-display font-semibold text-sm text-text-primary dark:text-gray-100 mb-1">
                        No notes yet
                      </h3>
                      <p className="text-text-secondary dark:text-gray-400 text-xs">
                        Click + to create a personal note.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Personal Note Modal */}
      <Modal
        isOpen={showNoteModal}
        onClose={() => setShowNoteModal(false)}
        title={editingNote ? 'Edit Note' : 'New Note'}
        size="full"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-gray-200 mb-1">Title</label>
            <input
              type="text"
              value={noteData.title}
              onChange={(e) => setNoteData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Note title..."
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300"
              autoFocus
            />
          </div>
          <div>
            <RichTextEditor
              label="Content"
              value={noteData.content}
              onChange={(val) => setNoteData(prev => ({ ...prev, content: val }))}
              placeholder="Write your note..."
              minHeight="400px"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowNoteModal(false)}>Cancel</Button>
            <Button onClick={handleSaveNote} disabled={!noteData.title.trim()}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
