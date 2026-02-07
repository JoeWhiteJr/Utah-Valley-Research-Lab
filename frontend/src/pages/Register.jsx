import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import Input from '../components/Input'
import Button from '../components/Button'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [localError, setLocalError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [registrationSuccess, setRegistrationSuccess] = useState(false)
  const { register, error, clearError, token } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    document.title = 'Register - Stats Lab'
  }, [])

  useEffect(() => {
    if (token && !registrationSuccess) {
      navigate('/dashboard')
    }
  }, [token, navigate, registrationSuccess])

  useEffect(() => {
    clearError()
    setLocalError('')
  }, [name, email, password, confirmPassword, clearError])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters')
      return
    }

    setIsSubmitting(true)
    const result = await register(name, email, password)
    setIsSubmitting(false)
    if (result?.requiresApproval) {
      setRegistrationSuccess(true)
    } else if (result?.success) {
      navigate('/dashboard')
    }
  }

  const displayError = localError || error

  if (registrationSuccess) {
    return (
      <div className="min-h-screen bg-background dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 text-center">
            <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
            <h2 className="font-display font-bold text-2xl text-gray-900 dark:text-gray-100 mb-2">Thank you for Registering!</h2>
            <p className="text-text-secondary dark:text-gray-400 mb-6">
              Your account is awaiting admin approval. You&apos;ll be able to log in once an administrator reviews your registration.
            </p>
            <Link
              to="/"
              className="inline-block px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
            >
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-display font-bold text-3xl text-primary-600">Stats Lab</h1>
          <p className="mt-2 text-text-secondary dark:text-gray-400">Create your account to get started.</p>
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Full name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              required
            />

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
            />

            <Input
              label="Confirm password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
            />

            {displayError && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-sm text-red-600 dark:text-red-400">
                {displayError}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              loading={isSubmitting}
            >
              Create account
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary dark:text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium">
              Sign in
            </Link>
          </p>
        </div>

        {/* Home Link */}
        <div className="mt-6 text-center">
          <Link to="/" className="text-sm text-text-secondary dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
