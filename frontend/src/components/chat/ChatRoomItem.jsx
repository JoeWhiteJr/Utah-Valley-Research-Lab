import { useState, useRef, useEffect } from 'react'
import { Pin, BellOff, MoreVertical, Image, Archive, Ban, Trash2 } from 'lucide-react'
import ChatRoomAvatar from './ChatRoomAvatar'
import { formatDistanceToNow } from 'date-fns'

export default function ChatRoomItem({
  room, isActive, currentUserId, isAdmin,
  onNavigate, onPin, onMute, onMarkUnread, onArchive, onMediaViewer, onBlock, onDelete
}) {
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!showMenu) return
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMenu])

  const otherMember = room.type === 'direct'
    ? room.members?.find(m => m.id !== currentUserId) || room.members?.[0]
    : null
  const displayName = room.type === 'direct' ? (otherMember?.name || 'User') : (room.name || 'Group Chat')

  const handleMenuAction = (action) => {
    setShowMenu(false)
    action()
  }

  const lastMsgTime = room.last_message?.created_at
    ? formatDistanceToNow(new Date(room.last_message.created_at), { addSuffix: false })
    : null

  return (
    <div
      className={`group relative flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700/50 ${
        isActive ? 'bg-primary-50 dark:bg-primary-900/30' : ''
      }`}
      onClick={() => onNavigate(room.id)}
    >
      <ChatRoomAvatar room={room} currentUserId={currentUserId} size={40} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-medium text-sm truncate dark:text-gray-100">{displayName}</span>
            {room.pinned_at && <Pin size={12} className="text-gray-400 dark:text-gray-500 flex-shrink-0 rotate-45" />}
            {room.muted && <BellOff size={12} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
            {lastMsgTime && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500">{lastMsgTime}</span>
            )}
            {room.unread_count > 0 ? (
              <span className="px-1.5 py-0.5 text-[10px] bg-primary-500 text-white rounded-full min-w-[18px] text-center font-medium">
                {room.unread_count}
              </span>
            ) : room.marked_unread ? (
              <span className="w-2.5 h-2.5 rounded-full bg-primary-500 flex-shrink-0"></span>
            ) : null}
          </div>
        </div>
        <p className="text-xs text-text-secondary dark:text-gray-400 truncate mt-0.5">
          {room.last_message?.sender_name && <span className="font-medium">{room.last_message.sender_name}: </span>}
          {room.last_message?.content || 'No messages yet'}
        </p>
      </div>

      {/* Three-dot menu */}
      <div className="relative flex-shrink-0" ref={menuRef}>
        <button
          onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu) }}
          className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 dark:text-gray-500 transition-opacity"
        >
          <MoreVertical size={16} />
        </button>
        {showMenu && (
          <div className="absolute right-0 top-8 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 py-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => handleMenuAction(() => onPin(room.id))}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-text-primary dark:text-gray-100 flex items-center gap-2"
            >
              <Pin size={14} className={room.pinned_at ? 'rotate-45' : ''} />
              {room.pinned_at ? 'Unpin chat' : 'Pin chat'}
            </button>
            <button
              onClick={() => handleMenuAction(() => onMute(room.id))}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-text-primary dark:text-gray-100 flex items-center gap-2"
            >
              <BellOff size={14} />
              {room.muted ? 'Unmute notifications' : 'Mute notifications'}
            </button>
            {!isActive && (
              <button
                onClick={() => handleMenuAction(() => onMarkUnread(room.id))}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-text-primary dark:text-gray-100 flex items-center gap-2"
              >
                <span className="w-3.5 h-3.5 rounded-full border-2 border-current flex-shrink-0"></span>
                Mark as unread
              </button>
            )}
            <button
              onClick={() => handleMenuAction(() => onMediaViewer(room.id))}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-text-primary dark:text-gray-100 flex items-center gap-2"
            >
              <Image size={14} />
              Media & Files
            </button>
            <button
              onClick={() => handleMenuAction(() => onArchive(room.id))}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-text-primary dark:text-gray-100 flex items-center gap-2"
            >
              <Archive size={14} />
              {room.archived_at ? 'Unarchive' : 'Archive'}
            </button>
            {room.type === 'direct' && otherMember && (
              <button
                onClick={() => handleMenuAction(() => onBlock(otherMember.id))}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-red-500 dark:text-red-400 flex items-center gap-2"
              >
                <Ban size={14} />
                Block user
              </button>
            )}
            {isAdmin && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                <button
                  onClick={() => handleMenuAction(() => onDelete(room.id))}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 dark:text-red-400 flex items-center gap-2"
                >
                  <Trash2 size={14} />
                  Delete chat
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
