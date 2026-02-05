import { useState } from 'react'
import { Link } from 'react-router-dom'
import { applicationsApi } from '../services/api'
import Button from '../components/Button'
import { CheckCircle, ArrowLeft } from 'lucide-react'

export default function Apply() {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

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
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="font-display font-bold text-2xl mb-2">Application Submitted!</h1>
          <p className="text-text-secondary mb-6">We'll review your application and get back to you soon.</p>
          <Link to="/login"><Button>Go to Login</Button></Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
        <Link to="/login" className="inline-flex items-center text-sm text-primary-600 hover:text-primary-700 mb-4">
          <ArrowLeft size={16} className="mr-1" />Back to Login
        </Link>
        <h1 className="font-display font-bold text-2xl mb-1">Join Our Team</h1>
        <p className="text-text-secondary mb-6">Apply to become a member of the Stats Lab team.</p>
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Full Name</label>
            <input type="text" name="name" value={formData.name} onChange={handleChange} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-300 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-300 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Why do you want to join?</label>
            <textarea name="message" value={formData.message} onChange={handleChange} required rows={4} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-300 outline-none resize-none" />
          </div>
          <Button type="submit" className="w-full" loading={isLoading}>Submit Application</Button>
        </form>
      </div>
    </div>
  )
}
