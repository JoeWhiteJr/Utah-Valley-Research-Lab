import { useState } from 'react'
import { Bell } from 'lucide-react'
import { useNotificationStore } from '../store/notificationStore'

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const { unreadCount, notifications, markAllRead, fetchNotifications } = useNotificationStore()

  const handleClick = () => {
    if (!isOpen) fetchNotifications({ limit: 10 })
    setIsOpen(!isOpen)
  }

  return (
    <div className="relative">
      <button onClick={handleClick} className="relative p-2 rounded-lg hover:bg-gray-100">
        <Bell size={20} />
        {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{unreadCount}</span>}
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border z-50">
          <div className="flex items-center justify-between p-3 border-b">
            <span className="font-semibold">Notifications</span>
            <button onClick={markAllRead} className="text-xs text-primary-600">Mark all read</button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-text-secondary">No notifications</div>
            ) : notifications.map((n) => (
              <div key={n.id} className={`p-3 border-b hover:bg-gray-50 ${!n.read_at ? 'bg-primary-50' : ''}`}>
                <div className="font-medium text-sm">{n.title}</div>
                {n.body && <div className="text-xs text-text-secondary">{n.body}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
