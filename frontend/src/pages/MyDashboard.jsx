import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'
import { useNotificationStore } from '../store/notificationStore'
import { usePlannerStore } from '../store/plannerStore'
import { actionsApi, usersApi, notificationsApi } from '../services/api'
import { toast } from '../store/toastStore'
import { CalendarView } from '../components/calendar/CalendarView'
import DailyPlanCard from '../components/planner/DailyPlanCard'
import PlannerEmptyState from '../components/planner/PlannerEmptyState'
import CheckinModal from '../components/planner/CheckinModal'
import WeeklyReviewCard from '../components/planner/WeeklyReviewCard'
import {
  CheckCircle2, Circle, Calendar, ArrowUpRight,
  FolderKanban, Zap, Target, Award, ChevronDown, ChevronRight, Filter, X
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

  useEffect(() => {
    document.title = 'My Dashboard - Stats Lab'
  }, [])

  useEffect(() => {
    fetchProjects()
    loadMyTasks()
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
  }, [fetchProjects, loadMyTasks, fetchToday, fetchWeeklyReview])

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

  // Filter projects where user is creator or has assigned tasks
  const myProjects = projects.filter(
    (p) => p.created_by === user?.id || p.status === 'active'
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

  const completedCount = myTasks.filter(t => t.completed).length
  const pendingTasks = myTasks.filter(t => !t.completed).length

  return (
    <div className="space-y-8">
      {/* Personal Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-primary-900 p-8 md:p-10">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0" style={{backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.1) 1px, transparent 0)', backgroundSize: '24px 24px'}}></div>
        </div>
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-400 to-secondary-400 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div>
              <h1 className="font-display font-bold text-2xl md:text-3xl text-white mb-1">
                {getGreeting()}, {user?.name?.split(' ')[0]}
              </h1>
              <p className="text-slate-400">
                Here&apos;s your personal research overview
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <WeeklyReviewCard
              review={weeklyReview}
              onGenerate={generateWeeklyReview}
              isGenerating={isGenerating && !plan}
            />
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 backdrop-blur-sm">
              <Zap size={18} className="text-amber-400" />
              <span className="text-white font-medium">{streak} day streak</span>
            </div>
          </div>
        </div>
      </div>

      {/* Personal Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 size={24} className="text-green-600 dark:text-green-300" />
            </div>
            <span className="text-xs font-medium text-green-600 dark:text-green-300 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-full">
              Done
            </span>
          </div>
          <p className="text-4xl font-display font-bold text-text-primary dark:text-gray-100">{completedCount}</p>
          <p className="text-text-secondary dark:text-gray-400 mt-1">Tasks Completed</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Target size={24} className="text-amber-600 dark:text-amber-300" />
            </div>
            <span className="text-xs font-medium text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded-full">
              Pending
            </span>
          </div>
          <p className="text-4xl font-display font-bold text-text-primary dark:text-gray-100">{pendingTasks}</p>
          <p className="text-text-secondary dark:text-gray-400 mt-1">Tasks Remaining</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <Award size={24} className="text-primary-600 dark:text-primary-300" />
            </div>
            <span className="text-xs font-medium text-primary-600 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30 px-2 py-1 rounded-full">
              This Week
            </span>
          </div>
          <p className="text-4xl font-display font-bold text-text-primary dark:text-gray-100">{myProjects.length}</p>
          <p className="text-text-secondary dark:text-gray-400 mt-1">Active Projects</p>
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

      {/* AI Daily Plan */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-xl text-text-primary dark:text-gray-100">AI Daily Plan</h2>
        </div>
        {plan ? (
          <DailyPlanCard
            plan={plan}
            steps={planSteps}
            onToggleStep={toggleStep}
            onRegenerate={() => generatePlan(true)}
            isGenerating={isGenerating}
          />
        ) : (
          <PlannerEmptyState
            onGenerate={() => generatePlan(false)}
            isGenerating={isGenerating}
          />
        )}
      </section>

      {/* Weekly Review (expanded view when exists) */}
      {weeklyReview && (
        <WeeklyReviewCard
          review={weeklyReview}
          onGenerate={generateWeeklyReview}
          isGenerating={isGenerating && !plan}
        />
      )}

      {/* My Tasks */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-xl text-text-primary dark:text-gray-100">My Tasks</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                showFilters || Object.values(taskFilters).some(v => v)
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-text-secondary dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Filter size={14} />
              Filters
              {Object.values(taskFilters).some(v => v) && (
                <span className="w-2 h-2 rounded-full bg-primary-500" />
              )}
            </button>
            <Link
              to="/dashboard/projects"
              className="inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 text-sm font-medium"
            >
              View all projects
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>

        {/* Filter row */}
        {showFilters && (
          <div className="mb-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-text-primary dark:text-gray-100">Filter Tasks</span>
              {Object.values(taskFilters).some(v => v) && (
                <button
                  onClick={() => setTaskFilters({ project_id: '', priority: '', status: '', due_before: '', due_after: '' })}
                  className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
                >
                  <X size={12} />
                  Clear filters
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary dark:text-gray-400 mb-1">Project</label>
                <select
                  value={taskFilters.project_id}
                  onChange={(e) => setTaskFilters({ ...taskFilters, project_id: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-300"
                >
                  <option value="">All projects</option>
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
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-300"
                >
                  <option value="">Any priority</option>
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
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-300"
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
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary dark:text-gray-400 mb-1">Due before</label>
                <input
                  type="date"
                  value={taskFilters.due_before}
                  onChange={(e) => setTaskFilters({ ...taskFilters, due_before: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-300"
                />
              </div>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
          {loadingTasks ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
              <p className="text-text-secondary dark:text-gray-400 mt-3">Loading your tasks...</p>
            </div>
          ) : (() => {
            // When server-side status filter is active, show all results; otherwise default to pending only
            return taskFilters.status ? myTasks : myTasks.filter(t => !t.completed)
          })().length > 0 ? (
            (taskFilters.status ? myTasks : myTasks.filter(t => !t.completed)).map((task) => {
              const isNew = highlightedTaskIds.has(task.id)
              const isExpanded = expandedTaskId === task.id
              const isOverdue = task.due_date && !task.completed && isPast(parseISO(task.due_date))
              return (
              <div key={task.id}>
                <div
                  className={`flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer ${
                    isNew ? 'bg-primary-50 dark:bg-primary-900/20 border-l-4 border-l-primary-500'
                    : isOverdue ? 'bg-red-50/30 dark:bg-red-900/10 border-l-4 border-l-red-500'
                    : ''
                  }`}
                  onMouseEnter={isNew ? () => handleTaskHover(task.id) : undefined}
                  onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                >
                  <div className="flex-shrink-0 text-gray-400 dark:text-gray-500">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggleTask(task.id, task.completed) }}
                    className="flex-shrink-0"
                  >
                    {task.completed ? (
                      <CheckCircle2 size={22} className="text-green-500" />
                    ) : (
                      <Circle size={22} className="text-gray-300 dark:text-gray-600 hover:text-primary-400" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-medium truncate ${task.completed ? 'line-through text-text-secondary dark:text-gray-400' : 'text-text-primary dark:text-gray-100'}`}>{task.title}</p>
                      {task.priority && (
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${
                          task.priority === 'urgent' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                          task.priority === 'high' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' :
                          task.priority === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                          'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}>
                          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                        </span>
                      )}
                      {isNew && (
                        <span className="text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-100 dark:bg-primary-900/30 px-2 py-0.5 rounded-full flex-shrink-0">
                          New
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-text-secondary dark:text-gray-400">{task.project_title}</p>
                  </div>
                  {task.due_date && (
                    <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                      isPast(parseISO(task.due_date))
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                        : isToday(parseISO(task.due_date))
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}>
                      <Calendar size={12} />
                      {format(parseISO(task.due_date), 'MMM d')}
                    </span>
                  )}
                  <Link
                    to={`/dashboard/projects/${task.project_id}`}
                    className="flex-shrink-0 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View Project
                  </Link>
                </div>
                {isExpanded && (
                  <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700">
                    <div className="space-y-2">
                      <p className="font-medium text-text-primary dark:text-gray-100">{task.title}</p>
                      <p className="text-sm text-text-secondary dark:text-gray-400">
                        Project: <span className="font-medium">{task.project_title}</span>
                      </p>
                      {task.description && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-text-secondary dark:text-gray-400 uppercase tracking-wider mb-1">Description</p>
                          <p className="text-sm text-text-primary dark:text-gray-200 whitespace-pre-wrap">{task.description}</p>
                        </div>
                      )}
                      {task.due_date && (
                        <p className="text-sm text-text-secondary dark:text-gray-400">
                          Due: {format(parseISO(task.due_date), 'MMMM d, yyyy')}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              )
            })
          ) : (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-green-100 dark:from-green-900/30 to-secondary-100 dark:to-secondary-900/30 flex items-center justify-center">
                <CheckCircle2 size={28} className="text-green-500" />
              </div>
              <h3 className="font-display font-semibold text-lg text-text-primary dark:text-gray-100 mb-2">
                All caught up!
              </h3>
              <p className="text-text-secondary dark:text-gray-400 max-w-sm mx-auto">
                You&apos;re all caught up! No pending tasks.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* My Calendar */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-xl text-text-primary dark:text-gray-100">My Calendar</h2>
        </div>
        <CalendarView scope="dashboard" compact />
      </section>

      {/* My Projects */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-xl text-text-primary dark:text-gray-100">My Projects</h2>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse">
                <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-3/4 mb-3" />
                <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-1/2 mb-4" />
                <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded w-full" />
              </div>
            ))}
          </div>
        ) : myProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myProjects.map((project) => (
              <Link
                key={project.id}
                to={`/dashboard/projects/${project.id}`}
                className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-lg hover:shadow-primary-100/50 transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center group-hover:bg-primary-200 dark:group-hover:bg-primary-900/50 transition-colors">
                    <FolderKanban size={18} className="text-primary-600 dark:text-primary-300" />
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    project.status === 'active'
                      ? 'bg-secondary-100 dark:bg-secondary-900/30 text-secondary-700 dark:text-secondary-300'
                      : project.status === 'completed'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    {project.status}
                  </span>
                </div>
                <h3 className="font-medium text-text-primary dark:text-gray-100 group-hover:text-primary-700 dark:group-hover:text-primary-300 line-clamp-1 mb-2">
                  {project.title}
                </h3>
                {(() => {
                  const total = parseInt(project.total_actions) || 0
                  const completed = parseInt(project.completed_actions) || 0
                  const progress = total === 0 ? 0 : Math.round((completed / total) * 100)
                  return (
                    <>
                      <div className="flex items-center justify-between text-sm text-text-secondary dark:text-gray-400">
                        <span>{completed}/{total} tasks</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="mt-2 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary-400 to-primary-500 rounded-full transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </>
                  )
                })()}
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <FolderKanban size={28} className="text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="font-display font-semibold text-lg text-text-primary dark:text-gray-100 mb-2">
              No projects yet
            </h3>
            <p className="text-text-secondary dark:text-gray-400 max-w-sm mx-auto">
              You haven&apos;t been assigned to any projects yet.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
