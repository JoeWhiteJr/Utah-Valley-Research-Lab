import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { usersApi } from '../services/api'
import Button from '../components/Button'
import Input from '../components/Input'
import { User, Shield } from 'lucide-react'

export default function Settings() {
  const { user, updateUser } = useAuthStore()
  const [activeSection, setActiveSection] = useState('profile')

  // Profile state
  const [profileData, setProfileData] = useState({ name: '', email: '' })
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileMessage, setProfileMessage] = useState({ type: '', text: '' })

  // Password state
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    if (user) {
      setProfileData({ name: user.name, email: user.email })
    }
  }, [user])

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setIsSavingProfile(true)
    setProfileMessage({ type: '', text: '' })

    try {
      const { data } = await usersApi.updateProfile(profileData)
      updateUser(data.user)
      setProfileMessage({ type: 'success', text: 'Profile updated successfully' })
    } catch (error) {
      setProfileMessage({
        type: 'error',
        text: error.response?.data?.error?.message || 'Failed to update profile'
      })
    }
    setIsSavingProfile(false)
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPasswordMessage({ type: '', text: '' })

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match' })
      return
    }

    if (passwordData.newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 8 characters' })
      return
    }

    setIsSavingPassword(true)

    try {
      await usersApi.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      })
      setPasswordMessage({ type: 'success', text: 'Password changed successfully' })
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error) {
      setPasswordMessage({
        type: 'error',
        text: error.response?.data?.error?.message || 'Failed to change password'
      })
    }
    setIsSavingPassword(false)
  }

  const sections = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-text-primary">Settings</h1>
        <p className="mt-1 text-text-secondary">Manage your account and preferences.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar */}
        <nav className="md:w-48 flex md:flex-col gap-1">
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-organic text-sm font-medium transition-colors ${
                activeSection === id
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-text-secondary hover:bg-gray-100 hover:text-text-primary'
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1">
          {/* Profile */}
          {activeSection === 'profile' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="font-display font-semibold text-lg mb-6">Profile Information</h2>
              <form onSubmit={handleSaveProfile} className="space-y-5">
                <Input
                  label="Full name"
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  required
                />
                <Input
                  label="Email"
                  type="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                  required
                />
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">Role</label>
                  <p className="px-4 py-2.5 rounded-organic border border-gray-200 bg-gray-50 text-text-secondary capitalize">
                    {user?.role?.replace('_', ' ')}
                  </p>
                </div>

                {profileMessage.text && (
                  <div className={`p-3 rounded-lg text-sm ${
                    profileMessage.type === 'success'
                      ? 'bg-green-50 border border-green-200 text-green-700'
                      : 'bg-red-50 border border-red-200 text-red-600'
                  }`}>
                    {profileMessage.text}
                  </div>
                )}

                <Button type="submit" loading={isSavingProfile}>
                  Save Changes
                </Button>
              </form>
            </div>
          )}

          {/* Security */}
          {activeSection === 'security' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="font-display font-semibold text-lg mb-6">Change Password</h2>
              <form onSubmit={handleChangePassword} className="space-y-5">
                <Input
                  label="Current password"
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  required
                />
                <Input
                  label="New password"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="At least 8 characters"
                  required
                />
                <Input
                  label="Confirm new password"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  required
                />

                {passwordMessage.text && (
                  <div className={`p-3 rounded-lg text-sm ${
                    passwordMessage.type === 'success'
                      ? 'bg-green-50 border border-green-200 text-green-700'
                      : 'bg-red-50 border border-red-200 text-red-600'
                  }`}>
                    {passwordMessage.text}
                  </div>
                )}

                <Button type="submit" loading={isSavingPassword}>
                  Change Password
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
