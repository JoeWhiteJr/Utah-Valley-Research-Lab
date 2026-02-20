import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../store/authStore'
import { useBookClubStore } from '../store/bookClubStore'
import { bookClubApi } from '../services/api'
import Button from '../components/Button'
import Modal from '../components/Modal'
import Input from '../components/Input'
import AudioPlayer from '../components/AudioPlayer'
import RichTextEditor from '../components/RichTextEditor'
import { BookOpen, Plus, Check, Trash2, Edit3, Calendar, ChevronRight, Clock, Upload, FileText, Sparkles, Archive, Undo2 } from 'lucide-react'

export default function BookClub() {
  // Auth store
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'

  // Book club store
  const {
    currentBook, upcomingBooks, pastBooks, userVoteBookId, isLoading,
    fetchBooks, createBook, updateBook, deleteBook, setCurrent, shelveBook, moveToUpcoming, vote, removeVote, updateMeeting
  } = useBookClubStore()

  // Local state
  const [showBookModal, setShowBookModal] = useState(false)
  const [editingBook, setEditingBook] = useState(null)
  const [bookForm, setBookForm] = useState({ title: '', author: '', description: '' })
  const [setCurrentModal, setSetCurrentModal] = useState(null)
  const [setCurrentDate, setSetCurrentDate] = useState('')
  const [viewingMeeting, setViewingMeeting] = useState(null)
  const [meetingNotes, setMeetingNotes] = useState('')
  const [meetingSummary, setMeetingSummary] = useState('')
  const [meetingTranscript, setMeetingTranscript] = useState('')
  const [meetingTab, setMeetingTab] = useState('summary')
  const [expandedPastBook, setExpandedPastBook] = useState(null)
  const [saving, setSaving] = useState(false)
  const [audioUploadFile, setAudioUploadFile] = useState(null)

  useEffect(() => { fetchBooks() }, [fetchBooks])

  const handleOpenBookModal = useCallback((book) => {
    if (book) {
      setBookForm({
        title: book.title || '',
        author: book.author || '',
        description: book.description || '',
        meet_date: book.meet_date ? book.meet_date.split('T')[0] : ''
      })
      setEditingBook(book)
    } else {
      setBookForm({ title: '', author: '', description: '' })
      setEditingBook(null)
    }
    setShowBookModal(true)
  }, [])

  const handleSaveBook = useCallback(async () => {
    if (editingBook) {
      await updateBook(editingBook.id, bookForm)
    } else {
      const { meet_date, ...createData } = bookForm
      await createBook(createData)
    }
    setShowBookModal(false)
  }, [editingBook, bookForm, updateBook, createBook])

  const handleDeleteBook = useCallback(async (id) => {
    await deleteBook(id)
  }, [deleteBook])

  const handleOpenSetCurrent = useCallback((book) => {
    setSetCurrentModal(book)
    setSetCurrentDate('')
  }, [])

  const handleConfirmSetCurrent = useCallback(async () => {
    if (!setCurrentModal) return
    await setCurrent(setCurrentModal.id, setCurrentDate || null)
    setSetCurrentModal(null)
    setSetCurrentDate('')
  }, [setCurrentModal, setCurrentDate, setCurrent])

  const handleShelveBook = useCallback(async (id) => {
    if (!window.confirm('Move this book to past books?')) return
    await shelveBook(id)
  }, [shelveBook])

  const handleMoveToUpcoming = useCallback(async (id) => {
    if (!window.confirm('Move this book back to the book list?')) return
    await moveToUpcoming(id)
  }, [moveToUpcoming])

  const handleVote = useCallback(async (bookId) => {
    if (userVoteBookId === bookId) {
      await removeVote()
    } else {
      await vote(bookId)
    }
  }, [userVoteBookId, removeVote, vote])

  const handleOpenMeeting = useCallback((book) => {
    setViewingMeeting(book)
    setMeetingNotes(book.notes || '')
    setMeetingSummary(book.summary || '')
    setMeetingTranscript(book.transcript || '')
    setMeetingTab('summary')
  }, [])

  const handleSaveMeeting = useCallback(async () => {
    setSaving(true)
    try {
      await updateMeeting(viewingMeeting.id, {
        notes: meetingNotes,
        summary: meetingSummary,
        transcript: meetingTranscript
      })
      if (audioUploadFile) {
        await bookClubApi.uploadAudio(viewingMeeting.id, audioUploadFile)
      }
      setViewingMeeting(null)
      setAudioUploadFile(null)
    } finally {
      setSaving(false)
    }
  }, [viewingMeeting, meetingNotes, meetingSummary, meetingTranscript, audioUploadFile, updateMeeting])

  const handleCloseMeeting = useCallback(() => {
    setViewingMeeting(null)
    setAudioUploadFile(null)
  }, [])

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center">
            <BookOpen className="text-primary-600 dark:text-primary-400" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-text-primary dark:text-gray-100">Book Club</h1>
            <p className="text-sm text-text-secondary dark:text-gray-400">Read, discuss, and grow together</p>
          </div>
        </div>
      </div>

      {/* Grid: 3 columns on lg */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Currently Reading — lg:col-span-2 */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-display font-semibold text-text-primary dark:text-gray-100 mb-4">Currently Reading</h2>
          {currentBook ? (
            <div>
              <h3 className="text-xl font-display font-bold text-text-primary dark:text-gray-100">{currentBook.title}</h3>
              <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">by {currentBook.author}</p>
              {currentBook.description && (
                <p className="text-sm text-text-secondary dark:text-gray-400 mt-3 leading-relaxed">{currentBook.description}</p>
              )}
              {isAdmin && (
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="outline" onClick={() => handleOpenBookModal(currentBook)}>
                    <Edit3 size={14} className="mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleOpenMeeting(currentBook)}>
                    <FileText size={14} className="mr-1" /> Meeting Notes
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleShelveBook(currentBook.id)}>
                    <Archive size={14} className="mr-1" /> Shelve Book
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleMoveToUpcoming(currentBook.id)}>
                    <Undo2 size={14} className="mr-1" /> Move to Book List
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-text-secondary dark:text-gray-400">No book is currently being read.</p>
          )}
        </div>

        {/* Next Meeting — lg:col-span-1 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-display font-semibold text-text-primary dark:text-gray-100 mb-4">Next Meeting</h2>
          {(() => {
            if (!currentBook?.meet_date) {
              return (
                <div className="text-center py-4">
                  <Calendar size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                  <p className="text-sm text-text-secondary dark:text-gray-400">No meeting scheduled</p>
                </div>
              )
            }
            const dateStr = currentBook.meet_date.split('T')[0]
            const meetDate = new Date(dateStr + 'T00:00:00')
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const diffDays = Math.ceil((meetDate - today) / (1000 * 60 * 60 * 24))
            return (
              <div className="text-center">
                <p className="text-3xl font-display font-bold text-primary-600 dark:text-primary-400">
                  {meetDate.toLocaleDateString('en-US', { weekday: 'long' })}
                </p>
                <p className="text-lg text-text-primary dark:text-gray-200 mt-1">
                  {meetDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 dark:bg-primary-900/30 rounded-full">
                  <Clock size={14} className="text-primary-600 dark:text-primary-400" />
                  <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                    {diffDays === 0 ? 'Today!' : diffDays === 1 ? 'Tomorrow' : diffDays < 0 ? `${Math.abs(diffDays)} days ago` : `${diffDays} days away`}
                  </span>
                </div>
              </div>
            )
          })()}
        </div>

        {/* Up Next - Vote — lg:col-span-2 */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-semibold text-text-primary dark:text-gray-100">Up Next — Vote</h2>
            {isAdmin && (
              <Button size="sm" onClick={() => handleOpenBookModal(null)}>
                <Plus size={14} className="mr-1" /> Add Book
              </Button>
            )}
          </div>
          {upcomingBooks.length > 0 ? (
            <div className="space-y-3">
              {upcomingBooks.map((book) => (
                <div key={book.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <button
                    onClick={() => handleVote(book.id)}
                    className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors ${
                      userVoteBookId === book.id
                        ? 'border-primary-500 bg-primary-500 text-white'
                        : 'border-gray-300 dark:border-gray-600 hover:border-primary-400'
                    }`}
                  >
                    {userVoteBookId === book.id && <Check size={14} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-text-primary dark:text-gray-100 truncate">{book.title}</p>
                    <p className="text-xs text-text-secondary dark:text-gray-400">by {book.author}</p>
                  </div>
                  <span className="text-sm text-text-secondary dark:text-gray-400 whitespace-nowrap">
                    {book.vote_count} {Number(book.vote_count) === 1 ? 'vote' : 'votes'}
                  </span>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <button onClick={() => handleOpenSetCurrent(book)} title="Set as current book"
                        className="p-1.5 rounded-lg text-text-secondary hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors">
                        <BookOpen size={14} />
                      </button>
                      <button onClick={() => handleOpenBookModal(book)} title="Edit"
                        className="p-1.5 rounded-lg text-text-secondary hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors">
                        <Edit3 size={14} />
                      </button>
                      <button onClick={() => handleDeleteBook(book.id)} title="Delete"
                        className="p-1.5 rounded-lg text-text-secondary hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-secondary dark:text-gray-400">No upcoming books yet.{isAdmin ? ' Add one to get started!' : ''}</p>
          )}
        </div>

        {/* Past Books — lg:col-span-1 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-display font-semibold text-text-primary dark:text-gray-100 mb-4">Past Books</h2>
          {pastBooks.length > 0 ? (
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {pastBooks.map((book) => (
                <div key={book.id}>
                  <button
                    onClick={() => setExpandedPastBook(expandedPastBook === book.id ? null : book.id)}
                    className="w-full text-left p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronRight size={14} className={`text-text-secondary dark:text-gray-400 transition-transform ${expandedPastBook === book.id ? 'rotate-90' : ''}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text-primary dark:text-gray-100 truncate">{book.title}</p>
                        <p className="text-xs text-text-secondary dark:text-gray-400">
                          {book.author}
                          {book.meet_date && ` — ${new Date(book.meet_date.split('T')[0] + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                        </p>
                      </div>
                    </div>
                  </button>
                  {expandedPastBook === book.id && (
                    <div className="ml-6 pl-2 border-l-2 border-gray-200 dark:border-gray-600 py-2">
                      {book.description && <p className="text-xs text-text-secondary dark:text-gray-400 mb-2">{book.description}</p>}
                      {book.notes && (
                        <p className="text-xs text-text-secondary dark:text-gray-400 mb-2 line-clamp-3" dangerouslySetInnerHTML={{ __html: book.notes }} />
                      )}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleOpenMeeting(book)}
                          className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700"
                        >
                          Open Meeting
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleMoveToUpcoming(book.id)}
                            className="text-xs font-medium text-text-secondary dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-1"
                          >
                            <Undo2 size={12} /> Move to Book List
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-secondary dark:text-gray-400">No past books yet.</p>
          )}
        </div>
      </div>

      {/* Add/Edit Book Modal */}
      <Modal isOpen={showBookModal} onClose={() => setShowBookModal(false)} title={editingBook ? 'Edit Book' : 'Add Book'} size="md">
        <form onSubmit={(e) => { e.preventDefault(); handleSaveBook() }} className="space-y-4">
          <Input label="Title" value={bookForm.title} onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })} required autoFocus />
          <Input label="Author" value={bookForm.author} onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })} required />
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-gray-200 mb-1">Description</label>
            <textarea
              value={bookForm.description}
              onChange={(e) => setBookForm({ ...bookForm, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-text-primary dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              placeholder="What's this book about?"
            />
          </div>
          {editingBook && (
            <Input label="Meeting Date" type="date" value={bookForm.meet_date || ''} onChange={(e) => setBookForm({ ...bookForm, meet_date: e.target.value })} />
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setShowBookModal(false)}>Cancel</Button>
            <Button type="submit">{editingBook ? 'Save Changes' : 'Add Book'}</Button>
          </div>
        </form>
      </Modal>

      {/* Set as Current Modal */}
      <Modal isOpen={!!setCurrentModal} onClose={() => setSetCurrentModal(null)} title="Set as Current Book" size="sm">
        {setCurrentModal && (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary dark:text-gray-400">
              Set <span className="font-medium text-text-primary dark:text-gray-100">{setCurrentModal.title}</span> as the current book? Any existing current book will be moved to past books.
            </p>
            <Input label="Meeting Date (optional)" type="date" value={setCurrentDate} onChange={(e) => setSetCurrentDate(e.target.value)} />
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setSetCurrentModal(null)}>Cancel</Button>
              <Button onClick={handleConfirmSetCurrent}>Confirm</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Meeting View Modal — full screen, same pattern as ProjectDetail */}
      <Modal isOpen={!!viewingMeeting} onClose={handleCloseMeeting} title="" size="full">
        {viewingMeeting && (
          <div className="flex flex-col h-[80vh]">
            <div className="mb-1">
              <h2 className="text-xl font-display font-semibold text-text-primary dark:text-gray-100 px-2 py-1">
                {viewingMeeting.title} — Meeting Notes
              </h2>
            </div>
            {viewingMeeting.meet_date && (
              <p className="text-xs text-text-secondary dark:text-gray-400 mb-4 px-2">
                {new Date(viewingMeeting.meet_date.split('T')[0] + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            )}

            <div className="flex-1 flex gap-4 min-h-0">
              {/* Left side: Audio + Notes */}
              <div className="flex-1 flex flex-col gap-4 min-w-0">
                <div className="flex-shrink-0">
                  {viewingMeeting.audio_path ? (
                    <AudioPlayer audioFetchFn={() => bookClubApi.getAudio(viewingMeeting.id)} />
                  ) : isAdmin ? (
                    <label className="cursor-pointer">
                      <input type="file" accept="audio/*" className="hidden" onChange={(e) => setAudioUploadFile(e.target.files?.[0] || null)} />
                      <div className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors">
                        <Upload size={18} className="text-text-secondary dark:text-gray-400" />
                        <span className="text-sm text-text-secondary dark:text-gray-400">
                          {audioUploadFile ? audioUploadFile.name : 'Upload Audio'}
                        </span>
                      </div>
                    </label>
                  ) : null}
                </div>

                <div className="flex-1 min-h-0 flex flex-col">
                  <h4 className="text-sm font-semibold text-text-primary dark:text-gray-100 mb-2">Notes</h4>
                  <div className="flex-1 [&_.ql-container]:!min-h-0 [&_.ql-container]:flex-1 [&_.ql-container]:flex [&_.ql-container]:flex-col [&_.ql-editor]:flex-1">
                    {isAdmin ? (
                      <RichTextEditor
                        value={meetingNotes}
                        onChange={setMeetingNotes}
                        placeholder="Add meeting notes..."
                        minHeight="100%"
                        className="h-full flex flex-col [&>div]:flex-1 [&>div]:flex [&>div]:flex-col"
                      />
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none p-3 bg-gray-50 dark:bg-gray-900 rounded-lg flex-1 overflow-y-auto" dangerouslySetInnerHTML={{ __html: meetingNotes || '<p class="text-gray-400">No notes yet.</p>' }} />
                    )}
                  </div>
                </div>
              </div>

              {/* Right side: Summary/Transcript tabs */}
              <div className="w-1/2 flex flex-col min-h-0 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex border-b border-gray-200 dark:border-gray-700">
                  <button onClick={() => setMeetingTab('summary')}
                    className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${meetingTab === 'summary' ? 'text-primary-600 dark:text-primary-300 border-b-2 border-primary-500' : 'text-text-secondary dark:text-gray-400'}`}>
                    Summary
                  </button>
                  <button onClick={() => setMeetingTab('transcript')}
                    className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${meetingTab === 'transcript' ? 'text-primary-600 dark:text-primary-300 border-b-2 border-primary-500' : 'text-text-secondary dark:text-gray-400'}`}>
                    Transcript
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {meetingTab === 'summary' && (
                    isAdmin ? (
                      <textarea
                        value={meetingSummary}
                        onChange={(e) => setMeetingSummary(e.target.value)}
                        className="w-full h-full min-h-[200px] text-sm text-text-secondary dark:text-gray-400 bg-transparent border-none outline-none resize-none"
                        placeholder="Add meeting summary..."
                      />
                    ) : meetingSummary ? (
                      <p className="text-sm text-text-secondary dark:text-gray-400 whitespace-pre-wrap">{meetingSummary}</p>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <Sparkles size={32} className="text-gray-300 dark:text-gray-600 mb-3" />
                        <p className="text-sm text-text-secondary dark:text-gray-400">No summary yet</p>
                      </div>
                    )
                  )}
                  {meetingTab === 'transcript' && (
                    isAdmin ? (
                      <textarea
                        value={meetingTranscript}
                        onChange={(e) => setMeetingTranscript(e.target.value)}
                        className="w-full h-full min-h-[200px] text-sm text-text-secondary dark:text-gray-400 bg-transparent border-none outline-none resize-none"
                        placeholder="Add meeting transcript..."
                      />
                    ) : meetingTranscript ? (
                      <p className="text-sm text-text-secondary dark:text-gray-400 whitespace-pre-wrap">{meetingTranscript}</p>
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
                <Button variant="outline" onClick={handleCloseMeeting}>Cancel</Button>
                <Button onClick={handleSaveMeeting} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
              </div>
            )}
          </div>
        )}
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
