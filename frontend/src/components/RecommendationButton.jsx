import { useState } from 'react'
import { Lightbulb, Send } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { recommendationsApi } from '../services/api'
import { toast } from '../store/toastStore'
import Modal from './Modal'

export default function RecommendationButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { user } = useAuthStore()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!message.trim()) return

    setSubmitting(true)
    try {
      const payload = { message: message.trim() }
      if (!user && name.trim()) {
        payload.submitter_name = name.trim()
      }
      await recommendationsApi.submit(payload)
      toast.success('Thank you for your suggestion!')
      setMessage('')
      setName('')
      setIsOpen(false)
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Failed to submit. Please try again.'
      toast.error(msg)
    }
    setSubmitting(false)
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 z-40 w-12 h-12 rounded-full bg-primary-500 hover:bg-primary-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group"
        aria-label="Submit a suggestion"
        title="Submit a suggestion"
      >
        <Lightbulb size={22} className="group-hover:scale-110 transition-transform" />
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Submit a Suggestion" size="md">
        <form onSubmit={handleSubmit}>
          <p className="text-sm text-text-secondary dark:text-gray-400 mb-4">
            Have an idea to improve the site? We&apos;d love to hear it!
          </p>

          {user ? (
            <p className="text-sm text-text-secondary dark:text-gray-400 mb-4">
              Submitting as <span className="font-medium text-text-primary dark:text-gray-200">{user.name}</span>
            </p>
          ) : (
            <div className="mb-4">
              <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1">
                Your name <span className="text-text-secondary dark:text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Anonymous"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300"
                maxLength={255}
              />
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-text-primary dark:text-gray-100 mb-1">
              Your suggestion
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What would you like to see improved or added?"
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
              maxLength={5000}
              required
            />
            <p className="text-xs text-text-secondary dark:text-gray-500 mt-1 text-right">
              {message.length}/5000
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-text-secondary dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!message.trim() || submitting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Submit
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
