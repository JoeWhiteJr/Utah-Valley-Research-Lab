import { useState, useEffect, useRef } from 'react'

export default function MentionAutocomplete({ members, query, onSelect, position }) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const filtered = members.filter(m =>
    m.name?.toLowerCase().includes(query.toLowerCase()) ||
    m.user_name?.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 5)

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  if (filtered.length === 0 || !query) return null

  return (
    <div
      className="absolute bottom-full left-0 mb-1 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50"
    >
      {filtered.map((member, idx) => (
        <button
          key={member.user_id || member.id}
          onClick={() => onSelect(member)}
          className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${
            idx === selectedIndex ? 'bg-primary-50 dark:bg-primary-900/30' : ''
          }`}
        >
          <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-xs font-medium text-primary-700 dark:text-primary-300">
            {(member.name || member.user_name)?.charAt(0)?.toUpperCase()}
          </div>
          <span className="text-text-primary dark:text-gray-200">{member.name || member.user_name}</span>
        </button>
      ))}
    </div>
  )
}
