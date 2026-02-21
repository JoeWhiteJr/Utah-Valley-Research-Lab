import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'
import { aiApi, usersApi, labDashboardApi, resourcesApi } from '../services/api'
import { getUploadUrl } from '../services/api'
import Button from '../components/Button'
import Modal from '../components/Modal'
import ProjectPreviewModal from '../components/ProjectPreviewModal'
import RichTextEditor, { RichTextContent } from '../components/RichTextEditor'
import { CalendarView } from '../components/calendar/CalendarView'
import {
  FolderKanban, Users, Sparkles, Calendar, LayoutGrid, Brain, Loader2,
  Newspaper, Target, Plus, Pencil, Trash2, Library,
  Mail, BookOpen, GraduationCap, ExternalLink
} from 'lucide-react'
import { format, isAfter, subDays } from 'date-fns'
import { toast } from '../store/toastStore'
import { PROJECT_STATUS_COLORS } from '../constants'

function LinkListEditor({ items, onSave, saving }) {
  const [list, setList] = useState(items || [])
  const [editIndex, setEditIndex] = useState(null)
  const [form, setForm] = useState({ title: '', url: '', description: '' })

  useEffect(() => { setList(items || []) }, [items])

  const openAdd = () => { setEditIndex(-1); setForm({ title: '', url: '', description: '' }) }
  const openEdit = (i) => { setEditIndex(i); setForm(list[i]) }

  const handleSave = () => {
    if (!form.title.trim() || !form.url.trim()) return
    const next = editIndex === -1 ? [...list, form] : list.map((item, i) => i === editIndex ? form : item)
    setList(next)
    setEditIndex(null)
    onSave(next)
  }

  const handleDelete = (i) => {
    const next = list.filter((_, idx) => idx !== i)
    setList(next)
    onSave(next)
  }

  return (
    <div className="space-y-3">
      {list.map((item, i) => (
        <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="flex-1 min-w-0">
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1">
              {item.title} <ExternalLink size={12} />
            </a>
            {item.description && <p className="text-sm text-text-secondary dark:text-gray-400 mt-0.5">{item.description}</p>}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => openEdit(i)} className="p-1 rounded text-gray-400 hover:text-primary-600 transition-colors"><Pencil size={14} /></button>
            <button onClick={() => handleDelete(i)} className="p-1 rounded text-gray-400 hover:text-red-600 transition-colors"><Trash2 size={14} /></button>
          </div>
        </div>
      ))}
      {editIndex !== null ? (
        <div className="p-3 border border-primary-200 dark:border-primary-800 rounded-lg space-y-2">
          <input type="text" placeholder="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
          <input type="url" placeholder="URL" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
          <input type="text" placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEditIndex(null)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} loading={saving}>Save</Button>
          </div>
        </div>
      ) : (
        <button onClick={openAdd} className="flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium">
          <Plus size={14} /> Add link
        </button>
      )}
    </div>
  )
}

export default function LabDashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { projects, fetchProjects } = useProjectStore()
  const [activeTab, setActiveTab] = useState('overview')
  const isAdmin = user?.role === 'admin'

  // AI Summary state
  const [showAiSummary, setShowAiSummary] = useState(false)
  const [aiSummary, setAiSummary] = useState(null)
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false)
  const [aiSummaryError, setAiSummaryError] = useState(null)

  // Members
  const [memberCount, setMemberCount] = useState(0)
  const [members, setMembers] = useState([])
  const [loadingMembers, setLoadingMembers] = useState(true)

  // Lab goal
  const [goal, setGoal] = useState('')
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalDraft, setGoalDraft] = useState('')
  const [savingGoal, setSavingGoal] = useState(false)

  // News
  const [news, setNews] = useState([])
  const [loadingNews, setLoadingNews] = useState(true)
  const [showNewsModal, setShowNewsModal] = useState(false)
  const [editingNews, setEditingNews] = useState(null)
  const [newsForm, setNewsForm] = useState({ title: '', body: '' })
  const [savingNews, setSavingNews] = useState(false)

  // New projects preview modal
  const [previewProject, setPreviewProject] = useState(null)

  // Resources tab state
  const [resourcesLoading, setResourcesLoading] = useState(true)
  const [contactInfo, setContactInfo] = useState('')
  const [researchLinks, setResearchLinks] = useState([])
  const [learningLinks, setLearningLinks] = useState([])
  const [editingContact, setEditingContact] = useState(false)
  const [contactDraft, setContactDraft] = useState('')
  const [savingContact, setSavingContact] = useState(false)
  const [savingLinks, setSavingLinks] = useState(false)

  const activeProjects = projects.filter((p) => p.status === 'active')
  const newProjects = projects.filter((p) => {
    if (!p.created_at) return false
    return isAfter(new Date(p.created_at), subDays(new Date(), 14))
  })

  useEffect(() => { document.title = 'Dashboard - Stats Lab' }, [])
  useEffect(() => { fetchProjects() }, [fetchProjects])

  // Fetch members (used for count + resources directory)
  useEffect(() => {
    usersApi.team()
      .then(({ data }) => {
        setMemberCount(data.total || data.users?.length || 0)
        setMembers(data.users || [])
      })
      .catch(() => {})
      .finally(() => setLoadingMembers(false))
  }, [])

  // Fetch lab dashboard content (goal)
  useEffect(() => {
    labDashboardApi.getContent()
      .then(({ data }) => { if (data.content?.goal) setGoal(data.content.goal) })
      .catch(() => {})
  }, [])

  // Fetch news
  useEffect(() => {
    labDashboardApi.getNews()
      .then(({ data }) => setNews(data.news || []))
      .catch(() => toast.error('Failed to load news'))
      .finally(() => setLoadingNews(false))
  }, [])

  // Fetch resources content
  useEffect(() => {
    resourcesApi.getContent()
      .then(({ data }) => {
        const c = data.content || {}
        if (c.contact_info) setContactInfo(c.contact_info)
        if (c.research_links) {
          try {
            const parsed = typeof c.research_links === 'string' ? JSON.parse(c.research_links) : c.research_links
            setResearchLinks(Array.isArray(parsed) ? parsed : [])
          } catch { setResearchLinks([]) }
        }
        if (c.learning_links) {
          try {
            const parsed = typeof c.learning_links === 'string' ? JSON.parse(c.learning_links) : c.learning_links
            setLearningLinks(Array.isArray(parsed) ? parsed : [])
          } catch { setLearningLinks([]) }
        }
      })
      .catch(() => {})
      .finally(() => setResourcesLoading(false))
  }, [])

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

  const handleSaveGoal = async () => {
    setSavingGoal(true)
    try {
      await labDashboardApi.updateContent('goal', goalDraft)
      setGoal(goalDraft)
      setEditingGoal(false)
      toast.success('Lab goal updated')
    } catch { toast.error('Failed to update goal') }
    finally { setSavingGoal(false) }
  }

  const openNewsModal = (item = null) => {
    if (item) { setEditingNews(item); setNewsForm({ title: item.title, body: item.body }) }
    else { setEditingNews(null); setNewsForm({ title: '', body: '' }) }
    setShowNewsModal(true)
  }

  const handleSaveNews = async (e) => {
    e.preventDefault()
    if (!newsForm.title.trim() || !newsForm.body.trim()) return
    setSavingNews(true)
    try {
      if (editingNews) {
        const { data } = await labDashboardApi.updateNews(editingNews.id, newsForm)
        setNews(prev => prev.map(n => n.id === editingNews.id ? data.item : n))
        toast.success('News updated')
      } else {
        const { data } = await labDashboardApi.createNews(newsForm)
        setNews(prev => [data.item, ...prev])
        toast.success('News posted')
      }
      setShowNewsModal(false)
    } catch { toast.error('Failed to save news') }
    finally { setSavingNews(false) }
  }

  const handleDeleteNews = async (id) => {
    if (!confirm('Delete this news item?')) return
    try {
      await labDashboardApi.deleteNews(id)
      setNews(prev => prev.filter(n => n.id !== id))
      toast.success('News deleted')
    } catch { toast.error('Failed to delete news') }
  }

  const handleProjectClick = (project) => {
    if (user?.role === 'admin' || project.membership_status === 'member') {
      navigate(`/dashboard/projects/${project.id}`)
    } else {
      setPreviewProject(project)
    }
  }

  // Resources handlers
  const handleSaveContact = async () => {
    setSavingContact(true)
    try {
      await resourcesApi.updateContent('contact_info', contactDraft)
      setContactInfo(contactDraft)
      setEditingContact(false)
      toast.success('Contact info updated')
    } catch { toast.error('Failed to update contact info') }
    finally { setSavingContact(false) }
  }

  const handleSaveResearchLinks = async (links) => {
    setSavingLinks(true)
    try {
      await resourcesApi.updateContent('research_links', links)
      setResearchLinks(links)
      toast.success('Research links updated')
    } catch { toast.error('Failed to save links') }
    finally { setSavingLinks(false) }
  }

  const handleSaveLearningLinks = async (links) => {
    setSavingLinks(true)
    try {
      await resourcesApi.updateContent('learning_links', links)
      setLearningLinks(links)
      toast.success('Learning links updated')
    } catch { toast.error('Failed to save links') }
    finally { setSavingLinks(false) }
  }

  return (
    <div className="space-y-6">
      {/* Header row: Title + date | inline stats + AI Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl md:text-3xl text-text-primary dark:text-gray-100">
            Lab Dashboard
          </h1>
          <p className="text-text-secondary dark:text-gray-400 mt-1">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <FolderKanban size={16} className="text-primary-600 dark:text-primary-300" />
            <div>
              <p className="text-lg font-display font-bold text-text-primary dark:text-gray-100 leading-none">{activeProjects.length}</p>
              <p className="text-[11px] text-text-secondary dark:text-gray-400">Active Projects</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <Users size={16} className="text-secondary-600 dark:text-secondary-300" />
            <div>
              <p className="text-lg font-display font-bold text-text-primary dark:text-gray-100 leading-none">{memberCount}</p>
              <p className="text-[11px] text-text-secondary dark:text-gray-400">Total Members</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleGenerateDashboardSummary}
            disabled={aiSummaryLoading}
          >
            {aiSummaryLoading ? <Loader2 size={18} className="animate-spin" /> : <Brain size={18} />}
            AI Summary
          </Button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-xl p-1 w-fit">
        {[
          { key: 'overview', icon: LayoutGrid, label: 'Overview' },
          { key: 'calendar', icon: Calendar, label: 'Calendar' },
          { key: 'resources', icon: Library, label: 'Resources' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' ? (
        <>
          {/* Latest News — at the top */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Newspaper size={20} className="text-primary-600 dark:text-primary-400" />
                <h2 className="font-display font-bold text-lg text-text-primary dark:text-gray-100">Latest News</h2>
              </div>
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={() => openNewsModal()}>
                  <Plus size={14} />
                  Post News
                </Button>
              )}
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
              {loadingNews ? (
                <div className="p-6 text-center text-text-secondary dark:text-gray-400 text-sm">Loading news...</div>
              ) : news.length > 0 ? (
                news.map(item => (
                  <div key={item.id} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-text-primary dark:text-gray-100">{item.title}</h3>
                        <p className="text-sm text-text-secondary dark:text-gray-400 mt-1 line-clamp-2">{item.body}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-text-secondary dark:text-gray-500">
                          <span>{item.author_name}</span>
                          <span>&middot;</span>
                          <span>{format(new Date(item.created_at), 'MMM d, yyyy')}</span>
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => openNewsModal(item)} className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors"><Pencil size={14} /></button>
                          <button onClick={() => handleDeleteNews(item.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"><Trash2 size={14} /></button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-text-secondary dark:text-gray-400 text-sm">
                  No news posted yet
                  {isAdmin && <span className="block mt-1">Click &ldquo;Post News&rdquo; to share an update with the lab.</span>}
                </div>
              )}
            </div>
          </section>

          {/* Two-column: Stats Lab Goal (left) + New Projects (right) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Stats Lab Goal — takes 2/3 */}
            <section className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Target size={20} className="text-primary-600 dark:text-primary-400" />
                  <h2 className="font-display font-bold text-lg text-text-primary dark:text-gray-100">Stats Lab Goal</h2>
                </div>
                {isAdmin && !editingGoal && (
                  <Button variant="ghost" size="sm" onClick={() => { setGoalDraft(goal); setEditingGoal(true) }}>
                    <Pencil size={14} /> Edit
                  </Button>
                )}
              </div>
              {editingGoal ? (
                <div className="space-y-3">
                  <RichTextEditor value={goalDraft} onChange={setGoalDraft} placeholder="Describe the lab's current goal..." minHeight="120px" />
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setEditingGoal(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleSaveGoal} loading={savingGoal}>Save</Button>
                  </div>
                </div>
              ) : (
                <RichTextContent content={goal} className="text-text-secondary dark:text-gray-300" />
              )}
            </section>

            {/* New Projects — right sidebar panel */}
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-primary-600 dark:text-primary-400" />
                  <h2 className="font-display font-bold text-lg text-text-primary dark:text-gray-100">New Projects</h2>
                  {newProjects.length > 0 && (
                    <span className="ml-auto px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-xs font-medium">
                      {newProjects.length}
                    </span>
                  )}
                </div>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {newProjects.length > 0 ? (
                  newProjects.map(p => {
                    const statusColor = PROJECT_STATUS_COLORS[p.status] || PROJECT_STATUS_COLORS.active
                    return (
                      <button
                        key={p.id}
                        onClick={() => handleProjectClick(p)}
                        className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusColor}`}>
                            {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                          </span>
                          {p.membership_status === 'pending' && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">Pending</span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-text-primary dark:text-gray-100 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                          {p.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {p.lead_name && <span className="text-xs text-text-secondary dark:text-gray-400 truncate">{p.lead_name}</span>}
                          {p.member_count != null && (
                            <span className="flex items-center gap-0.5 text-xs text-text-secondary dark:text-gray-400 shrink-0">
                              <Users size={11} /> {p.member_count}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })
                ) : (
                  <div className="p-6 text-center text-sm text-text-secondary dark:text-gray-400">
                    No new projects in the last 14 days.
                  </div>
                )}
              </div>
            </section>
          </div>
        </>
      ) : activeTab === 'calendar' ? (
        <section>
          <CalendarView scope="lab" />
        </section>
      ) : (
        /* Resources Tab */
        resourcesLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-primary-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Contact Info */}
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Mail size={20} className="text-primary-600 dark:text-primary-400" />
                  <h2 className="font-display font-bold text-lg text-text-primary dark:text-gray-100">Contact Info</h2>
                </div>
                {isAdmin && !editingContact && (
                  <Button variant="ghost" size="sm" onClick={() => { setContactDraft(contactInfo); setEditingContact(true) }}>
                    <Pencil size={14} /> Edit
                  </Button>
                )}
              </div>
              {editingContact ? (
                <div className="space-y-3">
                  <RichTextEditor value={contactDraft} onChange={setContactDraft} placeholder="Enter contact information..." minHeight="120px" />
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setEditingContact(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleSaveContact} loading={savingContact}>Save</Button>
                  </div>
                </div>
              ) : contactInfo ? (
                <RichTextContent content={contactInfo} className="text-text-secondary dark:text-gray-300" />
              ) : (
                <p className="text-sm text-text-secondary dark:text-gray-400">No contact info added yet.</p>
              )}
            </section>

            {/* Research Resources */}
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen size={20} className="text-primary-600 dark:text-primary-400" />
                <h2 className="font-display font-bold text-lg text-text-primary dark:text-gray-100">Research Resources</h2>
              </div>
              {isAdmin ? (
                <LinkListEditor items={researchLinks} onSave={handleSaveResearchLinks} saving={savingLinks} />
              ) : researchLinks.length > 0 ? (
                <div className="space-y-2">
                  {researchLinks.map((item, i) => (
                    <div key={i} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1">
                        {item.title} <ExternalLink size={12} />
                      </a>
                      {item.description && <p className="text-sm text-text-secondary dark:text-gray-400 mt-0.5">{item.description}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-secondary dark:text-gray-400">No research resources added yet.</p>
              )}
            </section>

            {/* Member Directory */}
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <Users size={20} className="text-primary-600 dark:text-primary-400" />
                <h2 className="font-display font-bold text-lg text-text-primary dark:text-gray-100">Member Directory</h2>
                <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-text-secondary dark:text-gray-400 text-xs font-medium">{members.length}</span>
              </div>
              {loadingMembers ? (
                <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin text-primary-500" /></div>
              ) : members.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {members.map(m => (
                    <div key={m.id} className="flex flex-col items-center text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                      <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center overflow-hidden mb-2">
                        {m.avatar_url ? (
                          <img src={getUploadUrl(m.avatar_url)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-primary-700 dark:text-primary-300 font-medium text-lg">{m.name?.charAt(0)?.toUpperCase() || '?'}</span>
                        )}
                      </div>
                      <p className="font-medium text-sm text-text-primary dark:text-gray-100 line-clamp-1">{m.name}</p>
                      <p className="text-xs text-text-secondary dark:text-gray-400 capitalize">{m.role?.replace('_', ' ')}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-secondary dark:text-gray-400">No members found.</p>
              )}
            </section>

            {/* Stats Learning */}
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap size={20} className="text-primary-600 dark:text-primary-400" />
                <h2 className="font-display font-bold text-lg text-text-primary dark:text-gray-100">Stats Learning</h2>
              </div>
              {isAdmin ? (
                <LinkListEditor items={learningLinks} onSave={handleSaveLearningLinks} saving={savingLinks} />
              ) : learningLinks.length > 0 ? (
                <div className="space-y-2">
                  {learningLinks.map((item, i) => (
                    <div key={i} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1">
                        {item.title} <ExternalLink size={12} />
                      </a>
                      {item.description && <p className="text-sm text-text-secondary dark:text-gray-400 mt-0.5">{item.description}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-secondary dark:text-gray-400">No learning resources added yet.</p>
              )}
            </section>
          </div>
        )
      )}

      {/* News Modal */}
      <Modal isOpen={showNewsModal} onClose={() => setShowNewsModal(false)} title={editingNews ? 'Edit News' : 'Post News'}>
        <form onSubmit={handleSaveNews} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1.5">Title</label>
            <input type="text" value={newsForm.title} onChange={(e) => setNewsForm(f => ({ ...f, title: e.target.value }))} placeholder="News title..." required className="w-full px-4 py-2.5 rounded-organic border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1.5">Body</label>
            <textarea value={newsForm.body} onChange={(e) => setNewsForm(f => ({ ...f, body: e.target.value }))} placeholder="What's the news?" rows={4} required className="w-full px-4 py-2.5 rounded-organic border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowNewsModal(false)}>Cancel</Button>
            <Button type="submit" loading={savingNews}>{editingNews ? 'Update' : 'Post'}</Button>
          </div>
        </form>
      </Modal>

      {/* Project Preview Modal */}
      <ProjectPreviewModal project={previewProject} onClose={() => setPreviewProject(null)} />

      {/* AI Dashboard Summary Modal */}
      <Modal isOpen={showAiSummary} onClose={() => setShowAiSummary(false)} title="AI Dashboard Summary" size="lg">
        <div className="space-y-4">
          {aiSummaryError ? (
            <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-600 dark:text-red-400 text-sm">{aiSummaryError}</div>
          ) : aiSummary ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="p-3 bg-primary-50 dark:bg-primary-900/30 rounded-lg text-center">
                  <p className="text-xl font-bold text-primary-700 dark:text-primary-300">{aiSummary.stats?.activeProjects ?? activeProjects.length}</p>
                  <p className="text-xs text-primary-600 dark:text-primary-400">Active</p>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg text-center">
                  <p className="text-xl font-bold text-amber-700 dark:text-amber-300">{aiSummary.stats?.pendingTasks ?? 0}</p>
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
                <div className="whitespace-pre-wrap text-text-secondary dark:text-gray-400 leading-relaxed">{aiSummary.summary}</div>
              </div>
              <div className="flex justify-end pt-2">
                <Button variant="outline" size="sm" onClick={handleGenerateDashboardSummary} disabled={aiSummaryLoading}>
                  {aiSummaryLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  Regenerate
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center py-8"><Loader2 size={24} className="animate-spin text-primary-500" /></div>
          )}
        </div>
      </Modal>
    </div>
  )
}
