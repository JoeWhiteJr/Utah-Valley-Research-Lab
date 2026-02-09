import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'
import { aiApi, activityApi } from '../services/api'
import ProjectCard from '../components/ProjectCard'
import Button from '../components/Button'
import Modal from '../components/Modal'
import Input from '../components/Input'
import { CalendarView } from '../components/calendar/CalendarView'
import {
  Plus, Upload, FolderKanban, Users, TrendingUp,
  FileText, ArrowUpRight, Sparkles, Calendar, LayoutGrid, Brain, Loader2
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from '../store/toastStore'

export default function LabDashboard() {
  const { user } = useAuthStore()
  const { projects, fetchProjects, createProject, uploadFile, isLoading } = useProjectStore()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [newProject, setNewProject] = useState({ title: '', description: '' })
  const [isCreating, setIsCreating] = useState(false)
  const [selectedProjectForUpload, setSelectedProjectForUpload] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef(null)
  const [activeTab, setActiveTab] = useState('overview')

  // AI Summary state
  const [showAiSummary, setShowAiSummary] = useState(false)
  const [aiSummary, setAiSummary] = useState(null)
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false)
  const [aiSummaryError, setAiSummaryError] = useState(null)

  // Activity feed state
  const [activities, setActivities] = useState([])
  const [loadingActivities, setLoadingActivities] = useState(true)

  const canCreate = user?.role === 'admin' || user?.role === 'project_lead'

  useEffect(() => {
    document.title = 'Dashboard - Stats Lab'
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  useEffect(() => {
    activityApi.list({ limit: 10 })
      .then(({ data }) => setActivities(data.activities || []))
      .catch(() => toast.error('Failed to load recent activity'))
      .finally(() => setLoadingActivities(false))
  }, [])

  const activeProjects = projects.filter((p) => p.status === 'active')
  const completedProjects = projects.filter((p) => p.status === 'completed')
  const totalTasks = projects.reduce((sum, p) => sum + (p.total_actions || 0), 0)
  const completedTasks = projects.reduce((sum, p) => sum + (p.completed_actions || 0), 0)
  const totalFiles = projects.reduce((sum, p) => sum + (p.file_count || 0), 0)

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newProject.title.trim()) return
    setIsCreating(true)
    const project = await createProject(newProject)
    setIsCreating(false)
    if (project) {
      setShowCreateModal(false)
      setNewProject({ title: '', description: '' })
    }
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const [droppedFile, setDroppedFile] = useState(null)

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setDroppedFile(e.dataTransfer.files[0])
      setShowUploadModal(true)
    }
  }

  const handleFileUpload = async (e) => {
    const file = e?.target?.files?.[0] || droppedFile
    if (file && selectedProjectForUpload) {
      await uploadFile(selectedProjectForUpload, file)
      setShowUploadModal(false)
      setSelectedProjectForUpload('')
      setDroppedFile(null)
    }
  }

  const handleGenerateDashboardSummary = async () => {
    setAiSummaryLoading(true)
    setAiSummaryError(null)
    try {
      const { data } = await aiApi.summarizeDashboard()
      setAiSummary(data)
      setShowAiSummary(true)
    } catch (error) {
      setAiSummaryError(error.response?.data?.error?.message || 'Failed to generate AI summary')
      setShowAiSummary(true)
    } finally {
      setAiSummaryLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 via-primary-500 to-secondary-500 p-8 md:p-10">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute inset-0" style={{backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '20px 20px'}}></div>
        </div>
        <div className="relative">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white/90 text-xs font-medium mb-4">
                <Sparkles size={12} />
                Stats Lab Research Hub
              </div>
              <h1 className="font-display font-bold text-3xl md:text-4xl text-white mb-2">
                Lab Dashboard
              </h1>
              <p className="text-white/80 text-lg">
                {format(new Date(), 'EEEE, MMMM d, yyyy')}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {canCreate && (
                <Button
                  variant="white"
                  onClick={() => setShowCreateModal(true)}
                >
                  <Plus size={18} />
                  New Project
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleGenerateDashboardSummary}
                disabled={aiSummaryLoading}
                className="border-white/30 text-white hover:bg-white/10"
              >
                {aiSummaryLoading ? <Loader2 size={18} className="animate-spin" /> : <Brain size={18} />}
                AI Summary
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowUploadModal(true)}
                className="border-white/30 text-white hover:bg-white/10"
              >
                <Upload size={18} />
                Quick Upload
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="group relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-lg hover:shadow-primary-100/50 dark:hover:shadow-primary-900/30 transition-all duration-300">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-primary-100 dark:from-primary-900/30 to-transparent rounded-bl-full opacity-50 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-3">
              <FolderKanban size={20} className="text-primary-600 dark:text-primary-300" />
            </div>
            <p className="text-3xl font-display font-bold text-text-primary dark:text-gray-100">{activeProjects.length}</p>
            <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">Active Projects</p>
          </div>
        </div>

        <div className="group relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:border-secondary-300 dark:hover:border-secondary-600 hover:shadow-lg hover:shadow-secondary-100/50 dark:hover:shadow-secondary-900/30 transition-all duration-300">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-secondary-100 dark:from-secondary-900/30 to-transparent rounded-bl-full opacity-50 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-secondary-100 dark:bg-secondary-900/30 flex items-center justify-center mb-3">
              <TrendingUp size={20} className="text-secondary-600 dark:text-secondary-300" />
            </div>
            <p className="text-3xl font-display font-bold text-text-primary dark:text-gray-100">
              {totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%
            </p>
            <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">Tasks Complete</p>
          </div>
        </div>

        <div className="group relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:border-accent-300 dark:hover:border-accent-600 hover:shadow-lg hover:shadow-accent-100/50 dark:hover:shadow-accent-900/30 transition-all duration-300">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-accent-100 dark:from-accent-900/30 to-transparent rounded-bl-full opacity-50 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center mb-3">
              <FileText size={20} className="text-accent-600 dark:text-accent-300" />
            </div>
            <p className="text-3xl font-display font-bold text-text-primary dark:text-gray-100">{totalFiles}</p>
            <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">Total Files</p>
          </div>
        </div>

        <div className="group relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:border-green-300 dark:hover:border-green-600 hover:shadow-lg hover:shadow-green-100/50 dark:hover:shadow-green-900/30 transition-all duration-300">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-green-100 dark:from-green-900/30 to-transparent rounded-bl-full opacity-50 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3">
              <Users size={20} className="text-green-600 dark:text-green-300" />
            </div>
            <p className="text-3xl font-display font-bold text-text-primary dark:text-gray-100">{completedProjects.length}</p>
            <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">Completed</p>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'overview'
              ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <LayoutGrid size={16} />
          Overview
        </button>
        <button
          onClick={() => setActiveTab('calendar')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'calendar'
              ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Calendar size={16} />
          Calendar
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'overview' ? (
        <>
          {/* Quick Upload Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
              dragActive
                ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/30'
                : 'border-gray-300 dark:border-gray-600 hover:border-primary-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Upload size={32} className={`mx-auto mb-3 ${dragActive ? 'text-primary-500' : 'text-gray-400 dark:text-gray-500'}`} />
            <p className="font-medium text-text-primary dark:text-gray-100 mb-1">Drop files here to upload</p>
            <p className="text-sm text-text-secondary dark:text-gray-400">or click to select a project and upload</p>
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => setShowUploadModal(true)}
            >
              Select Project & Upload
            </Button>
          </div>

          {/* Active Projects */}
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-bold text-xl text-text-primary dark:text-gray-100">Active Projects</h2>
              <Link
                to="/dashboard/projects"
                className="inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 text-sm font-medium"
              >
                View all
                <ArrowUpRight size={16} />
              </Link>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 animate-pulse">
                    <div className="h-36 bg-gray-100 dark:bg-gray-700 rounded-t-xl" />
                    <div className="p-5 space-y-3">
                      <div className="h-5 bg-gray-100 dark:bg-gray-700 rounded w-3/4" />
                      <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-full" />
                      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activeProjects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {activeProjects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            ) : (
              <div className="bg-gradient-to-br from-gray-50 dark:from-gray-800 to-white dark:to-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
                <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-primary-100 dark:from-primary-900/30 to-secondary-100 dark:to-secondary-900/30 flex items-center justify-center">
                  <FolderKanban size={36} className="text-primary-500 dark:text-primary-400" />
                </div>
                <h3 className="font-display font-semibold text-xl text-text-primary dark:text-gray-100 mb-2">
                  No active projects yet
                </h3>
                <p className="text-text-secondary dark:text-gray-400 max-w-md mx-auto mb-6">
                  Start your research journey by creating your first project. Organize your work, track progress, and collaborate with your team.
                </p>
                {canCreate && (
                  <Button onClick={() => setShowCreateModal(true)}>
                    <Plus size={18} />
                    Create Your First Project
                  </Button>
                )}
              </div>
            )}
          </section>

          {/* Recently Completed */}
          {completedProjects.length > 0 && (
            <section>
              <h2 className="font-display font-bold text-xl text-text-primary dark:text-gray-100 mb-5">Recently Completed</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {completedProjects.slice(0, 4).map((project) => (
                  <Link
                    key={project.id}
                    to={`/dashboard/projects/${project.id}`}
                    className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:border-green-300 dark:hover:border-green-600 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <FolderKanban size={18} className="text-green-600 dark:text-green-300" />
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium">
                        Complete
                      </span>
                    </div>
                    <h3 className="font-medium text-text-primary dark:text-gray-100 group-hover:text-green-700 dark:group-hover:text-green-300 line-clamp-1 mb-1">
                      {project.title}
                    </h3>
                    <p className="text-xs text-text-secondary dark:text-gray-400">
                      {project.total_actions || 0} tasks completed
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Recent Activity */}
          <section>
            <h2 className="font-display font-bold text-xl text-text-primary dark:text-gray-100 mb-4">Recent Activity</h2>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
              {loadingActivities ? (
                <div className="p-4 text-center text-text-secondary dark:text-gray-400 text-sm">Loading activity...</div>
              ) : activities.length > 0 ? (
                activities.map(a => (
                  <div key={a.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary-700 dark:text-primary-300 text-xs font-medium">{a.user_name?.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium text-text-primary dark:text-gray-100">{a.user_name}</span>{' '}
                        <span className="text-text-secondary dark:text-gray-400">{a.action}</span>{' '}
                        {a.entity_title && <span className="font-medium text-text-primary dark:text-gray-100">{a.entity_title}</span>}
                      </p>
                      <p className="text-xs text-text-secondary dark:text-gray-400 mt-0.5">
                        {new Date(a.created_at).toLocaleDateString()} at {new Date(a.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-text-secondary dark:text-gray-400 text-sm">No recent activity</div>
              )}
            </div>
          </section>
        </>
      ) : (
        /* Calendar Tab */
        <section>
          <CalendarView scope="lab" />
        </section>
      )}

      {/* Create Project Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Project"
      >
        <form onSubmit={handleCreate} className="space-y-5">
          <Input
            label="Project title"
            value={newProject.title}
            onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
            placeholder="e.g., Bayesian Analysis Study"
            required
          />
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1.5">
              Description
            </label>
            <textarea
              value={newProject.description}
              onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
              placeholder="Brief overview of the project..."
              rows={4}
              className="w-full px-4 py-2.5 rounded-organic border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isCreating}>
              Create Project
            </Button>
          </div>
        </form>
      </Modal>

      {/* Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload Document"
      >
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1.5">
              Select Project
            </label>
            <select
              value={selectedProjectForUpload}
              onChange={(e) => setSelectedProjectForUpload(e.target.value)}
              className="w-full px-4 py-2.5 rounded-organic border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              <option value="">Choose a project...</option>
              {activeProjects.map((project) => (
                <option key={project.id} value={project.id}>{project.title}</option>
              ))}
            </select>
          </div>
          {droppedFile ? (
            <div>
              <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1.5">
                File
              </label>
              <p className="px-4 py-2.5 rounded-organic border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-text-secondary dark:text-gray-400 text-sm">
                {droppedFile.name}
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1.5">
                Select File
              </label>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                disabled={!selectedProjectForUpload}
                className="w-full px-4 py-2.5 rounded-organic border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 dark:file:bg-primary-900/30 file:text-primary-700 dark:file:text-primary-300 hover:file:bg-primary-100 dark:hover:file:bg-primary-900/50 disabled:opacity-50"
              />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setShowUploadModal(false); setDroppedFile(null) }}>
              Cancel
            </Button>
            {droppedFile && (
              <Button
                disabled={!selectedProjectForUpload}
                onClick={() => handleFileUpload()}
              >
                Upload
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* AI Dashboard Summary Modal */}
      <Modal isOpen={showAiSummary} onClose={() => setShowAiSummary(false)} title="AI Dashboard Summary" size="lg">
        <div className="space-y-4">
          {aiSummaryError ? (
            <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {aiSummaryError}
            </div>
          ) : aiSummary ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="p-3 bg-primary-50 dark:bg-primary-900/30 rounded-lg text-center">
                  <p className="text-xl font-bold text-primary-700 dark:text-primary-300">{aiSummary.stats?.activeProjects ?? activeProjects.length}</p>
                  <p className="text-xs text-primary-600 dark:text-primary-400">Active</p>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg text-center">
                  <p className="text-xl font-bold text-amber-700 dark:text-amber-300">{aiSummary.stats?.pendingTasks ?? (totalTasks - completedTasks)}</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">Pending</p>
                </div>
                <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-lg text-center">
                  <p className="text-xl font-bold text-red-700 dark:text-red-300">{aiSummary.stats?.overdueTasks ?? 0}</p>
                  <p className="text-xs text-red-600 dark:text-red-400">Overdue</p>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-center">
                  <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{aiSummary.stats?.dueThisWeek ?? 0}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">Due This Week</p>
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg text-center">
                  <p className="text-xl font-bold text-green-700 dark:text-green-300">{aiSummary.stats?.completedThisWeek ?? 0}</p>
                  <p className="text-xs text-green-600 dark:text-green-400">Done This Week</p>
                </div>
              </div>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <div className="whitespace-pre-wrap text-text-secondary dark:text-gray-400 leading-relaxed">
                  {aiSummary.summary}
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button variant="outline" size="sm" onClick={handleGenerateDashboardSummary} disabled={aiSummaryLoading}>
                  {aiSummaryLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  Regenerate
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-primary-500" />
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
