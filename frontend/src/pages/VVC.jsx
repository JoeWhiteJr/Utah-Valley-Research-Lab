import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../store/authStore'
import { useVvcStore } from '../store/vvcStore'
import { vvcApi } from '../services/api'
import Button from '../components/Button'
import Modal from '../components/Modal'
import Input from '../components/Input'
import VideoPlayer from '../components/VideoPlayer'
import RichTextEditor from '../components/RichTextEditor'
import { Code, Plus, Trash2, Edit3, Calendar, Upload, FileText, Sparkles, Video, ExternalLink, Image, X, Rocket } from 'lucide-react'

export default function VVC() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'

  const {
    sessions, resources, projects, isLoading,
    fetchSessions, createSession, updateSession, deleteSession, uploadVideo,
    uploadImages, deleteImage,
    fetchResources, updateResource,
    fetchProjects, createProject, updateProject, deleteProject, uploadScreenshot
  } = useVvcStore()

  // Tab state
  const [activeTab, setActiveTab] = useState('sessions')

  // Session modal state
  const [showSessionModal, setShowSessionModal] = useState(false)
  const [editingSession, setEditingSession] = useState(null)
  const [sessionForm, setSessionForm] = useState({ title: '', description: '', session_date: '', video_url: '' })
  const [videoUploadFile, setVideoUploadFile] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(null)
  const [saving, setSaving] = useState(false)

  // Session detail view state
  const [viewingSession, setViewingSession] = useState(null)
  const [detailTab, setDetailTab] = useState('summary')
  const [editTranscript, setEditTranscript] = useState('')
  const [editSummary, setEditSummary] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [detailVideoFile, setDetailVideoFile] = useState(null)
  const [detailSaving, setDetailSaving] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)

  // Resources edit state
  const [editingResource, setEditingResource] = useState(null)
  const [resourceValue, setResourceValue] = useState('')
  const [resourceSaving, setResourceSaving] = useState(false)

  // Project modal state
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [projectForm, setProjectForm] = useState({ title: '', description: '', project_url: '' })
  const [screenshotFile, setScreenshotFile] = useState(null)
  const [projectSaving, setProjectSaving] = useState(false)

  useEffect(() => { fetchSessions() }, [fetchSessions])
  useEffect(() => { fetchResources() }, [fetchResources])
  useEffect(() => { fetchProjects() }, [fetchProjects])

  // Session CRUD handlers
  const handleOpenSessionModal = useCallback((session) => {
    if (session) {
      setSessionForm({
        title: session.title || '',
        description: session.description || '',
        session_date: session.session_date ? session.session_date.split('T')[0] : '',
        video_url: session.video_url || ''
      })
      setEditingSession(session)
    } else {
      setSessionForm({ title: '', description: '', session_date: '', video_url: '' })
      setEditingSession(null)
    }
    setVideoUploadFile(null)
    setUploadProgress(null)
    setShowSessionModal(true)
  }, [])

  const handleSaveSession = useCallback(async () => {
    setSaving(true)
    try {
      let session
      if (editingSession) {
        session = await updateSession(editingSession.id, sessionForm)
      } else {
        session = await createSession(sessionForm)
      }
      if (videoUploadFile && session) {
        await uploadVideo(session.id, videoUploadFile, setUploadProgress)
      }
      setShowSessionModal(false)
      setVideoUploadFile(null)
      setUploadProgress(null)
    } finally {
      setSaving(false)
    }
  }, [editingSession, sessionForm, videoUploadFile, updateSession, createSession, uploadVideo])

  const handleDeleteSession = useCallback(async (id) => {
    if (!window.confirm('Delete this session?')) return
    await deleteSession(id)
  }, [deleteSession])

  // Session detail handlers
  const handleOpenDetail = useCallback((session) => {
    setViewingSession(session)
    setEditTranscript(session.transcript || '')
    setEditSummary(session.summary || '')
    setEditNotes(session.notes || '')
    setDetailTab('summary')
    setDetailVideoFile(null)
  }, [])

  const handleSaveDetail = useCallback(async () => {
    setDetailSaving(true)
    try {
      await updateSession(viewingSession.id, {
        transcript: editTranscript,
        summary: editSummary,
        notes: editNotes
      })
      if (detailVideoFile) {
        await uploadVideo(viewingSession.id, detailVideoFile)
      }
      setViewingSession(null)
      setDetailVideoFile(null)
    } finally {
      setDetailSaving(false)
    }
  }, [viewingSession, editTranscript, editSummary, editNotes, detailVideoFile, updateSession, uploadVideo])

  const handleUploadImages = useCallback(async (files) => {
    if (!viewingSession || !files || files.length === 0) return
    setImageUploading(true)
    try {
      const result = await uploadImages(viewingSession.id, Array.from(files))
      // Update the viewing session with new images
      setViewingSession(prev => prev ? { ...prev, images: result?.images || prev.images } : null)
    } finally {
      setImageUploading(false)
    }
  }, [viewingSession, uploadImages])

  const handleDeleteImage = useCallback(async (imageId) => {
    if (!viewingSession) return
    await deleteImage(viewingSession.id, imageId)
    setViewingSession(prev => prev ? { ...prev, images: (prev.images || []).filter(img => img.id !== imageId) } : null)
  }, [viewingSession, deleteImage])

  // Resource handlers
  const handleEditResource = useCallback((key) => {
    setEditingResource(key)
    const val = resources[key]
    setResourceValue(typeof val === 'string' ? val : JSON.stringify(val, null, 2))
  }, [resources])

  const handleSaveResource = useCallback(async () => {
    setResourceSaving(true)
    try {
      await updateResource(editingResource, resourceValue)
      setEditingResource(null)
    } finally {
      setResourceSaving(false)
    }
  }, [editingResource, resourceValue, updateResource])

  // Project handlers
  const handleOpenProjectModal = useCallback((project) => {
    if (project) {
      setProjectForm({
        title: project.title || '',
        description: project.description || '',
        project_url: project.project_url || ''
      })
      setEditingProject(project)
    } else {
      setProjectForm({ title: '', description: '', project_url: '' })
      setEditingProject(null)
    }
    setScreenshotFile(null)
    setShowProjectModal(true)
  }, [])

  const handleSaveProject = useCallback(async () => {
    setProjectSaving(true)
    try {
      let project
      if (editingProject) {
        project = await updateProject(editingProject.id, projectForm)
      } else {
        project = await createProject(projectForm)
      }
      if (screenshotFile && project) {
        await uploadScreenshot(project.id, screenshotFile)
      }
      setShowProjectModal(false)
      setScreenshotFile(null)
    } finally {
      setProjectSaving(false)
    }
  }, [editingProject, projectForm, screenshotFile, updateProject, createProject, uploadScreenshot])

  const handleDeleteProject = useCallback(async (id) => {
    if (!window.confirm('Delete this project?')) return
    await deleteProject(id)
  }, [deleteProject])

  const formatDate = (dateStr) => {
    if (!dateStr) return null
    const d = new Date(dateStr.split('T')[0] + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center">
            <Code className="text-primary-600 dark:text-primary-400" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-text-primary dark:text-gray-100">Vasu&apos;s Vibe Coding</h1>
            <p className="text-sm text-text-secondary dark:text-gray-400">Learn to vibe code with Claude Code</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('sessions')}
          className={`px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'sessions'
              ? 'text-primary-600 dark:text-primary-300 border-b-2 border-primary-500'
              : 'text-text-secondary dark:text-gray-400 hover:text-text-primary dark:hover:text-gray-200'
          }`}
        >
          Sessions
        </button>
        <button
          onClick={() => setActiveTab('projects')}
          className={`px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'projects'
              ? 'text-primary-600 dark:text-primary-300 border-b-2 border-primary-500'
              : 'text-text-secondary dark:text-gray-400 hover:text-text-primary dark:hover:text-gray-200'
          }`}
        >
          Projects
        </button>
        <button
          onClick={() => setActiveTab('resources')}
          className={`px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'resources'
              ? 'text-primary-600 dark:text-primary-300 border-b-2 border-primary-500'
              : 'text-text-secondary dark:text-gray-400 hover:text-text-primary dark:hover:text-gray-200'
          }`}
        >
          Resources
        </button>
      </div>

      {/* Sessions Tab */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          {isAdmin && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => handleOpenSessionModal(null)}>
                <Plus size={14} className="mr-1" /> Add Session
              </Button>
            </div>
          )}

          {sessions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleOpenDetail(session)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-display font-semibold text-text-primary dark:text-gray-100 line-clamp-2">{session.title}</h3>
                    {isAdmin && (
                      <div className="flex gap-1 flex-shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => handleOpenSessionModal(session)} title="Edit"
                          className="p-1.5 rounded-lg text-text-secondary hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors">
                          <Edit3 size={14} />
                        </button>
                        <button onClick={() => handleDeleteSession(session.id)} title="Delete"
                          className="p-1.5 rounded-lg text-text-secondary hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {session.session_date && (
                    <div className="flex items-center gap-1.5 text-xs text-text-secondary dark:text-gray-400 mb-2">
                      <Calendar size={12} />
                      {formatDate(session.session_date)}
                    </div>
                  )}

                  {session.description && (
                    <p className="text-sm text-text-secondary dark:text-gray-400 line-clamp-2 mb-3">{session.description}</p>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    {(session.video_url || session.video_path) && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-medium">
                        <Video size={10} />
                        {session.video_path ? 'Uploaded' : 'Link'}
                      </span>
                    )}
                    {session.images && session.images.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-xs font-medium">
                        <Image size={10} />
                        {session.images.length} {session.images.length === 1 ? 'image' : 'images'}
                      </span>
                    )}
                    {session.transcript && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs font-medium">
                        <FileText size={10} />
                        Transcript
                      </span>
                    )}
                    {session.summary && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs font-medium">
                        <Sparkles size={10} />
                        Summary
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
              <Video size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-text-secondary dark:text-gray-400">No sessions yet.{isAdmin ? ' Add one to get started!' : ''}</p>
            </div>
          )}
        </div>
      )}

      {/* Projects Tab */}
      {activeTab === 'projects' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => handleOpenProjectModal(null)}>
              <Plus size={14} className="mr-1" /> Share Project
            </Button>
          </div>

          {projects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => {
                const canEdit = project.created_by === user?.id || isAdmin
                return (
                  <div key={project.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow">
                    {/* Screenshot */}
                    {project.screenshot_path && (
                      <AuthImage
                        src={vvcApi.getScreenshotUrl(project.id)}
                        alt={project.title}
                        className="w-full h-40 object-cover"
                      />
                    )}
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-display font-semibold text-text-primary dark:text-gray-100 line-clamp-2">{project.title}</h3>
                        {canEdit && (
                          <div className="flex gap-1 flex-shrink-0 ml-2">
                            <button onClick={() => handleOpenProjectModal(project)} title="Edit"
                              className="p-1.5 rounded-lg text-text-secondary hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors">
                              <Edit3 size={14} />
                            </button>
                            <button onClick={() => handleDeleteProject(project.id)} title="Delete"
                              className="p-1.5 rounded-lg text-text-secondary hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-text-secondary dark:text-gray-400 mb-2">
                        by {project.author_name}
                      </p>

                      {project.description && (
                        <p className="text-sm text-text-secondary dark:text-gray-400 line-clamp-3 mb-3">{project.description}</p>
                      )}

                      {project.project_url && (
                        <a
                          href={project.project_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
                        >
                          <ExternalLink size={14} />
                          View Project
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
              <Rocket size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-text-secondary dark:text-gray-400">No projects shared yet. Be the first to show off what you&apos;ve built!</p>
            </div>
          )}
        </div>
      )}

      {/* Resources Tab */}
      {activeTab === 'resources' && (
        <div className="space-y-6">
          {/* Setup Guide */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-display font-semibold text-text-primary dark:text-gray-100">Setting Up Claude Code</h2>
              {isAdmin && (
                <Button size="sm" variant="outline" onClick={() => handleEditResource('setup_guide')}>
                  <Edit3 size={14} className="mr-1" /> Edit
                </Button>
              )}
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <pre className="whitespace-pre-wrap text-sm text-text-secondary dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                {typeof resources.setup_guide === 'string' ? resources.setup_guide : ''}
              </pre>
            </div>
          </div>

          {/* Best Practices */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-display font-semibold text-text-primary dark:text-gray-100">Best Practices</h2>
              {isAdmin && (
                <Button size="sm" variant="outline" onClick={() => handleEditResource('best_practices')}>
                  <Edit3 size={14} className="mr-1" /> Edit
                </Button>
              )}
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <pre className="whitespace-pre-wrap text-sm text-text-secondary dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                {typeof resources.best_practices === 'string' ? resources.best_practices : ''}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Session Modal */}
      <Modal isOpen={showSessionModal} onClose={() => setShowSessionModal(false)} title={editingSession ? 'Edit Session' : 'Add Session'} size="md">
        <form onSubmit={(e) => { e.preventDefault(); handleSaveSession() }} className="space-y-4">
          <Input label="Title" value={sessionForm.title} onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })} required autoFocus />
          <Input label="Session Date" type="date" value={sessionForm.session_date} onChange={(e) => setSessionForm({ ...sessionForm, session_date: e.target.value })} />
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-gray-200 mb-1">Description</label>
            <textarea
              value={sessionForm.description}
              onChange={(e) => setSessionForm({ ...sessionForm, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-text-primary dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              placeholder="What was covered in this session?"
            />
          </div>
          <Input
            label="Video URL (YouTube, Vimeo, or other link)"
            value={sessionForm.video_url}
            onChange={(e) => setSessionForm({ ...sessionForm, video_url: e.target.value })}
            placeholder="https://youtube.com/watch?v=..."
          />
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-gray-200 mb-1">Or Upload Video File</label>
            <label className="cursor-pointer">
              <input type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => setVideoUploadFile(e.target.files?.[0] || null)} />
              <div className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors">
                <Upload size={18} className="text-text-secondary dark:text-gray-400" />
                <span className="text-sm text-text-secondary dark:text-gray-400">
                  {videoUploadFile ? videoUploadFile.name : 'Choose video file (mp4, webm, mov)'}
                </span>
              </div>
            </label>
            {uploadProgress !== null && (
              <div className="mt-2">
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-500 transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
                <p className="text-xs text-text-secondary dark:text-gray-400 mt-1">{uploadProgress}% uploaded</p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setShowSessionModal(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : editingSession ? 'Save Changes' : 'Add Session'}</Button>
          </div>
        </form>
      </Modal>

      {/* Session Detail Modal */}
      <Modal isOpen={!!viewingSession} onClose={() => { setViewingSession(null); setDetailVideoFile(null) }} title="" size="full">
        {viewingSession && (
          <div className="flex flex-col h-[80vh]">
            <div className="mb-1">
              <h2 className="text-xl font-display font-semibold text-text-primary dark:text-gray-100 px-2 py-1">
                {viewingSession.title}
              </h2>
            </div>
            {viewingSession.session_date && (
              <p className="text-xs text-text-secondary dark:text-gray-400 mb-4 px-2">
                {formatDate(viewingSession.session_date)}
              </p>
            )}
            {viewingSession.description && (
              <p className="text-sm text-text-secondary dark:text-gray-400 mb-4 px-2">{viewingSession.description}</p>
            )}

            <div className="flex-1 flex gap-4 min-h-0">
              {/* Left side: Video + Images + Notes */}
              <div className="flex-1 flex flex-col gap-4 min-w-0">
                {/* Video section */}
                <div className="flex-shrink-0">
                  {(viewingSession.video_url || viewingSession.video_path) ? (
                    <VideoPlayer
                      videoUrl={viewingSession.video_url}
                      videoPath={viewingSession.video_path}
                      videoFetchFn={viewingSession.video_path ? () => vvcApi.getVideo(viewingSession.id) : undefined}
                    />
                  ) : isAdmin ? (
                    <label className="cursor-pointer">
                      <input type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => setDetailVideoFile(e.target.files?.[0] || null)} />
                      <div className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors">
                        <Upload size={18} className="text-text-secondary dark:text-gray-400" />
                        <span className="text-sm text-text-secondary dark:text-gray-400">
                          {detailVideoFile ? detailVideoFile.name : 'Upload Video'}
                        </span>
                      </div>
                    </label>
                  ) : null}
                </div>

                {/* Images section */}
                {((viewingSession.images && viewingSession.images.length > 0) || isAdmin) && (
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-text-primary dark:text-gray-100">
                        Images {viewingSession.images?.length > 0 && `(${viewingSession.images.length})`}
                      </h4>
                      {isAdmin && (
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files?.length > 0) {
                                handleUploadImages(e.target.files)
                              }
                            }}
                          />
                          <span className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium cursor-pointer">
                            <Upload size={12} />
                            {imageUploading ? 'Uploading...' : 'Add Images'}
                          </span>
                        </label>
                      )}
                    </div>
                    {viewingSession.images && viewingSession.images.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {viewingSession.images.map((img) => (
                          <div key={img.id} className="relative flex-shrink-0 group">
                            <AuthImage
                              src={vvcApi.getImageUrl(viewingSession.id, img.id)}
                              alt={img.filename}
                              className="h-24 w-auto rounded-lg object-cover cursor-pointer"
                              onClick={() => window.open(vvcApi.getImageUrl(viewingSession.id, img.id), '_blank')}
                            />
                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteImage(img.id)}
                                className="absolute top-1 right-1 p-0.5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Remove image"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Notes section */}
                <div className="flex-1 min-h-0 flex flex-col">
                  <h4 className="text-sm font-semibold text-text-primary dark:text-gray-100 mb-2">Notes</h4>
                  <div className="flex-1 [&_.ql-container]:!min-h-0 [&_.ql-container]:flex-1 [&_.ql-container]:flex [&_.ql-container]:flex-col [&_.ql-editor]:flex-1">
                    {isAdmin ? (
                      <RichTextEditor
                        value={editNotes}
                        onChange={setEditNotes}
                        placeholder="Add session notes..."
                        minHeight="100%"
                        className="h-full flex flex-col [&>div]:flex-1 [&>div]:flex [&>div]:flex-col"
                      />
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none p-3 bg-gray-50 dark:bg-gray-900 rounded-lg flex-1 overflow-y-auto" dangerouslySetInnerHTML={{ __html: editNotes || '<p class="text-gray-400">No notes yet.</p>' }} />
                    )}
                  </div>
                </div>
              </div>

              {/* Right side: Summary/Transcript tabs */}
              <div className="w-1/2 flex flex-col min-h-0 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex border-b border-gray-200 dark:border-gray-700">
                  <button onClick={() => setDetailTab('summary')}
                    className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${detailTab === 'summary' ? 'text-primary-600 dark:text-primary-300 border-b-2 border-primary-500' : 'text-text-secondary dark:text-gray-400'}`}>
                    Summary
                  </button>
                  <button onClick={() => setDetailTab('transcript')}
                    className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${detailTab === 'transcript' ? 'text-primary-600 dark:text-primary-300 border-b-2 border-primary-500' : 'text-text-secondary dark:text-gray-400'}`}>
                    Transcript
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {detailTab === 'summary' && (
                    isAdmin ? (
                      <textarea
                        value={editSummary}
                        onChange={(e) => setEditSummary(e.target.value)}
                        className="w-full h-full min-h-[200px] text-sm text-text-secondary dark:text-gray-400 bg-transparent border-none outline-none resize-none"
                        placeholder="Add session summary..."
                      />
                    ) : editSummary ? (
                      <p className="text-sm text-text-secondary dark:text-gray-400 whitespace-pre-wrap">{editSummary}</p>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <Sparkles size={32} className="text-gray-300 dark:text-gray-600 mb-3" />
                        <p className="text-sm text-text-secondary dark:text-gray-400">No summary yet</p>
                      </div>
                    )
                  )}
                  {detailTab === 'transcript' && (
                    isAdmin ? (
                      <textarea
                        value={editTranscript}
                        onChange={(e) => setEditTranscript(e.target.value)}
                        className="w-full h-full min-h-[200px] text-sm text-text-secondary dark:text-gray-400 bg-transparent border-none outline-none resize-none"
                        placeholder="Add session transcript..."
                      />
                    ) : editTranscript ? (
                      <p className="text-sm text-text-secondary dark:text-gray-400 whitespace-pre-wrap">{editTranscript}</p>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <FileText size={32} className="text-gray-300 dark:text-gray-600 mb-3" />
                        <p className="text-sm text-text-secondary dark:text-gray-400">No transcript yet</p>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            {isAdmin && (
              <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                <Button variant="outline" onClick={() => { setViewingSession(null); setDetailVideoFile(null) }}>Cancel</Button>
                <Button onClick={handleSaveDetail} disabled={detailSaving}>{detailSaving ? 'Saving...' : 'Save Changes'}</Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Edit Resource Modal */}
      <Modal isOpen={!!editingResource} onClose={() => setEditingResource(null)} title={`Edit ${editingResource === 'setup_guide' ? 'Setup Guide' : 'Best Practices'}`} size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-gray-200 mb-1">Content (Markdown)</label>
            <textarea
              value={resourceValue}
              onChange={(e) => setResourceValue(e.target.value)}
              rows={16}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-text-primary dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm font-mono"
              placeholder="Write content in markdown..."
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setEditingResource(null)}>Cancel</Button>
            <Button onClick={handleSaveResource} disabled={resourceSaving}>{resourceSaving ? 'Saving...' : 'Save'}</Button>
          </div>
        </div>
      </Modal>

      {/* Add/Edit Project Modal */}
      <Modal isOpen={showProjectModal} onClose={() => setShowProjectModal(false)} title={editingProject ? 'Edit Project' : 'Share Your Project'} size="md">
        <form onSubmit={(e) => { e.preventDefault(); handleSaveProject() }} className="space-y-4">
          <Input label="Project Title" value={projectForm.title} onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })} required autoFocus />
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-gray-200 mb-1">Description</label>
            <textarea
              value={projectForm.description}
              onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-text-primary dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              placeholder="What did you build? How did you use vibe coding?"
            />
          </div>
          <Input
            label="Project URL (GitHub, live site, etc.)"
            value={projectForm.project_url}
            onChange={(e) => setProjectForm({ ...projectForm, project_url: e.target.value })}
            placeholder="https://github.com/..."
          />
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-gray-200 mb-1">Screenshot</label>
            <label className="cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setScreenshotFile(e.target.files?.[0] || null)} />
              <div className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors">
                <Image size={18} className="text-text-secondary dark:text-gray-400" />
                <span className="text-sm text-text-secondary dark:text-gray-400">
                  {screenshotFile ? screenshotFile.name : 'Upload a screenshot'}
                </span>
              </div>
            </label>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setShowProjectModal(false)}>Cancel</Button>
            <Button type="submit" disabled={projectSaving}>{projectSaving ? 'Saving...' : editingProject ? 'Save Changes' : 'Share Project'}</Button>
          </div>
        </form>
      </Modal>

      {/* Loading overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/10 dark:bg-black/20 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg">
            <div className="animate-spin w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full" />
          </div>
        </div>
      )}
    </div>
  )
}

// Helper component to load authenticated images
function AuthImage({ src, alt, className, onClick }) {
  const [blobUrl, setBlobUrl] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!src) return
    let cancelled = false
    const token = localStorage.getItem('token')

    fetch(src, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load image')
        return res.blob()
      })
      .then(blob => {
        if (!cancelled) setBlobUrl(URL.createObjectURL(blob))
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })

    return () => {
      cancelled = true
    }
  }, [src])

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [blobUrl])

  if (error) return <div className={`bg-gray-200 dark:bg-gray-700 flex items-center justify-center ${className}`}><Image size={20} className="text-gray-400" /></div>
  if (!blobUrl) return <div className={`bg-gray-100 dark:bg-gray-800 animate-pulse ${className}`} />

  return <img src={blobUrl} alt={alt} className={className} onClick={onClick} />
}
