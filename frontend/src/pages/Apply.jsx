import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { applicationsApi } from '../services/api'
import Button from '../components/Button'
import Input from '../components/Input'
import { CheckCircle, ArrowLeft } from 'lucide-react'

export default function Apply() {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    document.title = 'Apply - Stats Lab'
  }, [])

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    setError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await applicationsApi.submit(formData)
      setSuccess(true)
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to submit')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="font-display font-bold text-2xl text-text-primary dark:text-gray-100 mb-2">Application Submitted!</h1>
          <p className="text-text-secondary dark:text-gray-400 mb-6">We&apos;ll review your application and get back to you soon.</p>
          <Link to="/login"><Button>Go to Login</Button></Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-md w-full">
        <Link to="/login" className="inline-flex items-center text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 mb-4">
          <ArrowLeft size={16} className="mr-1" />Back to Login
        </Link>
        <h1 className="font-display font-bold text-2xl text-text-primary dark:text-gray-100 mb-1">Join Our Team</h1>
        <p className="text-text-secondary dark:text-gray-400 mb-6">Apply to become a member of the Stats Lab team.</p>
        {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name"
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
          <Input
            label="Email"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-gray-200 mb-1.5">Why do you want to join?</label>
            <textarea
              name="message"
              value={formData.message}
              onChange={handleChange}
              required
              rows={4}
              className="w-full px-4 py-2.5 rounded-organic border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-text-primary dark:text-gray-100 placeholder:text-text-secondary dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition-colors resize-none"
            />
          </div>
          <Button type="submit" className="w-full" loading={isLoading}>Submit Application</Button>
        </form>
      </div>
    </div>
  )
}
