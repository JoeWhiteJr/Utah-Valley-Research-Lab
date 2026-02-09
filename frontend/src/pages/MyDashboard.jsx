import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'
import { actionsApi, usersApi } from '../services/api'
import { CalendarView } from '../components/calendar/CalendarView'
import {
  CheckCircle2, Circle, Calendar, ArrowUpRight,
  FolderKanban, Zap, Target, Award
} from 'lucide-react'
import { format, isToday, isPast, parseISO } from 'date-fns'

export default function MyDashboard() {
  const { user } = useAuthStore()
  const { projects, fetchProjects, isLoading } = useProjectStore()
  const [myTasks, setMyTasks] = useState([])
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [streak, setStreak] = useState(0)

  const loadMyTasks = useCallback(async () => {
    setLoadingTasks(true)
    try {
      const { data } = await actionsApi.my()
      setMyTasks(data.actions || [])
    } catch {
      /* error handled silently */
    }
    setLoadingTasks(false)
  }, [])

  useEffect(() => {
    document.title = 'My Dashboard - Stats Lab'
  }, [])

  useEffect(() => {
    fetchProjects()
    loadMyTasks()
    // Load streak
    usersApi.getStreak().then(({ data }) => {
      setStreak(data.streak || 0)
    }).catch(() => setStreak(0))
  }, [fetchProjects, loadMyTasks])

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
      /* error handled silently */
    }
  }

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

      {/* My Tasks */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-xl text-text-primary dark:text-gray-100">My Tasks</h2>
          <Link
            to="/dashboard/projects"
            className="inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 text-sm font-medium"
          >
            View all projects
            <ArrowUpRight size={16} />
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
          {loadingTasks ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
              <p className="text-text-secondary dark:text-gray-400 mt-3">Loading your tasks...</p>
            </div>
          ) : myTasks.filter(t => !t.completed).length > 0 ? (
            myTasks.filter(t => !t.completed).map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <button
                  onClick={() => handleToggleTask(task.id, task.completed)}
                  className="flex-shrink-0"
                >
                  {task.completed ? (
                    <CheckCircle2 size={22} className="text-green-500" />
                  ) : (
                    <Circle size={22} className="text-gray-300 dark:text-gray-600 hover:text-primary-400" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate ${task.completed ? 'line-through text-text-secondary dark:text-gray-400' : 'text-text-primary dark:text-gray-100'}`}>{task.title}</p>
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
            ))
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
        <CalendarView scope="personal" />
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
