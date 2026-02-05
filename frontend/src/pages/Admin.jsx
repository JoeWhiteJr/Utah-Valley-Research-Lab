import { useState, useEffect } from 'react'
import { useAdminStore } from '../store/adminStore'
import { useApplicationStore } from '../store/applicationStore'
import { useAuthStore } from '../store/authStore'
import { usersApi } from '../services/api'
import Button from '../components/Button'
import Modal from '../components/Modal'
import { LayoutDashboard, Users, ScrollText, Trash2, Sparkles } from 'lucide-react'

export default function Admin() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const { stats, fetchStats } = useAdminStore()
  const { applications, fetchApplications, approveApplication, rejectApplication, requestAiReview, aiReview } = useApplicationStore()
  const { user } = useAuthStore()

  // Team state
  const [teamMembers, setTeamMembers] = useState([])
  const [isLoadingTeam, setIsLoadingTeam] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewingAppId, setReviewingAppId] = useState(null)
  const [isReviewing, setIsReviewing] = useState(false)

  const isSuperAdmin = user?.is_super_admin === true

  useEffect(() => { fetchStats(); fetchApplications() }, [fetchStats, fetchApplications])

  useEffect(() => {
    if (activeTab === 'team') {
      loadTeam()
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

  const isAdminRoleChange = (currentRole, newRole) => {
    return currentRole === 'admin' || newRole === 'admin'
  }

  const handleAiReview = async (app) => {
    setReviewingAppId(app.id)
    setIsReviewing(true)
    setShowReviewModal(true)
    const review = await requestAiReview(app.id)
    setIsReviewing(false)
  }

  return (
    <div>
      <h1 className="font-display font-bold text-2xl mb-6">Admin Dashboard</h1>
      <div className="flex gap-2 border-b mb-6">
        {[['dashboard', 'Dashboard', LayoutDashboard], ['applications', 'Applications', Users], ['team', 'Team', Users]].map(([id, label, Icon]) => (
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
    </div>
  )
}
