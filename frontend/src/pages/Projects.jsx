import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'
import ProjectCard from '../components/ProjectCard'
import Button from '../components/Button'
import Modal from '../components/Modal'
import Input from '../components/Input'
import { Plus, Search, FolderKanban, ChevronDown, ChevronUp } from 'lucide-react'

export default function Projects() {
  const { user } = useAuthStore()
  const { projects, fetchProjects, createProject, isLoading } = useProjectStore()
  const [filter, setFilter] = useState('active')
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [newProject, setNewProject] = useState({ title: '', description: '' })
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const canCreate = user?.role === 'admin' || user?.role === 'project_lead'

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const filteredProjects = projects.filter((p) => {
    if (filter !== 'all' && p.status !== filter) return false
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
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
    const project = await createProject(newProject)
    setIsCreating(false)

    if (project) {
      setShowCreateModal(false)
      setNewProject({ title: '', description: '' })
      setCreateError('')
    } else {
      setCreateError(useProjectStore.getState().error || 'Failed to create project')
    }
  }

  const handleOpenCreateModal = () => {
    setNewProject({ title: '', description: '' })
    setCreateError('')
    setShowCreateModal(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-text-primary">Projects</h1>
          <p className="mt-1 text-text-secondary">Manage and organize your research projects.</p>
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
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-organic border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'active', 'completed', 'inactive'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-organic text-sm font-medium capitalize transition-colors ${
                filter === status
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-white border border-gray-300 text-text-secondary hover:bg-gray-50'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Projects display based on filter */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 animate-pulse">
              <div className="h-32 bg-gray-100" />
              <div className="p-5 space-y-3">
                <div className="h-5 bg-gray-100 rounded w-3/4" />
                <div className="h-4 bg-gray-100 rounded w-full" />
                <div className="h-2 bg-gray-100 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : (() => {
        // Determine which projects to display based on filter
        let displayProjects = []
        if (filter === 'all') {
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
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <FolderKanban size={36} className="text-gray-400" />
            </div>
            <h3 className="font-display font-semibold text-lg text-text-primary">No projects found</h3>
            <p className="mt-2 text-text-secondary max-w-sm mx-auto">
              {search
                ? 'Try adjusting your search or filters.'
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

      {/* Inactive projects section - collapsible at bottom */}
      {inactiveProjects.length > 0 && filter === 'all' && (
        <section>
          <button
            onClick={() => setShowInactive(!showInactive)}
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary mb-4"
          >
            {showInactive ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            <span className="font-medium">Inactive ({inactiveProjects.length})</span>
          </button>
          {showInactive && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {inactiveProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Archived projects */}
      {archivedProjects.length > 0 && (filter === 'all' || filter === 'archived') && (
        <section>
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary mb-4"
          >
            {showArchived ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            <span className="font-medium">Archived ({archivedProjects.length})</span>
          </button>
          {showArchived && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {archivedProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
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
          {createError && (
            <div className="p-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-600">
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
    </div>
  )
}
