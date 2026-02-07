import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../services/api'
import Button from '../components/Button'
import Input from '../components/Input'
import { ArrowLeft, Mail } from 'lucide-react'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = 'Forgot Password - Stats Lab'
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      await authApi.forgotPassword(email)
      setSubmitted(true)
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Something went wrong')
    }
    setIsSubmitting(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background dark:bg-gray-900 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display font-bold text-3xl text-primary-600">Stats Lab</h1>
          <p className="text-text-secondary dark:text-gray-400 mt-2">Research Project Manager</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8">
          {submitted ? (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Mail size={28} className="text-green-600 dark:text-green-400" />
              </div>
              <h2 className="font-display font-semibold text-xl text-text-primary dark:text-gray-100 mb-2">Check your email</h2>
              <p className="text-text-secondary dark:text-gray-400 text-sm mb-6">
                If an account exists with that email, a password reset link has been generated. Contact your administrator for the reset link.
              </p>
              <Link to="/login" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 text-sm font-medium">
                Back to login
              </Link>
            </div>
          ) : (
            <>
              <h2 className="font-display font-semibold text-xl text-text-primary dark:text-gray-100 mb-2">Forgot password?</h2>
              <p className="text-text-secondary dark:text-gray-400 text-sm mb-6">
                Enter your email and we&apos;ll generate a reset link.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />

                {error && (
                  <div className="p-3 rounded-lg text-sm bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400">
                    {error}
                  </div>
                )}

                <Button type="submit" loading={isSubmitting} className="w-full">
                  Send Reset Link
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link to="/login" className="inline-flex items-center gap-1 text-sm text-text-secondary dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400">
                  <ArrowLeft size={14} />
                  Back to login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
