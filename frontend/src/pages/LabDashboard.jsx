import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'
import { aiApi, usersApi, labDashboardApi } from '../services/api'
import Button from '../components/Button'
import Modal from '../components/Modal'
import RichTextEditor, { RichTextContent } from '../components/RichTextEditor'
import { CalendarView } from '../components/calendar/CalendarView'
import {
  FolderKanban, Users, Sparkles, Calendar, LayoutGrid, Brain, Loader2,
  Newspaper, Target, Plus, Pencil, Trash2, ArrowRight
} from 'lucide-react'
import { format, isAfter, subDays } from 'date-fns'
import { toast } from '../store/toastStore'

export default function LabDashboard() {
  const { user } = useAuthStore()
  const { projects, fetchProjects } = useProjectStore()
  const [activeTab, setActiveTab] = useState('overview')
  const isAdmin = user?.role === 'admin'

  // AI Summary state
  const [showAiSummary, setShowAiSummary] = useState(false)
  const [aiSummary, setAiSummary] = useState(null)
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false)
  const [aiSummaryError, setAiSummaryError] = useState(null)

  // Members count
  const [memberCount, setMemberCount] = useState(0)

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

  const activeProjects = projects.filter((p) => p.status === 'active')
  const newProjects = projects.filter((p) => {
    if (!p.created_at) return false
    return isAfter(new Date(p.created_at), subDays(new Date(), 14))
  })

  useEffect(() => {
    document.title = 'Dashboard - Stats Lab'
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  // Fetch member count
  useEffect(() => {
    usersApi.team()
      .then(({ data }) => setMemberCount(data.total || data.users?.length || 0))
      .catch(() => {})
  }, [])

  // Fetch lab dashboard content (goal)
  useEffect(() => {
    labDashboardApi.getContent()
      .then(({ data }) => {
        if (data.content?.goal) setGoal(data.content.goal)
      })
      .catch(() => {})
  }, [])

  // Fetch news
  useEffect(() => {
    labDashboardApi.getNews()
      .then(({ data }) => setNews(data.news || []))
      .catch(() => toast.error('Failed to load news'))
      .finally(() => setLoadingNews(false))
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
    } catch {
      toast.error('Failed to update goal')
    } finally {
      setSavingGoal(false)
    }
  }

  const openNewsModal = (item = null) => {
    if (item) {
      setEditingNews(item)
      setNewsForm({ title: item.title, body: item.body })
    } else {
      setEditingNews(null)
      setNewsForm({ title: '', body: '' })
    }
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
    } catch {
      toast.error('Failed to save news')
    } finally {
      setSavingNews(false)
    }
  }

  const handleDeleteNews = async (id) => {
    if (!confirm('Delete this news item?')) return
    try {
      await labDashboardApi.deleteNews(id)
      setNews(prev => prev.filter(n => n.id !== id))
      toast.success('News deleted')
    } catch {
      toast.error('Failed to delete news')
    }
  }

  return (
    <div className="space-y-8">
      {/* Simple Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl md:text-3xl text-text-primary dark:text-gray-100">
              Lab Dashboard
            </h1>
            <p className="text-text-secondary dark:text-gray-400 mt-1">
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </p>
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

      {/* 2 Stat Cards */}
      <div className="grid grid-cols-2 gap-4">
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
              <Users size={20} className="text-secondary-600 dark:text-secondary-300" />
            </div>
            <p className="text-3xl font-display font-bold text-text-primary dark:text-gray-100">{memberCount}</p>
            <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">Total Members</p>
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
          {/* Stats Lab Goal */}
          <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target size={20} className="text-primary-600 dark:text-primary-400" />
                <h2 className="font-display font-bold text-lg text-text-primary dark:text-gray-100">Stats Lab Goal</h2>
              </div>
              {isAdmin && !editingGoal && (
                <Button variant="ghost" size="sm" onClick={() => { setGoalDraft(goal); setEditingGoal(true) }}>
                  <Pencil size={14} />
                  Edit
                </Button>
              )}
            </div>
            {editingGoal ? (
              <div className="space-y-3">
                <RichTextEditor
                  value={goalDraft}
                  onChange={setGoalDraft}
                  placeholder="Describe the lab's current goal..."
                  minHeight="120px"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setEditingGoal(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleSaveGoal} loading={savingGoal}>Save</Button>
                </div>
              </div>
            ) : (
              <RichTextContent content={goal} className="text-text-secondary dark:text-gray-300" />
            )}
          </section>

          {/* New Projects Banner */}
          {newProjects.length > 0 && (
            <section className="bg-gradient-to-r from-primary-50 dark:from-primary-900/20 to-secondary-50 dark:to-secondary-900/20 rounded-xl border border-primary-200 dark:border-primary-800 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={18} className="text-primary-600 dark:text-primary-400" />
                <h2 className="font-display font-semibold text-text-primary dark:text-gray-100">New Projects</h2>
                <span className="ml-1 px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-xs font-medium">
                  {newProjects.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {newProjects.map(p => (
                  <Link
                    key={p.id}
                    to={`/dashboard/projects/${p.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-text-primary dark:text-gray-200 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-sm transition-all"
                  >
                    <FolderKanban size={14} className="text-primary-500" />
                    {p.title}
                    <ArrowRight size={12} className="text-gray-400" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Latest News */}
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
                          <button
                            onClick={() => openNewsModal(item)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteNews(item.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
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
        </>
      ) : (
        /* Calendar Tab */
        <section>
          <CalendarView scope="lab" />
        </section>
      )}

      {/* News Modal */}
      <Modal
        isOpen={showNewsModal}
        onClose={() => setShowNewsModal(false)}
        title={editingNews ? 'Edit News' : 'Post News'}
      >
        <form onSubmit={handleSaveNews} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1.5">Title</label>
            <input
              type="text"
              value={newsForm.title}
              onChange={(e) => setNewsForm(f => ({ ...f, title: e.target.value }))}
              placeholder="News title..."
              required
              className="w-full px-4 py-2.5 rounded-organic border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1.5">Body</label>
            <textarea
              value={newsForm.body}
              onChange={(e) => setNewsForm(f => ({ ...f, body: e.target.value }))}
              placeholder="What's the news?"
              rows={4}
              required
              className="w-full px-4 py-2.5 rounded-organic border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowNewsModal(false)}>Cancel</Button>
            <Button type="submit" loading={savingNews}>{editingNews ? 'Update' : 'Post'}</Button>
          </div>
        </form>
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
