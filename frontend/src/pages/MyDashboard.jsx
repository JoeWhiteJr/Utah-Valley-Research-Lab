import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'
import { actionsApi } from '../services/api'
import Button from '../components/Button'
import {
  CheckCircle2, Circle, Calendar, Clock, ArrowUpRight,
  FolderKanban, Zap, Target, Award
} from 'lucide-react'
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns'

export default function MyDashboard() {
  const { user } = useAuthStore()
  const { projects, fetchProjects, isLoading } = useProjectStore()
  const [myTasks, setMyTasks] = useState([])
  const [loadingTasks, setLoadingTasks] = useState(true)

  useEffect(() => {
    fetchProjects()
    loadMyTasks()
  }, [fetchProjects])

  const loadMyTasks = async () => {
    setLoadingTasks(true)
    try {
      // Fetch tasks from all projects assigned to current user
      const allTasks = []
      const { data: projectsData } = await actionsApi.list('all')
      // We need to fetch per project, so let's adjust this
    } catch (error) {
      console.error('Failed to load tasks:', error)
    }
    setLoadingTasks(false)
  }

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

  const completedToday = 0 // Would come from real data
  const pendingTasks = 0 // Would come from real data
  const streak = 5 // Gamification element

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
                Here's your personal research overview
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
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
              <CheckCircle2 size={24} className="text-green-600" />
            </div>
            <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
              Today
            </span>
          </div>
          <p className="text-4xl font-display font-bold text-text-primary">{completedToday}</p>
          <p className="text-text-secondary mt-1">Tasks Completed</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <Target size={24} className="text-amber-600" />
            </div>
            <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
              Pending
            </span>
          </div>
          <p className="text-4xl font-display font-bold text-text-primary">{pendingTasks}</p>
          <p className="text-text-secondary mt-1">Tasks Remaining</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center">
              <Award size={24} className="text-primary-600" />
            </div>
            <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-1 rounded-full">
              This Week
            </span>
          </div>
          <p className="text-4xl font-display font-bold text-text-primary">{myProjects.length}</p>
          <p className="text-text-secondary mt-1">Active Projects</p>
        </div>
      </div>

      {/* My Tasks */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-xl text-text-primary">My Tasks</h2>
          <Link
            to="/projects"
            className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 text-sm font-medium"
          >
            View all projects
            <ArrowUpRight size={16} />
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {loadingTasks ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
              <p className="text-text-secondary mt-3">Loading your tasks...</p>
            </div>
          ) : myTasks.length > 0 ? (
            myTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
              >
                <button className="flex-shrink-0 w-5 h-5 rounded-md border-2 border-gray-300 hover:border-primary-400">
                  <Circle size={20} className="text-gray-300" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-text-primary truncate">{task.title}</p>
                  <p className="text-sm text-text-secondary">{task.project_title}</p>
                </div>
                {task.due_date && (
                  <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                    isPast(parseISO(task.due_date))
                      ? 'bg-red-100 text-red-700'
                      : isToday(parseISO(task.due_date))
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    <Calendar size={12} />
                    {format(parseISO(task.due_date), 'MMM d')}
                  </span>
                )}
              </div>
            ))
          ) : (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-green-100 to-secondary-100 flex items-center justify-center">
                <CheckCircle2 size={28} className="text-green-500" />
              </div>
              <h3 className="font-display font-semibold text-lg text-text-primary mb-2">
                All caught up!
              </h3>
              <p className="text-text-secondary max-w-sm mx-auto">
                You don't have any pending tasks assigned to you. Check out your projects to add new tasks.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* My Projects */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-xl text-text-primary">My Projects</h2>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-3/4 mb-3" />
                <div className="h-3 bg-gray-100 rounded w-1/2 mb-4" />
                <div className="h-2 bg-gray-100 rounded w-full" />
              </div>
            ))}
          </div>
        ) : myProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myProjects.map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="group bg-white rounded-xl border border-gray-200 p-5 hover:border-primary-300 hover:shadow-lg hover:shadow-primary-100/50 transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center group-hover:bg-primary-200 transition-colors">
                    <FolderKanban size={18} className="text-primary-600" />
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    project.status === 'active'
                      ? 'bg-secondary-100 text-secondary-700'
                      : project.status === 'completed'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {project.status}
                  </span>
                </div>
                <h3 className="font-medium text-text-primary group-hover:text-primary-700 line-clamp-1 mb-2">
                  {project.title}
                </h3>
                <div className="flex items-center justify-between text-sm text-text-secondary">
                  <span>{project.completed_actions || 0}/{project.total_actions || 0} tasks</span>
                  <span>{project.progress || 0}%</span>
                </div>
                <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary-400 to-primary-500 rounded-full transition-all duration-500"
                    style={{ width: `${project.progress || 0}%` }}
                  />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
              <FolderKanban size={28} className="text-gray-400" />
            </div>
            <h3 className="font-display font-semibold text-lg text-text-primary mb-2">
              No projects yet
            </h3>
            <p className="text-text-secondary max-w-sm mx-auto">
              You haven't been assigned to any projects yet.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
