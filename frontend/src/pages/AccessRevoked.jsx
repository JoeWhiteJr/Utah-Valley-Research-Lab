import { Link } from 'react-router-dom'
import { ShieldX } from 'lucide-react'
import Button from '../components/Button'

export default function AccessRevoked() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-display font-bold text-3xl text-primary-600">Stats Lab</h1>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
              <ShieldX className="w-7 h-7 text-red-500" />
            </div>
          </div>

          <h2 className="text-xl font-semibold text-text-primary mb-2">Access Revoked</h2>
          <p className="text-text-secondary text-sm mb-6">
            Your account has been deactivated by an administrator. If you believe this is an error, please contact the lab admin to restore your access.
          </p>

          <div className="space-y-3">
            <Link to="/">
              <Button className="w-full">Back to Home</Button>
            </Link>
            <p className="text-sm text-text-secondary">
              <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
                Try a different account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
