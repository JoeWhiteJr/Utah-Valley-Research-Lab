import { useState, useEffect } from 'react'
import { useAdminStore } from '../store/adminStore'
import { useApplicationStore } from '../store/applicationStore'
import { useAuthStore } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'
import { usePublishStore } from '../store/publishStore'
import { usersApi } from '../services/api'
import Button from '../components/Button'
import Modal from '../components/Modal'
import { LayoutDashboard, Users, ScrollText, Trash2, Sparkles, Globe, Eye, Pencil, XCircle } from 'lucide-react'

export default function Admin() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const { stats, fetchStats } = useAdminStore()
  const { applications, fetchApplications, approveApplication, rejectApplication, requestAiReview, aiReview } = useApplicationStore()
  const { user } = useAuthStore()
  const { projects, fetchProjects } = useProjectStore()
  const { publishedProjects, fetchPublishedProjects, publishProject, updatePublishedProject, unpublishProject } = usePublishStore()

  // Team state
  const [teamMembers, setTeamMembers] = useState([])
  const [isLoadingTeam, setIsLoadingTeam] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewingAppId, setReviewingAppId] = useState(null)
  const [isReviewing, setIsReviewing] = useState(false)

  // Publish state
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [editingPublished, setEditingPublished] = useState(null)
  const [publishForm, setPublishForm] = useState({ title: '', description: '', image: '', status: 'ongoing' })
  const [publishProjectId, setPublishProjectId] = useState(null)
  const [isPublishing, setIsPublishing] = useState(false)
  const [showUnpublishConfirm, setShowUnpublishConfirm] = useState(null)

  const isSuperAdmin = user?.is_super_admin === true

  useEffect(() => { fetchStats(); fetchApplications() }, [fetchStats, fetchApplications])

  useEffect(() => {
    if (activeTab === 'team') {
      loadTeam()
    }
    if (activeTab === 'publish') {
      fetchProjects()
      fetchPublishedProjects()
    }
  }, [activeTab])

  const loadTeam = async () => {
    setIsLoadingTeam(true)
    try {
      const { data } = await usersApi.list()
      setTeamMembers(data.users)
    } catch (error) {
      console.error('Failed to load team:', error)
    }
    setIsLoadingTeam(false)
  }

  const handleRoleChange = async (userId, newRole) => {
    try {
      await usersApi.updateRole(userId, newRole)
      setTeamMembers((members) =>
        members.map((m) => (m.id === userId ? { ...m, role: newRole } : m))
      )
    } catch (error) {
      console.error('Failed to update role:', error)
    }
  }

  const handleDeleteMember = async (userId) => {
    try {
      await usersApi.delete(userId)
      setTeamMembers((members) => members.filter((m) => m.id !== userId))
      setShowDeleteConfirm(null)
    } catch (error) {
      console.error('Failed to delete member:', error)
    }
  }

  const handleAiReview = async (app) => {
    setReviewingAppId(app.id)
    setIsReviewing(true)
    setShowReviewModal(true)
    await requestAiReview(app.id)
    setIsReviewing(false)
  }

  // Publish helpers
  const publishedMap = {}
  publishedProjects.forEach((pp) => { publishedMap[pp.project_id] = pp })

  const mapStatusToPublic = (projectStatus) => {
    if (projectStatus === 'completed') return 'completed'
    return 'ongoing'
  }

  const openPublishModal = (project) => {
    setPublishProjectId(project.id)
    setEditingPublished(null)
    setPublishForm({
      title: project.title || '',
      description: project.description || '',
      image: project.header_image || '',
      status: mapStatusToPublic(project.status)
    })
    setShowPublishModal(true)
  }

  const openEditModal = (pp) => {
    setEditingPublished(pp)
    setPublishProjectId(pp.project_id)
    setPublishForm({
      title: pp.published_title || '',
      description: pp.published_description || '',
      image: pp.published_image || '',
      status: pp.published_status || 'ongoing'
    })
    setShowPublishModal(true)
  }

  const handlePublishSubmit = async () => {
    setIsPublishing(true)
    if (editingPublished) {
      await updatePublishedProject(editingPublished.id, {
        title: publishForm.title,
        description: publishForm.description,
        image: publishForm.image,
        status: publishForm.status
      })
    } else {
      await publishProject({
        project_id: publishProjectId,
        title: publishForm.title,
        description: publishForm.description,
        image: publishForm.image,
        status: publishForm.status
      })
    }
    setIsPublishing(false)
    setShowPublishModal(false)
  }

  const handleUnpublish = async (pp) => {
    await unpublishProject(pp.id)
    setShowUnpublishConfirm(null)
  }

  return (
    <div>
      <h1 className="font-display font-bold text-2xl mb-6">Admin Dashboard</h1>
      <div className="flex gap-2 border-b mb-6">
        {[['dashboard', 'Dashboard', LayoutDashboard], ['applications', 'Applications', Users], ['team', 'Team', Users], ['publish', 'Publish', Globe]].map(([id, label, Icon]) => (
          <button key={id} onClick={() => setActiveTab(id)} className={`flex items-center gap-2 px-4 py-3 border-b-2 ${activeTab === id ? 'border-primary-500 text-primary-600' : 'border-transparent'}`}>
            <Icon size={18} />{label}
          </button>
        ))}
      </div>
      {activeTab === 'dashboard' && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-6 border"><div className="text-sm text-text-secondary">Users</div><div className="text-3xl font-bold">{stats?.users?.total_users || 0}</div></div>
          <div className="bg-white rounded-xl p-6 border"><div className="text-sm text-text-secondary">Pending</div><div className="text-3xl font-bold">{stats?.applications?.pending || 0}</div></div>
          <div className="bg-white rounded-xl p-6 border"><div className="text-sm text-text-secondary">Projects</div><div className="text-3xl font-bold">{stats?.projects?.active || 0}</div></div>
          <div className="bg-white rounded-xl p-6 border"><div className="text-sm text-text-secondary">Messages</div><div className="text-3xl font-bold">{stats?.chats?.messages_this_week || 0}</div></div>
        </div>
      )}
      {activeTab === 'applications' && (
        <div className="space-y-3">
          {applications.map((app) => (
            <div key={app.id} className="bg-white rounded-xl p-4 border flex items-center justify-between">
              <div>
                <div className="font-medium">{app.name}</div>
                <div className="text-sm text-text-secondary">{app.email}</div>
                <div className="text-sm text-text-secondary mt-1">{app.message?.slice(0, 100)}...</div>
              </div>
              {app.status === 'pending' && (
                <div className="flex gap-2">
                  <button onClick={() => handleAiReview(app)} className="flex items-center gap-1 px-3 py-1 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600">
                    <Sparkles size={14} />
                    AI Review
                  </button>
                  <button onClick={() => approveApplication(app.id)} className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm">Approve</button>
                  <button onClick={() => rejectApplication(app.id)} className="px-3 py-1 bg-red-500 text-white rounded-lg text-sm">Reject</button>
                </div>
              )}
              {app.status !== 'pending' && <span className={`px-2 py-1 rounded text-xs ${app.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{app.status}</span>}
            </div>
          ))}
        </div>
      )}
      {activeTab === 'team' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-display font-semibold text-lg mb-6">Team Members</h2>
          {isLoadingTeam ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-gray-300"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-primary-700 font-medium">
                        {member.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-text-primary">{member.name}</p>
                      <p className="text-sm text-text-secondary">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.id, e.target.value)}
                      disabled={member.id === user.id || (!isSuperAdmin && (member.role === 'admin' || false))}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSuperAdmin ? (
                        <>
                          <option value="admin">Admin</option>
                          <option value="project_lead">Project Lead</option>
                          <option value="researcher">Researcher</option>
                          <option value="viewer">Viewer</option>
                        </>
                      ) : (
                        <>
                          {member.role === 'admin' && <option value="admin">Admin</option>}
                          <option value="project_lead">Project Lead</option>
                          <option value="researcher">Researcher</option>
                          <option value="viewer">Viewer</option>
                        </>
                      )}
                    </select>
                    {member.id !== user.id && (isSuperAdmin || member.role !== 'admin') && (
                      <button
                        onClick={() => setShowDeleteConfirm(member)}
                        className="p-2 rounded-lg text-text-secondary hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Publish Tab */}
      {activeTab === 'publish' && (
        <div>
          <h2 className="font-display font-semibold text-lg mb-6">Publish Team Projects</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => {
              const pp = publishedMap[project.id]
              const isPublished = !!pp
              return (
                <div key={project.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Image */}
                  <div className="h-32 bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center relative">
                    {(isPublished ? pp.published_image : project.header_image) ? (
                      <img
                        src={isPublished ? pp.published_image : project.header_image}
                        alt={project.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-primary-400 text-4xl font-bold opacity-30">{project.title?.charAt(0)}</div>
                    )}
                    {isPublished && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 bg-green-500 text-white rounded-full text-xs font-medium">
                        Published
                      </span>
                    )}
                    <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                      project.status === 'active' ? 'bg-blue-100 text-blue-700' :
                      project.status === 'completed' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {project.status}
                    </span>
                  </div>
                  {/* Content */}
                  <div className="p-4">
                    <h3 className="font-semibold text-text-primary mb-1 truncate">{project.title}</h3>
                    <p className="text-sm text-text-secondary line-clamp-2 mb-3">{project.description}</p>
                    <div className="flex gap-2">
                      {isPublished ? (
                        <>
                          <button
                            onClick={() => openEditModal(pp)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-sm hover:bg-primary-100"
                          >
                            <Pencil size={14} /> Edit
                          </button>
                          <button
                            onClick={() => setShowUnpublishConfirm(pp)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm hover:bg-red-100"
                          >
                            <XCircle size={14} /> Unpublish
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => openPublishModal(project)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm hover:bg-green-100"
                        >
                          <Globe size={14} /> Publish
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {projects.length === 0 && (
            <div className="text-center py-12 text-text-secondary">No team projects found.</div>
          )}
        </div>
      )}

      {/* Delete Member Confirmation */}
      <Modal
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        title="Remove Team Member"
        size="sm"
      >
        <p className="text-text-secondary">
          Are you sure you want to remove <strong>{showDeleteConfirm?.name}</strong> from the team?
          This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setShowDeleteConfirm(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => handleDeleteMember(showDeleteConfirm.id)}>
            Remove
          </Button>
        </div>
      </Modal>

      {/* AI Review Modal */}
      <Modal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        title="AI Application Review"
      >
        {isReviewing ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
            <span className="ml-3 text-text-secondary">Analyzing application...</span>
          </div>
        ) : aiReview ? (
          <div>
            <div className="mb-3">
              <span className="text-sm text-text-secondary">Applicant: </span>
              <span className="font-medium">{applications.find(a => a.id === reviewingAppId)?.name}</span>
            </div>
            <div className="prose prose-sm max-w-none">
              <p className="text-text-secondary whitespace-pre-wrap">{typeof aiReview === 'string' ? aiReview : aiReview.summary || JSON.stringify(aiReview, null, 2)}</p>
            </div>
          </div>
        ) : (
          <p className="text-text-secondary">No review available.</p>
        )}
        <div className="flex justify-end pt-4">
          <Button variant="secondary" onClick={() => setShowReviewModal(false)}>Close</Button>
        </div>
      </Modal>

      {/* Unpublish Confirmation Modal */}
      <Modal
        isOpen={!!showUnpublishConfirm}
        onClose={() => setShowUnpublishConfirm(null)}
        title="Unpublish Project"
        size="sm"
      >
        <p className="text-text-secondary">
          Are you sure you want to unpublish <strong>{showUnpublishConfirm?.published_title}</strong>?
          It will be removed from the public projects page.
        </p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setShowUnpublishConfirm(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => handleUnpublish(showUnpublishConfirm)}>
            Unpublish
          </Button>
        </div>
      </Modal>

      {/* Publish / Edit Modal */}
      <Modal
        isOpen={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        title={editingPublished ? 'Edit Published Project' : 'Publish Project'}
        size="lg"
      >
        <div className="grid md:grid-cols-2 gap-6">
          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Title</label>
              <input
                type="text"
                value={publishForm.title}
                onChange={(e) => setPublishForm({ ...publishForm, title: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Description</label>
              <textarea
                value={publishForm.description}
                onChange={(e) => setPublishForm({ ...publishForm, description: e.target.value })}
                rows={5}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Image URL</label>
              <input
                type="text"
                value={publishForm.image}
                onChange={(e) => setPublishForm({ ...publishForm, image: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Status</label>
              <select
                value={publishForm.status}
                onChange={(e) => setPublishForm({ ...publishForm, status: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          {/* Live Preview */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Preview</label>
            <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
              <div className="h-32 bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center relative">
                {publishForm.image ? (
                  <img
                    src={publishForm.image}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.style.display = 'none' }}
                  />
                ) : (
                  <div className="text-blue-400 text-4xl font-bold opacity-30">
                    {publishForm.title?.charAt(0) || '?'}
                  </div>
                )}
                <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                  publishForm.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {publishForm.status}
                </span>
              </div>
              <div className="p-4">
                <h4 className="font-semibold text-gray-900 mb-1">{publishForm.title || 'Untitled'}</h4>
                <p className="text-sm text-gray-600 line-clamp-3">{publishForm.description || 'No description'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setShowPublishModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handlePublishSubmit}
            disabled={!publishForm.title || isPublishing}
            loading={isPublishing}
          >
            {editingPublished ? 'Save Changes' : 'Publish'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
