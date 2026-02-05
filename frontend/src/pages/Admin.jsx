import { useState, useEffect } from 'react'
import { useAdminStore } from '../store/adminStore'
import { useApplicationStore } from '../store/applicationStore'
import { LayoutDashboard, Users, ScrollText } from 'lucide-react'

export default function Admin() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const { stats, fetchStats } = useAdminStore()
  const { applications, fetchApplications, approveApplication, rejectApplication } = useApplicationStore()

  useEffect(() => { fetchStats(); fetchApplications() }, [fetchStats, fetchApplications])

  return (
    <div>
      <h1 className="font-display font-bold text-2xl mb-6">Admin Dashboard</h1>
      <div className="flex gap-2 border-b mb-6">
        {[['dashboard', 'Dashboard', LayoutDashboard], ['applications', 'Applications', Users]].map(([id, label, Icon]) => (
          <button key={id} onClick={() => setActiveTab(id)} className={`flex items-center gap-2 px-4 py-3 border-b-2 ${activeTab === id ? 'border-primary-500 text-primary-600' : 'border-transparent'}`}>
            <Icon size={18} />{label}
          </button>
        ))}
      </div>
      {activeTab === 'dashboard' && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-6 border"><div className="text-sm text-text-secondary">Users</div><div className="text-3xl font-bold">{stats?.users?.total_users || 0}</div></div>
          <div className="bg-white rounded-xl p-6 border"><div className="text-sm text-text-secondary">Pending</div><div className="text-3xl font-bold">{stats?.applications?.pending || 0}</div></div>
          <div className="bg-white rounded-xl p-6 border"><div className="text-sm text-text-secondary">Projects</div><div className="text-3xl font-bold">{stats?.projects?.active || 0}</div></div>
          <div className="bg-white rounded-xl p-6 border"><div className="text-sm text-text-secondary">Messages</div><div className="text-3xl font-bold">{stats?.chats?.messages_this_week || 0}</div></div>
        </div>
      )}
      {activeTab === 'applications' && (
        <div className="space-y-3">
          {applications.map((app) => (
            <div key={app.id} className="bg-white rounded-xl p-4 border flex items-center justify-between">
              <div>
                <div className="font-medium">{app.name}</div>
                <div className="text-sm text-text-secondary">{app.email}</div>
                <div className="text-sm text-text-secondary mt-1">{app.message?.slice(0, 100)}...</div>
              </div>
              {app.status === 'pending' && (
                <div className="flex gap-2">
                  <button onClick={() => approveApplication(app.id)} className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm">Approve</button>
                  <button onClick={() => rejectApplication(app.id)} className="px-3 py-1 bg-red-500 text-white rounded-lg text-sm">Reject</button>
                </div>
              )}
              {app.status !== 'pending' && <span className={`px-2 py-1 rounded text-xs ${app.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{app.status}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
