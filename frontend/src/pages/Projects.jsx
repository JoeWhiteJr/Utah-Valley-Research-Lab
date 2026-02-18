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
import { Plus, Search, FolderKanban, ChevronDown, ChevronUp, Users } from 'lucide-react'
import { PROJECT_STATUS_COLORS } from '../constants'

function MiniProjectCard({ project, onClick }) {
  const statusColor = PROJECT_STATUS_COLORS[project.status] || PROJECT_STATUS_COLORS.active

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-sm transition-all group"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusColor}`}>
          {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
        </span>
        {project.membership_status === 'pending' && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
            Pending
          </span>
        )}
      </div>
      <p className="text-sm font-medium text-text-primary dark:text-gray-100 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
        {project.title}
      </p>
      <div className="flex items-center gap-2 mt-1">
        {project.lead_name && (
          <span className="text-xs text-text-secondary dark:text-gray-400 truncate">
            {project.lead_name}
          </span>
        )}
        {project.member_count != null && (
          <span className="flex items-center gap-0.5 text-xs text-text-secondary dark:text-gray-400 shrink-0">
            <Users size={11} />
            {project.member_count}
          </span>
        )}
      </div>
    </button>
  )
}

export default function Projects() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { projects, fetchProjects, createProject, togglePin, isLoading } = useProjectStore()
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [sidebarFilter, setSidebarFilter] = useState('active')
  const [newProject, setNewProject] = useState({ title: '', description: '', lead_id: '', subheader: '' })
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [previewProject, setPreviewProject] = useState(null)
  const [teamMembers, setTeamMembers] = useState([])

  const canCreate = user?.role === 'admin' || user?.role === 'project_lead'

  const handlePreview = (project) => {
    setPreviewProject(project)
  }

  const handleProjectClick = (project) => {
    if (user?.role === 'admin' || project.membership_status === 'member') {
      navigate(`/dashboard/projects/${project.id}`)
    } else {
      setPreviewProject(project)
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

  // Search filter
  const searchFiltered = projects.filter((p) => {
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Left panel: user's member projects
  const myMemberProjects = searchFiltered
    .filter((p) => p.membership_status === 'member')
    .sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1
      if (!a.is_pinned && b.is_pinned) return 1
      if (a.is_pinned && b.is_pinned) {
        return new Date(b.pinned_at) - new Date(a.pinned_at)
      }
      return 0
    })

  const myActiveCompleted = myMemberProjects.filter((p) => p.status === 'active' || p.status === 'completed')
  const myInactive = myMemberProjects.filter((p) => p.status === 'inactive')

  // Right sidebar: non-member projects filtered by dropdown
  const browseProjects = searchFiltered
    .filter((p) => p.membership_status !== 'member')
    .filter((p) => {
      if (sidebarFilter === 'all') return true
      return p.status === sidebarFilter
    })

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

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary dark:text-gray-400" />
        <input
          type="text"
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-organic border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
        />
      </div>

      {/* Two-panel layout */}
      {isLoading ? (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left skeleton */}
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
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
          </div>
          {/* Right skeleton */}
          <div className="w-full lg:w-72 xl:w-80 shrink-0 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 animate-pulse" />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Left panel — My Projects */}
          <div className="flex-1 min-w-0 space-y-6">
            <h2 className="font-display font-bold text-lg text-text-primary dark:text-gray-100">My Projects</h2>

            {myActiveCompleted.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {myActiveCompleted.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    isMember={true}
                    pendingJoinRequests={project.pending_join_request_count}
                    isPinned={project.is_pinned}
                    onTogglePin={handleTogglePin}
                    onClick={() => handleProjectClick(project)}
                    onPreview={handlePreview}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <FolderKanban size={36} className="text-gray-400 dark:text-gray-500" />
                </div>
                <h3 className="font-display font-semibold text-lg text-text-primary dark:text-gray-100">No projects yet</h3>
                <p className="mt-2 text-text-secondary dark:text-gray-400 max-w-sm mx-auto">
                  {search
                    ? 'No matching projects found. Try adjusting your search.'
                    : "You aren't a member of any projects yet. Browse available projects in the sidebar."}
                </p>
              </div>
            )}

            {/* Inactive member projects — collapsible */}
            {myInactive.length > 0 && (
              <section>
                <button
                  onClick={() => setShowInactive(!showInactive)}
                  className="flex items-center gap-2 text-text-secondary dark:text-gray-400 hover:text-text-primary dark:hover:text-gray-100 mb-4"
                >
                  {showInactive ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  <span className="font-medium">Inactive ({myInactive.length})</span>
                </button>
                {showInactive && (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {myInactive.map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        isMember={true}
                        pendingJoinRequests={project.pending_join_request_count}
                        isPinned={project.is_pinned}
                        onTogglePin={handleTogglePin}
                        onClick={() => handleProjectClick(project)}
                        onPreview={handlePreview}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>

          {/* Right sidebar — Browse Projects */}
          <div className="w-full lg:w-72 xl:w-80 shrink-0 lg:sticky lg:top-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-lg text-text-primary dark:text-gray-100">Browse Projects</h2>
            </div>

            <select
              value={sidebarFilter}
              onChange={(e) => setSidebarFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-organic border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
            >
              <option value="active">Active</option>
              <option value="all">All</option>
              <option value="completed">Completed</option>
              <option value="inactive">Inactive</option>
            </select>

            <div className="max-h-[calc(100vh-16rem)] overflow-y-auto space-y-2 pr-1">
              {browseProjects.length > 0 ? (
                browseProjects.map((project) => (
                  <MiniProjectCard
                    key={project.id}
                    project={project}
                    onClick={() => setPreviewProject(project)}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-sm text-text-secondary dark:text-gray-400">
                  {search ? 'No matching projects.' : 'No projects to browse.'}
                </div>
              )}
            </div>
          </div>
        </div>
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
      />
    </div>
  )
}
