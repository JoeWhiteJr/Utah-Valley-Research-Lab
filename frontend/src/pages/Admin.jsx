import { useState, useEffect, useCallback } from 'react'
import { useAdminStore } from '../store/adminStore'
import { useApplicationStore } from '../store/applicationStore'
import { useAuthStore } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'
import { usePublishStore } from '../store/publishStore'
import { useNotificationStore } from '../store/notificationStore'
import { usersApi, projectsApi } from '../services/api'
import { toast } from '../store/toastStore'
import Button from '../components/Button'
import Modal from '../components/Modal'
import { LayoutDashboard, Users, Trash2, Sparkles, Globe, Pencil, XCircle, BrainCircuit, Calendar, FolderKanban, FileEdit, UserCircle } from 'lucide-react'
import SiteContentTab from '../components/admin/SiteContentTab'
import PublicTeamTab from '../components/admin/PublicTeamTab'
import TrashTab from '../components/admin/TrashTab'

export default function Admin() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const { stats, fetchStats, aiSummary, aiSummaryLoading, aiSummaryError, fetchAiSummary, clearAiSummary } = useAdminStore()
  const { applications, fetchApplications, approveApplication, rejectApplication, requestAiReview, aiReview } = useApplicationStore()
  const { user } = useAuthStore()
  const { projects, fetchProjects } = useProjectStore()
  const { publishedProjects, fetchPublishedProjects, publishProject, updatePublishedProject, unpublishProject } = usePublishStore()
  const { unreadCountsByType, fetchUnreadCountsByType, markReadByType } = useNotificationStore()

  const tabNotifications = {
    applications: (unreadCountsByType.application || 0) > 0,
    projects: (unreadCountsByType.join_request || 0) > 0,
  }

  // Team state
  const [teamMembers, setTeamMembers] = useState([])
  const [isLoadingTeam, setIsLoadingTeam] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  const [teamPage, setTeamPage] = useState(0)
  const TEAM_PAGE_SIZE = 20
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
  const [summaryDateRange, setSummaryDateRange] = useState('week')

  const isSuperAdmin = user?.is_super_admin === true

  useEffect(() => {
    document.title = 'Admin - Stats Lab'
  }, [])

  useEffect(() => { fetchStats(); fetchApplications(); fetchUnreadCountsByType() }, [fetchStats, fetchApplications, fetchUnreadCountsByType])

  const loadTeam = useCallback(async () => {
    setIsLoadingTeam(true)
    try {
      const { data } = await usersApi.list()
      setTeamMembers(data.users)
    } catch {
      toast.error('Failed to load team members')
    }
    setIsLoadingTeam(false)
  }, [])

  useEffect(() => {
    if (activeTab === 'team') {
      loadTeam()
    }
    if (activeTab === 'publish' || activeTab === 'projects') {
      fetchProjects()
      if (activeTab === 'publish') fetchPublishedProjects()
      if (activeTab === 'projects') loadTeam()
    }
    // Mark relevant notifications as read when switching to the tab
    if (activeTab === 'applications') {
      markReadByType('application')
    }
    if (activeTab === 'projects') {
      markReadByType('join_request')
    }
  }, [activeTab, fetchProjects, fetchPublishedProjects, loadTeam, markReadByType])

  const handleRoleChange = async (userId, newRole) => {
    try {
      await usersApi.updateRole(userId, newRole)
      setTeamMembers((members) =>
        members.map((m) => (m.id === userId ? { ...m, role: newRole } : m))
      )
    } catch {
      toast.error('Failed to update role')
    }
  }

  const handleDeleteMember = async (userId) => {
    try {
      await usersApi.delete(userId)
      setTeamMembers((members) => members.filter((m) => m.id !== userId))
      setShowDeleteConfirm(null)
    } catch {
      toast.error('Failed to remove team member')
    }
  }

  const handleAiReview = async (app) => {
    setReviewingAppId(app.id)
    setIsReviewing(true)
    setShowReviewModal(true)
    await requestAiReview(app.id)
    setIsReviewing(false)
  }

  const handleGenerateSummary = () => { fetchAiSummary(summaryDateRange) }

  const parseSummary = (summaryText) => {
    if (!summaryText) return []
    const sections = summaryText.split(/^## /m).filter(Boolean)
    return sections.map((section) => {
      const lines = section.split('\n')
      const title = lines[0].trim()
      const content = lines.slice(1).join('\n').trim()
      return { title, content }
    })
  }

  const getSectionStyle = (title) => {
    const lower = title.toLowerCase()
    if (lower.includes('has been done') || lower.includes('completed') || lower.includes('done'))
      return { border: 'border-green-200 dark:border-green-700', bg: 'bg-green-50 dark:bg-green-900/30', header: 'text-green-800 dark:text-green-300' }
    if (lower.includes('currently') || lower.includes('in progress') || lower.includes('being done'))
      return { border: 'border-blue-200 dark:border-blue-700', bg: 'bg-blue-50 dark:bg-blue-900/30', header: 'text-blue-800 dark:text-blue-300' }
    if (lower.includes('needs to be done') || lower.includes('pending') || lower.includes('still'))
      return { border: 'border-amber-200 dark:border-amber-700', bg: 'bg-amber-50 dark:bg-amber-900/30', header: 'text-amber-800 dark:text-amber-300' }
    return { border: 'border-gray-200 dark:border-gray-700', bg: 'bg-gray-50 dark:bg-gray-900', header: 'text-gray-800 dark:text-gray-300' }
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
      <h1 className="font-display font-bold text-2xl mb-6 text-text-primary dark:text-gray-100">Admin Dashboard</h1>
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 mb-6">
        {[['dashboard', 'Dashboard', LayoutDashboard], ['applications', 'Applications', Users], ['team', 'Team', Users], ['projects', 'Projects', FolderKanban], ['publish', 'Publish', Globe], ['trash', 'Trash', Trash2], ['site-content', 'Site Content', FileEdit], ['public-team', 'Public Team', UserCircle]].map(([id, label, Icon]) => (
          <button key={id} onClick={() => setActiveTab(id)} className={`flex items-center gap-2 px-4 py-3 border-b-2 text-text-secondary dark:text-gray-400 ${activeTab === id ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent'}`}>
            <Icon size={18} />{label}
            {tabNotifications[id] && (
              <span className="w-2 h-2 rounded-full bg-red-500 ml-1 flex-shrink-0" />
            )}
          </button>
        ))}
      </div>
      {activeTab === 'dashboard' && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-text-secondary dark:text-gray-400">Users</div>
              <div className="text-3xl font-bold text-text-primary dark:text-gray-100">
                {stats ? stats.users?.total_users || 0 : <span className="inline-block h-8 w-16 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-text-secondary dark:text-gray-400">Pending</div>
              <div className="text-3xl font-bold text-text-primary dark:text-gray-100">
                {stats ? stats.applications?.pending || 0 : <span className="inline-block h-8 w-16 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-text-secondary dark:text-gray-400">Projects</div>
              <div className="text-3xl font-bold text-text-primary dark:text-gray-100">
                {stats ? stats.projects?.active || 0 : <span className="inline-block h-8 w-16 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-text-secondary dark:text-gray-400">Messages</div>
              <div className="text-3xl font-bold text-text-primary dark:text-gray-100">
                {stats ? stats.chats?.messages_this_week || 0 : <span className="inline-block h-8 w-16 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />}
              </div>
            </div>
          </div>
          <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl border border-purple-200 dark:border-purple-700 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-50 dark:from-purple-900/30 to-indigo-50 dark:to-indigo-900/30 px-6 py-4 border-b border-purple-200 dark:border-purple-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg"><BrainCircuit size={24} className="text-purple-600 dark:text-purple-300" /></div>
                  <div>
                    <h2 className="font-display font-semibold text-lg text-purple-900 dark:text-purple-200">AI Lab Activity Summary</h2>
                    <p className="text-sm text-purple-600 dark:text-purple-400">Generate an AI-powered overview of lab activity</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-purple-500 dark:text-purple-400" />
                    <select value={summaryDateRange} onChange={(e) => setSummaryDateRange(e.target.value)} className="px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-700 text-sm bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-300">
                      <option value="week">This Week</option>
                      <option value="month">This Month</option>
                      <option value="all">All Time</option>
                    </select>
                  </div>
                  <button onClick={handleGenerateSummary} disabled={aiSummaryLoading} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    {aiSummaryLoading ? (<><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />Generating...</>) : (<><Sparkles size={16} />Generate AI Summary</>)}
                  </button>
                </div>
              </div>
            </div>
            <div className="p-6">
              {aiSummaryError && (<div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg"><p className="text-sm text-red-700 dark:text-red-400">{aiSummaryError}</p></div>)}
              {aiSummaryLoading && (<div className="flex flex-col items-center justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-3 border-purple-200 dark:border-purple-700 border-t-purple-600 dark:border-t-purple-400 mb-4" /><p className="text-text-secondary dark:text-gray-400 text-sm">Analyzing lab activity and generating summary...</p><p className="text-text-secondary dark:text-gray-400 text-xs mt-1">This may take a few seconds</p></div>)}
              {!aiSummaryLoading && aiSummary && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs text-text-secondary dark:text-gray-400">Generated {new Date(aiSummary.generatedAt).toLocaleString()} | Range: {aiSummary.dateRange === 'week' ? 'This Week' : aiSummary.dateRange === 'month' ? 'This Month' : 'All Time'}</p>
                    <button onClick={clearAiSummary} className="text-xs text-text-secondary dark:text-gray-400 hover:text-text-primary dark:hover:text-gray-100">Clear</button>
                  </div>
                  <div className="space-y-4">
                    {parseSummary(aiSummary.summary).map((section, index) => {
                      const style = getSectionStyle(section.title)
                      return (<div key={index} className={`rounded-lg border ${style.border} ${style.bg} p-4`}><h3 className={`font-semibold text-base mb-2 ${style.header}`}>{section.title}</h3><div className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300 dark:prose-invert"><div className="whitespace-pre-wrap text-sm leading-relaxed">{section.content}</div></div></div>)
                    })}
                  </div>
                  {aiSummary.usage && (<p className="text-xs text-text-secondary dark:text-gray-400 mt-4">Tokens used: {aiSummary.usage.input_tokens || 0} input / {aiSummary.usage.output_tokens || 0} output</p>)}
                </div>
              )}
              {!aiSummaryLoading && !aiSummary && !aiSummaryError && (
                <div className="text-center py-10">
                  <BrainCircuit size={40} className="mx-auto text-purple-300 dark:text-purple-600 mb-3" />
                  <p className="text-text-secondary dark:text-gray-400 text-sm">Click &quot;Generate AI Summary&quot; to create an AI-powered overview of your lab&apos;s activity.</p>
                  <p className="text-text-secondary dark:text-gray-400 text-xs mt-1">The summary will show what has been done, what is in progress, and what still needs attention.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {activeTab === 'applications' && (
        <div className="space-y-3">
          {applications.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
              <Users size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <h3 className="font-display font-semibold text-lg text-text-primary dark:text-gray-100 mb-1">No pending applications</h3>
              <p className="text-text-secondary dark:text-gray-400 text-sm">There are no applications to review at this time.</p>
            </div>
          )}
          {applications.map((app) => (
            <div key={app.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <div className="font-medium text-text-primary dark:text-gray-100">{app.name}</div>
                <div className="text-sm text-text-secondary dark:text-gray-400">{app.email}</div>
                <div className="text-sm text-text-secondary dark:text-gray-400 mt-1">{app.message?.slice(0, 100)}...</div>
              </div>
              {app.status === 'pending' && (
                <div className="flex gap-2">
                  <button onClick={() => handleAiReview(app)} className="flex items-center gap-1 px-3 py-1 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600">
                    <Sparkles size={14} />
                    AI Review
                  </button>
                  <button onClick={() => { approveApplication(app.id, 'researcher').then(() => fetchUnreadCountsByType()) }} className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm">Approve</button>
                  <button onClick={() => { rejectApplication(app.id).then(() => fetchUnreadCountsByType()) }} className="px-3 py-1 bg-red-500 text-white rounded-lg text-sm">Reject</button>
                </div>
              )}
              {app.status !== 'pending' && <span className={`px-2 py-1 rounded text-xs ${app.status === 'approved' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>{app.status}</span>}
            </div>
          ))}
        </div>
      )}
      {activeTab === 'team' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display font-semibold text-lg text-text-primary dark:text-gray-100">Team Members</h2>
            {teamMembers.length > 0 && (
              <span className="text-sm text-text-secondary dark:text-gray-400">{teamMembers.length} total</span>
            )}
          </div>
          {isLoadingTeam ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {teamMembers.slice(teamPage * TEAM_PAGE_SIZE, (teamPage + 1) * TEAM_PAGE_SIZE).map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                      <span className="text-primary-700 dark:text-primary-300 font-medium">
                        {member.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-text-primary dark:text-gray-100">{member.name}</p>
                      <p className="text-sm text-text-secondary dark:text-gray-400">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.id, e.target.value)}
                      disabled={member.id === user.id || (!isSuperAdmin && (member.role === 'admin' || false))}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        className="p-2 rounded-lg text-text-secondary dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {teamMembers.length > TEAM_PAGE_SIZE && (
                <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-text-secondary dark:text-gray-400">
                    Showing {teamPage * TEAM_PAGE_SIZE + 1}–{Math.min((teamPage + 1) * TEAM_PAGE_SIZE, teamMembers.length)} of {teamMembers.length}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTeamPage(p => p - 1)}
                      disabled={teamPage === 0}
                      className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-text-secondary dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setTeamPage(p => p + 1)}
                      disabled={(teamPage + 1) * TEAM_PAGE_SIZE >= teamMembers.length}
                      className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-text-secondary dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Publish Tab */}
      {activeTab === 'projects' && (
        <div className="space-y-4">
          <h2 className="font-display font-semibold text-lg text-text-primary dark:text-gray-100">Project Lead Assignment</h2>
          <p className="text-sm text-text-secondary dark:text-gray-400">Assign or change the lead for each project. Only admins can perform this action.</p>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary dark:text-gray-400 uppercase">Project</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary dark:text-gray-400 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary dark:text-gray-400 uppercase">Current Lead</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary dark:text-gray-400 uppercase">Assign Lead</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id} className="border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <td className="px-4 py-3">
                      <span className="font-medium text-text-primary dark:text-gray-100">{project.title}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                        project.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                        project.status === 'completed' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                        'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}>{project.status}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary dark:text-gray-400">
                      {project.lead_name || project.creator_name || 'None'}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={project.lead_id || ''}
                        onChange={async (e) => {
                          if (e.target.value) {
                            await projectsApi.setLead(project.id, e.target.value)
                            fetchProjects()
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                      >
                        <option value="">Select lead...</option>
                        {teamMembers.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {projects.length === 0 && (
              <div className="p-8 text-center text-text-secondary dark:text-gray-400">No projects found.</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'publish' && (
        <div>
          <h2 className="font-display font-semibold text-lg mb-6 text-text-primary dark:text-gray-100">Publish Team Projects</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => {
              const pp = publishedMap[project.id]
              const isPublished = !!pp
              return (
                <div key={project.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  {/* Image */}
                  <div className="h-32 bg-gradient-to-br from-primary-100 dark:from-primary-900/30 to-primary-200 dark:to-primary-800/30 flex items-center justify-center relative">
                    {(isPublished ? pp.published_image : project.header_image) ? (
                      <img
                        src={isPublished ? pp.published_image : project.header_image}
                        alt={project.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-primary-400 dark:text-primary-600 text-4xl font-bold opacity-30">{project.title?.charAt(0)}</div>
                    )}
                    {isPublished && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 bg-green-500 text-white rounded-full text-xs font-medium">
                        Published
                      </span>
                    )}
                    <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                      project.status === 'active' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                      project.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                      'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}>
                      {project.status}
                    </span>
                  </div>
                  {/* Content */}
                  <div className="p-4">
                    <h3 className="font-semibold text-text-primary dark:text-gray-100 mb-1 truncate">{project.title}</h3>
                    <p className="text-sm text-text-secondary dark:text-gray-400 line-clamp-2 mb-3">{project.description}</p>
                    <div className="flex gap-2">
                      {isPublished ? (
                        <>
                          <button
                            onClick={() => openEditModal(pp)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-lg text-sm hover:bg-primary-100 dark:hover:bg-primary-900/50"
                          >
                            <Pencil size={14} /> Edit
                          </button>
                          <button
                            onClick={() => setShowUnpublishConfirm(pp)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm hover:bg-red-100 dark:hover:bg-red-900/50"
                          >
                            <XCircle size={14} /> Unpublish
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => openPublishModal(project)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-sm hover:bg-green-100 dark:hover:bg-green-900/50"
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
            <div className="text-center py-12 text-text-secondary dark:text-gray-400">No team projects found.</div>
          )}
        </div>
      )}

      {activeTab === 'trash' && <TrashTab />}
      {activeTab === 'site-content' && <SiteContentTab />}
      {activeTab === 'public-team' && <PublicTeamTab />}

      {/* Delete Member Confirmation */}
      <Modal
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        title="Remove Team Member"
        size="sm"
      >
        <p className="text-text-secondary dark:text-gray-400">
          Are you sure you want to remove <strong className="text-text-primary dark:text-gray-100">{showDeleteConfirm?.name}</strong> from the team?
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
            <span className="ml-3 text-text-secondary dark:text-gray-400">Analyzing application...</span>
          </div>
        ) : aiReview ? (
          <div>
            <div className="mb-3">
              <span className="text-sm text-text-secondary dark:text-gray-400">Applicant: </span>
              <span className="font-medium text-text-primary dark:text-gray-100">{applications.find(a => a.id === reviewingAppId)?.name}</span>
            </div>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <p className="text-text-secondary dark:text-gray-400 whitespace-pre-wrap">{typeof aiReview === 'string' ? aiReview : aiReview.summary || JSON.stringify(aiReview, null, 2)}</p>
            </div>
          </div>
        ) : (
          <p className="text-text-secondary dark:text-gray-400">No review available.</p>
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
        <p className="text-text-secondary dark:text-gray-400">
          Are you sure you want to unpublish <strong className="text-text-primary dark:text-gray-100">{showUnpublishConfirm?.published_title}</strong>?
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
              <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1">Title</label>
              <input
                type="text"
                value={publishForm.title}
                onChange={(e) => setPublishForm({ ...publishForm, title: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1">Description</label>
              <textarea
                value={publishForm.description}
                onChange={(e) => setPublishForm({ ...publishForm, description: e.target.value })}
                rows={5}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1">Image URL</label>
              <input
                type="text"
                value={publishForm.image}
                onChange={(e) => setPublishForm({ ...publishForm, image: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1">Status</label>
              <select
                value={publishForm.status}
                onChange={(e) => setPublishForm({ ...publishForm, status: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          {/* Live Preview */}
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-2">Preview</label>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="h-32 bg-gradient-to-br from-blue-100 dark:from-blue-900/30 to-blue-200 dark:to-blue-800/30 flex items-center justify-center relative">
                {publishForm.image ? (
                  <img
                    src={publishForm.image}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.style.display = 'none' }}
                  />
                ) : (
                  <div className="text-blue-400 dark:text-blue-600 text-4xl font-bold opacity-30">
                    {publishForm.title?.charAt(0) || '?'}
                  </div>
                )}
                <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                  publishForm.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                }`}>
                  {publishForm.status}
                </span>
              </div>
              <div className="p-4">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{publishForm.title || 'Untitled'}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">{publishForm.description || 'No description'}</p>
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
