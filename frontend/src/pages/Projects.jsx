import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'
import { usersApi } from '../services/api'
import ProjectCard from '../components/ProjectCard'
import ProjectPreviewModal from '../components/ProjectPreviewModal'
import Button from '../components/Button'
import Modal from '../components/Modal'
import Input from '../components/Input'
import { Plus, Search, FolderKanban, ChevronDown, ChevronUp } from 'lucide-react'
import { PROJECT_STATUSES } from '../constants'

export default function Projects() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { projects, fetchProjects, createProject, togglePin, isLoading } = useProjectStore()
  const [filter, setFilter] = useState('mine')
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [newProject, setNewProject] = useState({ title: '', description: '', lead_id: '', subheader: '' })
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [previewProject, setPreviewProject] = useState(null)
  const [previewWithInfo, setPreviewWithInfo] = useState(false)
  const [teamMembers, setTeamMembers] = useState([])

  const canCreate = user?.role === 'admin' || user?.role === 'project_lead'

  const handlePreview = (project) => {
    setPreviewProject(project)
    setPreviewWithInfo(true)
  }

  const handleProjectClick = (project) => {
    if (user?.role === 'admin' || project.membership_status === 'member') {
      navigate(`/dashboard/projects/${project.id}`)
    } else {
      setPreviewProject(project)
      setPreviewWithInfo(false)
    }
  }

  useEffect(() => {
    document.title = 'Projects - Stats Lab'
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  useEffect(() => {
    if (canCreate) {
      usersApi.team().then(({ data }) => setTeamMembers(data.users || [])).catch(() => {})
    }
  }, [canCreate])

  const handleTogglePin = (projectId) => {
    togglePin(projectId)
  }

  const filteredProjects = projects.filter((p) => {
    if (filter === 'mine') {
      if (p.membership_status !== 'member') return false
    } else if (filter !== 'all' && p.status !== filter) return false
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }).sort((a, b) => {
    // Pinned first (most recently pinned first), then unpinned by server order
    if (a.is_pinned && !b.is_pinned) return -1
    if (!a.is_pinned && b.is_pinned) return 1
    if (a.is_pinned && b.is_pinned) {
      return new Date(b.pinned_at) - new Date(a.pinned_at)
    }
    return 0
  })

  const activeProjects = filteredProjects.filter((p) => p.status === 'active')
  const completedProjects = filteredProjects.filter((p) => p.status === 'completed')
  const inactiveProjects = filteredProjects.filter((p) => p.status === 'inactive')
  const archivedProjects = filteredProjects.filter((p) => p.status === 'archived')

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newProject.title.trim()) return

    setCreateError('')
    setIsCreating(true)
    const payload = { title: newProject.title, description: newProject.description }
    if (newProject.lead_id) payload.lead_id = newProject.lead_id
    if (newProject.subheader) payload.subheader = newProject.subheader
    const project = await createProject(payload)
    setIsCreating(false)

    if (project) {
      setShowCreateModal(false)
      setNewProject({ title: '', description: '', lead_id: '', subheader: '' })
      setCreateError('')
    } else {
      setCreateError(useProjectStore.getState().error || 'Failed to create project')
    }
  }

  const handleOpenCreateModal = () => {
    setNewProject({ title: '', description: '', lead_id: '', subheader: '' })
    setCreateError('')
    setShowCreateModal(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-text-primary dark:text-gray-100">Projects</h1>
          <p className="mt-1 text-text-secondary dark:text-gray-400">Manage and organize your research projects.</p>
        </div>
        {canCreate && (
          <Button onClick={handleOpenCreateModal}>
            <Plus size={18} />
            New Project
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary dark:text-gray-400" />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-organic border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['mine', 'all', ...PROJECT_STATUSES.filter(s => s !== 'archived')].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-organic text-sm font-medium transition-colors ${
                filter === status
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-text-secondary dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {status === 'mine' ? 'My Projects' : <span className="capitalize">{status}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Result count */}
      {!isLoading && (
        <p className="text-sm text-text-secondary dark:text-gray-400">
          {filteredProjects.length} {filteredProjects.length === 1 ? 'project' : 'projects'}{search ? ` matching "${search}"` : ''}{filter === 'mine' ? ' (my projects)' : filter !== 'all' ? ` (${filter})` : ''}
        </p>
      )}

      {/* Projects display based on filter */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 animate-pulse">
              <div className="h-32 bg-gray-100 dark:bg-gray-700" />
              <div className="p-5 space-y-3">
                <div className="h-5 bg-gray-100 dark:bg-gray-700 rounded w-3/4" />
                <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-full" />
                <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : (() => {
        // Determine which projects to display based on filter
        let displayProjects = []
        if (filter === 'mine') {
          displayProjects = filteredProjects.filter(p => p.status !== 'inactive' && p.status !== 'archived')
        } else if (filter === 'all') {
          displayProjects = filteredProjects.filter(p => p.status !== 'archived' && p.status !== 'inactive')
        } else if (filter === 'active') {
          displayProjects = activeProjects
        } else if (filter === 'completed') {
          displayProjects = completedProjects
        } else if (filter === 'inactive') {
          displayProjects = inactiveProjects
        }

        return displayProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {displayProjects.map((project) => (
              <ProjectCard key={project.id} project={project} isMember={project.membership_status === 'member'} pendingJoinRequests={project.pending_join_request_count} isPinned={project.is_pinned} onTogglePin={handleTogglePin} onClick={() => handleProjectClick(project)} onPreview={handlePreview} />
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <FolderKanban size={36} className="text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="font-display font-semibold text-lg text-text-primary dark:text-gray-100">No projects found</h3>
            <p className="mt-2 text-text-secondary dark:text-gray-400 max-w-sm mx-auto">
              {search
                ? 'Try adjusting your search or filters.'
                : filter === 'mine'
                ? "You aren't a member of any projects yet."
                : filter !== 'all' && filter !== 'active'
                ? `No ${filter} projects found.`
                : canCreate
                ? 'Create your first research project to get started.'
                : 'No projects have been created yet.'}
            </p>
            {canCreate && !search && filter === 'active' && (
              <Button className="mt-4" onClick={handleOpenCreateModal}>
                <Plus size={18} />
                Create Project
              </Button>
            )}
          </div>
        )
      })()}

      {/* Inactive projects section - collapsible at bottom (for 'all' and 'mine' filters) */}
      {(() => {
        const inactiveToShow = filter === 'mine'
          ? filteredProjects.filter(p => p.status === 'inactive')
          : filter === 'all'
          ? inactiveProjects
          : []
        if (inactiveToShow.length === 0) return null
        return (
          <section>
            <button
              onClick={() => setShowInactive(!showInactive)}
              className="flex items-center gap-2 text-text-secondary dark:text-gray-400 hover:text-text-primary dark:hover:text-gray-100 mb-4"
            >
              {showInactive ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              <span className="font-medium">Inactive ({inactiveToShow.length})</span>
            </button>
            {showInactive && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {inactiveToShow.map((project) => (
                  <ProjectCard key={project.id} project={project} isMember={project.membership_status === 'member'} pendingJoinRequests={project.pending_join_request_count} isPinned={project.is_pinned} onTogglePin={handleTogglePin} onClick={() => handleProjectClick(project)} onPreview={handlePreview} />
                ))}
              </div>
            )}
          </section>
        )
      })()}

      {/* Archived projects */}
      {archivedProjects.length > 0 && (filter === 'all' || filter === 'archived') && (
        <section>
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2 text-text-secondary dark:text-gray-400 hover:text-text-primary dark:hover:text-gray-100 mb-4"
          >
            {showArchived ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            <span className="font-medium">Archived ({archivedProjects.length})</span>
          </button>
          {showArchived && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {archivedProjects.map((project) => (
                <ProjectCard key={project.id} project={project} isMember={project.membership_status === 'member'} pendingJoinRequests={project.pending_join_request_count} isPinned={project.is_pinned} onTogglePin={handleTogglePin} onClick={() => handleProjectClick(project)} onPreview={handlePreview} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Create modal */}
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
          <Input
            label="Subheader (optional)"
            value={newProject.subheader}
            onChange={(e) => setNewProject({ ...newProject, subheader: e.target.value })}
            placeholder="Short tagline for this project..."
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
          {teamMembers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1.5">
                Project Lead (optional)
              </label>
              <select
                value={newProject.lead_id}
                onChange={(e) => setNewProject({ ...newProject, lead_id: e.target.value })}
                className="w-full px-4 py-2.5 rounded-organic border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
              >
                <option value="">No lead assigned</option>
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
            </div>
          )}
          {createError && (
            <div className="p-3 rounded-lg text-sm bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400">
              {createError}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isCreating}>
              Create Project
            </Button>
          </div>
        </form>
      </Modal>

      {/* Project preview modal for non-members */}
      <ProjectPreviewModal
        project={previewProject}
        onClose={() => setPreviewProject(null)}
        showImportantInfo={previewWithInfo}
      />
    </div>
  )
}
