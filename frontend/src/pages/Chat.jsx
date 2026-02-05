import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useChatStore } from '../store/chatStore'
import { MessageCircle, Plus } from 'lucide-react'
import Button from '../components/Button'

export default function Chat() {
  const { roomId } = useParams()
  const { rooms, currentRoom, fetchRooms, fetchRoom, clearCurrentRoom } = useChatStore()

  useEffect(() => { fetchRooms() }, [fetchRooms])
  useEffect(() => {
    if (roomId) fetchRoom(roomId)
    else clearCurrentRoom()
  }, [roomId, fetchRoom, clearCurrentRoom])

  return (
    <div className="h-[calc(100vh-7rem)] flex bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="w-80 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b font-semibold">Messages</div>
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
    </div>
  )
}
