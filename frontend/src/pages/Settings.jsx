import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { usersApi, getUploadUrl } from '../services/api'
import Button from '../components/Button'
import Input from '../components/Input'
import { User, Shield, Bell } from 'lucide-react'

export default function Settings() {
  const { user, updateUser } = useAuthStore()
  const [activeSection, setActiveSection] = useState('profile')

  // Profile state
  const [profileData, setProfileData] = useState({ name: '', email: '' })
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileMessage, setProfileMessage] = useState({ type: '', text: '' })
  const [avatarUploading, setAvatarUploading] = useState(false)

  // Password state
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' })

  // Notification preferences state
  const [preferences, setPreferences] = useState(null)
  const [loadingPrefs, setLoadingPrefs] = useState(false)
  const [prefsMessage, setPrefsMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    if (user) {
      setProfileData({ name: user.name, email: user.email })
    }
  }, [user])

  useEffect(() => {
    if (activeSection === 'notifications') {
      setLoadingPrefs(true)
      usersApi.getPreferences()
        .then(({ data }) => setPreferences(data.preferences))
        .catch(() => setPreferences(null))
        .finally(() => setLoadingPrefs(false))
    }
  }, [activeSection])

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

  const handleTogglePref = async (key) => {
    const newVal = !preferences[key]
    setPreferences(prev => ({ ...prev, [key]: newVal }))
    try {
      await usersApi.updatePreferences({ [key]: newVal })
    } catch (error) {
      // Revert on error
      setPreferences(prev => ({ ...prev, [key]: !newVal }))
      setPrefsMessage({ type: 'error', text: 'Failed to update preference' })
    }
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
    { id: 'notifications', label: 'Notifications', icon: Bell },
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
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden">
                    {user?.avatar_url ? (
                      <img src={getUploadUrl(user.avatar_url)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-primary-700 font-bold text-xl">
                        {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="cursor-pointer inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-organic bg-gray-100 hover:bg-gray-200 text-text-primary transition-colors">
                      {avatarUploading ? 'Uploading...' : 'Change Photo'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={avatarUploading}
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          setAvatarUploading(true)
                          try {
                            const { data } = await usersApi.uploadAvatar(file)
                            updateUser(data.user)
                          } catch {
                            setProfileMessage({ type: 'error', text: 'Failed to upload avatar' })
                          }
                          setAvatarUploading(false)
                        }}
                      />
                    </label>
                    <p className="text-xs text-text-secondary mt-1">Max 5MB, JPG/PNG</p>
                  </div>
                </div>
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

          {/* Notifications */}
          {activeSection === 'notifications' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="font-display font-semibold text-lg mb-2">Notification Preferences</h2>
              <p className="text-sm text-text-secondary mb-6">Choose how you want to be notified.</p>

              {loadingPrefs ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                </div>
              ) : preferences ? (
                <div className="space-y-6">
                  {/* In-App Notifications */}
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary mb-3">In-App Notifications</h3>
                    <div className="space-y-3">
                      {[
                        { key: 'in_app_chat', label: 'Chat Messages', desc: 'New messages in your chat rooms' },
                        { key: 'in_app_mentions', label: 'Mentions', desc: 'When someone mentions you' },
                        { key: 'in_app_applications', label: 'Applications', desc: 'New application submissions' },
                        { key: 'in_app_system', label: 'System', desc: 'System announcements and updates' },
                      ].map(({ key, label, desc }) => (
                        <div key={key} className="flex items-center justify-between py-2">
                          <div>
                            <p className="text-sm font-medium text-text-primary">{label}</p>
                            <p className="text-xs text-text-secondary">{desc}</p>
                          </div>
                          <button
                            onClick={() => handleTogglePref(key)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              preferences[key] ? 'bg-primary-500' : 'bg-gray-300'
                            }`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              preferences[key] ? 'translate-x-6' : 'translate-x-1'
                            }`} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Email Notifications */}
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-sm font-semibold text-text-primary mb-1">Email Notifications</h3>
                    <p className="text-xs text-text-secondary mb-3">Email notifications are coming soon.</p>
                    <div className="space-y-3 opacity-60">
                      {[
                        { key: 'email_chat', label: 'Chat Messages' },
                        { key: 'email_mentions', label: 'Mentions' },
                        { key: 'email_applications', label: 'Applications' },
                        { key: 'email_system', label: 'System' },
                      ].map(({ key, label }) => (
                        <div key={key} className="flex items-center justify-between py-2">
                          <p className="text-sm font-medium text-text-primary">{label}</p>
                          <button
                            onClick={() => handleTogglePref(key)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              preferences[key] ? 'bg-primary-500' : 'bg-gray-300'
                            }`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              preferences[key] ? 'translate-x-6' : 'translate-x-1'
                            }`} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {prefsMessage.text && (
                    <div className={`p-3 rounded-lg text-sm ${
                      prefsMessage.type === 'error' ? 'bg-red-50 border border-red-200 text-red-600' : 'bg-green-50 border border-green-200 text-green-700'
                    }`}>
                      {prefsMessage.text}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-text-secondary text-sm">Failed to load preferences.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
