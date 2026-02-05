import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useChatStore } from '../store/chatStore'
import { useAuthStore } from '../store/authStore'
import { usersApi } from '../services/api'
import Modal from '../components/Modal'
import Button from '../components/Button'
import Input from '../components/Input'
import { MessageCircle, Plus } from 'lucide-react'

export default function Chat() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { rooms, currentRoom, fetchRooms, fetchRoom, clearCurrentRoom, createRoom } = useChatStore()
  const { user } = useAuthStore()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [chatName, setChatName] = useState('')
  const [chatType, setChatType] = useState('group')
  const [selectedMembers, setSelectedMembers] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const isAdmin = user?.role === 'admin'

  useEffect(() => { fetchRooms() }, [fetchRooms])
  useEffect(() => {
    if (roomId) fetchRoom(roomId)
    else clearCurrentRoom()
  }, [roomId, fetchRoom, clearCurrentRoom])

  const handleOpenCreate = async () => {
    setCreateError('')
    setChatName('')
    setChatType('group')
    setSelectedMembers([])
    try {
      const { data } = await usersApi.team()
      setAllUsers(data.users.filter(u => u.id !== user.id))
    } catch (error) {
      console.error('Failed to load users:', error)
    }
    setShowCreateModal(true)
  }

  const handleCreateChat = async (e) => {
    e.preventDefault()
    setCreateError('')

    if (selectedMembers.length === 0) {
      setCreateError('Please select at least one member')
      return
    }

    setIsCreating(true)
    const room = await createRoom(chatType, selectedMembers, chatName || undefined)
    setIsCreating(false)

    if (room) {
      setShowCreateModal(false)
      navigate(`/chat/${room.id}`)
    } else {
      setCreateError('Failed to create chat')
    }
  }

  const toggleMember = (userId) => {
    setSelectedMembers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  return (
    <div className="h-[calc(100vh-7rem)] flex bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="w-80 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b font-semibold flex items-center justify-between">
          <span>Messages</span>
          {isAdmin && (
            <button
              onClick={handleOpenCreate}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-text-secondary hover:text-primary-600"
              title="New Chat"
            >
              <Plus size={20} />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {rooms.map((room) => (
            <a key={room.id} href={`/chat/${room.id}`} className={`block px-4 py-3 hover:bg-gray-50 ${currentRoom?.id === room.id ? 'bg-primary-50' : ''}`}>
              <div className="font-medium">{room.name || 'Chat'}</div>
              <div className="text-sm text-text-secondary truncate">{room.last_message?.content || 'No messages'}</div>
            </a>
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        {currentRoom ? (
          <div className="flex-1 p-4">Chat room: {currentRoom.name || currentRoom.id}</div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 text-primary-200 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Welcome to Chat</h2>
              <p className="text-text-secondary mb-4">Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* Create Chat Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="New Chat">
        <form onSubmit={handleCreateChat} className="space-y-5">
          <Input
            label="Chat Name"
            value={chatName}
            onChange={(e) => setChatName(e.target.value)}
            placeholder="e.g., Project Discussion"
          />
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Type</label>
            <select
              value={chatType}
              onChange={(e) => setChatType(e.target.value)}
              className="w-full px-4 py-2.5 rounded-organic border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              <option value="direct">Direct Message</option>
              <option value="group">Group Chat</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Members</label>
            <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-organic">
              {allUsers.map((u) => (
                <label
                  key={u.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(u.id)}
                    onChange={() => toggleMember(u.id)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-300"
                  />
                  <span className="text-sm">{u.name}</span>
                  <span className="text-xs text-text-secondary capitalize ml-auto">{u.role?.replace('_', ' ')}</span>
                </label>
              ))}
            </div>
          </div>

          {createError && (
            <div className="p-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-600">
              {createError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button type="submit" loading={isCreating}>Create Chat</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
