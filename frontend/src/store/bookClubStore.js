import { create } from 'zustand'
import { bookClubApi } from '../services/api'

export const useBookClubStore = create((set, get) => ({
  currentBook: null,
  upcomingBooks: [],
  pastBooks: [],
  userVoteBookId: null,
  isLoading: false,

  fetchBooks: async () => {
    set({ isLoading: true })
    try {
      const { data } = await bookClubApi.list()
      set({
        currentBook: data.currentBook,
        upcomingBooks: data.upcomingBooks,
        pastBooks: data.pastBooks,
        userVoteBookId: data.userVoteBookId,
      })
    } catch (error) {
      console.error('Failed to fetch books:', error)
    } finally {
      set({ isLoading: false })
    }
  },

  createBook: async (bookData) => {
    const { data } = await bookClubApi.create(bookData)
    await get().fetchBooks()
    return data.book
  },

  updateBook: async (id, bookData) => {
    const { data } = await bookClubApi.update(id, bookData)
    await get().fetchBooks()
    return data.book
  },

  deleteBook: async (id) => {
    await bookClubApi.delete(id)
    await get().fetchBooks()
  },

  setCurrent: async (id, meetDate) => {
    await bookClubApi.setCurrent(id, meetDate ? { meet_date: meetDate } : undefined)
    await get().fetchBooks()
  },

  shelveBook: async (id) => {
    await bookClubApi.shelve(id)
    await get().fetchBooks()
  },

  moveToUpcoming: async (id) => {
    await bookClubApi.moveToUpcoming(id)
    await get().fetchBooks()
  },

  vote: async (bookId) => {
    // Optimistic update
    const prev = get().userVoteBookId
    set((state) => ({
      userVoteBookId: bookId,
      upcomingBooks: state.upcomingBooks.map((b) => ({
        ...b,
        vote_count: b.id === bookId
          ? Number(b.vote_count) + 1
          : b.id === prev
            ? Math.max(0, Number(b.vote_count) - 1)
            : Number(b.vote_count),
        user_voted: b.id === bookId,
      })),
    }))
    try {
      await bookClubApi.vote(bookId)
    } catch {
      await get().fetchBooks()
    }
  },

  removeVote: async () => {
    const prev = get().userVoteBookId
    set((state) => ({
      userVoteBookId: null,
      upcomingBooks: state.upcomingBooks.map((b) => ({
        ...b,
        vote_count: b.id === prev ? Math.max(0, Number(b.vote_count) - 1) : Number(b.vote_count),
        user_voted: false,
      })),
    }))
    try {
      await bookClubApi.removeVote(prev)
    } catch {
      await get().fetchBooks()
    }
  },

  updateMeeting: async (id, meetingData) => {
    const { data } = await bookClubApi.updateMeeting(id, meetingData)
    await get().fetchBooks()
    return data.book
  },
}))
