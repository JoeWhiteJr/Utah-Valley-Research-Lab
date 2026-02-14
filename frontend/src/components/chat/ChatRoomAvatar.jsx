import { Users } from 'lucide-react'
import { getUploadUrl } from '../../services/api'

const COLORS = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
  'bg-indigo-500', 'bg-teal-500', 'bg-orange-500', 'bg-cyan-500'
]

function hashName(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash)
}

function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return parts[0][0].toUpperCase()
}

export default function ChatRoomAvatar({ room, currentUserId, size = 40 }) {
  const style = { width: size, height: size, minWidth: size }

  if (room.type === 'direct') {
    const otherMember = room.members?.find(m => m.id !== currentUserId) || room.members?.[0]
    if (otherMember?.avatar_url) {
      return (
        <img
          src={getUploadUrl(otherMember.avatar_url)}
          alt={otherMember.name}
          className="rounded-full object-cover"
          style={style}
        />
      )
    }
    const name = otherMember?.name || 'User'
    const color = COLORS[hashName(name) % COLORS.length]
    return (
      <div className={`rounded-full ${color} flex items-center justify-center text-white font-semibold`} style={{ ...style, fontSize: size * 0.4 }}>
        {getInitials(name)}
      </div>
    )
  }

  // Group chat
  if (room.image_url) {
    return (
      <img
        src={getUploadUrl(room.image_url)}
        alt={room.name || 'Group'}
        className="rounded-full object-cover"
        style={style}
      />
    )
  }

  return (
    <div className="rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-500 dark:text-gray-300" style={style}>
      <Users size={size * 0.5} />
    </div>
  )
}
