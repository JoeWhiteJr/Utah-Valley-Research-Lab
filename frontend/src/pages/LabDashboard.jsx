import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'
import { aiApi } from '../services/api'
import ProjectCard from '../components/ProjectCard'
import Button from '../components/Button'
import Modal from '../components/Modal'
import Input from '../components/Input'
import {
  Plus, Upload, FolderKanban, Users, TrendingUp,
  FileText, ArrowUpRight, Sparkles, Calendar, Brain, Loader2
} from 'lucide-react'
import { format } from 'date-fns'

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

  // AI Summary state
  const [showAiSummary, setShowAiSummary] = useState(false)
  const [aiSummary, setAiSummary] = useState(null)
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false)
  const [aiSummaryError, setAiSummaryError] = useState(null)

  const canCreate = user?.role === 'admin' || user?.role === 'project_lead'

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

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
        <div className="group relative overflow-hidden bg-white rounded-xl border border-gray-200 p-5 hover:border-primary-300 hover:shadow-lg hover:shadow-primary-100/50 transition-all duration-300">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-primary-100 to-transparent rounded-bl-full opacity-50 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center mb-3">
              <FolderKanban size={20} className="text-primary-600" />
            </div>
            <p className="text-3xl font-display font-bold text-text-primary">{activeProjects.length}</p>
            <p className="text-sm text-text-secondary mt-1">Active Projects</p>
          </div>
        </div>

        <div className="group relative overflow-hidden bg-white rounded-xl border border-gray-200 p-5 hover:border-secondary-300 hover:shadow-lg hover:shadow-secondary-100/50 transition-all duration-300">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-secondary-100 to-transparent rounded-bl-full opacity-50 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-secondary-100 flex items-center justify-center mb-3">
              <TrendingUp size={20} className="text-secondary-600" />
            </div>
            <p className="text-3xl font-display font-bold text-text-primary">
              {totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%
            </p>
            <p className="text-sm text-text-secondary mt-1">Tasks Complete</p>
          </div>
        </div>

        <div className="group relative overflow-hidden bg-white rounded-xl border border-gray-200 p-5 hover:border-accent-300 hover:shadow-lg hover:shadow-accent-100/50 transition-all duration-300">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-accent-100 to-transparent rounded-bl-full opacity-50 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-accent-100 flex items-center justify-center mb-3">
              <FileText size={20} className="text-accent-600" />
            </div>
            <p className="text-3xl font-display font-bold text-text-primary">{totalFiles}</p>
            <p className="text-sm text-text-secondary mt-1">Total Files</p>
          </div>
        </div>

        <div className="group relative overflow-hidden bg-white rounded-xl border border-gray-200 p-5 hover:border-green-300 hover:shadow-lg hover:shadow-green-100/50 transition-all duration-300">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-green-100 to-transparent rounded-bl-full opacity-50 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center mb-3">
              <Users size={20} className="text-green-600" />
            </div>
            <p className="text-3xl font-display font-bold text-text-primary">{completedProjects.length}</p>
            <p className="text-sm text-text-secondary mt-1">Completed</p>
          </div>
        </div>
      </div>

      {/* Quick Upload Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
          dragActive
            ? 'border-primary-400 bg-primary-50'
            : 'border-gray-300 hover:border-primary-300 hover:bg-gray-50'
        }`}
      >
        <Upload size={32} className={`mx-auto mb-3 ${dragActive ? 'text-primary-500' : 'text-gray-400'}`} />
        <p className="font-medium text-text-primary mb-1">Drop files here to upload</p>
        <p className="text-sm text-text-secondary">or click to select a project and upload</p>
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
          <h2 className="font-display font-bold text-xl text-text-primary">Active Projects</h2>
          <Link
            to="/dashboard/projects"
            className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 text-sm font-medium"
          >
            View all
            <ArrowUpRight size={16} />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 animate-pulse">
                <div className="h-36 bg-gray-100 rounded-t-xl" />
                <div className="p-5 space-y-3">
                  <div className="h-5 bg-gray-100 rounded w-3/4" />
                  <div className="h-4 bg-gray-100 rounded w-full" />
                  <div className="h-2 bg-gray-100 rounded w-full" />
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
          <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-primary-100 to-secondary-100 flex items-center justify-center">
              <FolderKanban size={36} className="text-primary-500" />
            </div>
            <h3 className="font-display font-semibold text-xl text-text-primary mb-2">
              No active projects yet
            </h3>
            <p className="text-text-secondary max-w-md mx-auto mb-6">
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
          <h2 className="font-display font-bold text-xl text-text-primary mb-5">Recently Completed</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {completedProjects.slice(0, 4).map((project) => (
              <Link
                key={project.id}
                to={`/dashboard/projects/${project.id}`}
                className="group bg-white rounded-xl border border-gray-200 p-5 hover:border-green-300 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <FolderKanban size={18} className="text-green-600" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                    Complete
                  </span>
                </div>
                <h3 className="font-medium text-text-primary group-hover:text-green-700 line-clamp-1 mb-1">
                  {project.title}
                </h3>
                <p className="text-xs text-text-secondary">
                  {project.total_actions || 0} tasks completed
                </p>
              </Link>
            ))}
          </div>
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
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Description
            </label>
            <textarea
              value={newProject.description}
              onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
              placeholder="Brief overview of the project..."
              rows={4}
              className="w-full px-4 py-2.5 rounded-organic border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 resize-none"
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
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Select Project
            </label>
            <select
              value={selectedProjectForUpload}
              onChange={(e) => setSelectedProjectForUpload(e.target.value)}
              className="w-full px-4 py-2.5 rounded-organic border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              <option value="">Choose a project...</option>
              {activeProjects.map((project) => (
                <option key={project.id} value={project.id}>{project.title}</option>
              ))}
            </select>
          </div>
          {droppedFile ? (
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                File
              </label>
              <p className="px-4 py-2.5 rounded-organic border border-gray-200 bg-gray-50 text-text-secondary text-sm">
                {droppedFile.name}
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                Select File
              </label>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                disabled={!selectedProjectForUpload}
                className="w-full px-4 py-2.5 rounded-organic border border-gray-300 bg-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 disabled:opacity-50"
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
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {aiSummaryError}
            </div>
          ) : aiSummary ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="p-3 bg-primary-50 rounded-lg text-center">
                  <p className="text-xl font-bold text-primary-700">{aiSummary.stats?.activeProjects ?? activeProjects.length}</p>
                  <p className="text-xs text-primary-600">Active</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg text-center">
                  <p className="text-xl font-bold text-amber-700">{aiSummary.stats?.pendingTasks ?? (totalTasks - completedTasks)}</p>
                  <p className="text-xs text-amber-600">Pending</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg text-center">
                  <p className="text-xl font-bold text-red-700">{aiSummary.stats?.overdueTasks ?? 0}</p>
                  <p className="text-xs text-red-600">Overdue</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg text-center">
                  <p className="text-xl font-bold text-blue-700">{aiSummary.stats?.dueThisWeek ?? 0}</p>
                  <p className="text-xs text-blue-600">Due This Week</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg text-center">
                  <p className="text-xl font-bold text-green-700">{aiSummary.stats?.completedThisWeek ?? 0}</p>
                  <p className="text-xs text-green-600">Done This Week</p>
                </div>
              </div>
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-text-secondary leading-relaxed">
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
