import { Bot } from 'lucide-react'
import { useAssistantStore } from '../../store/assistantStore'

export default function AssistantToggle() {
  const { toggleSidebar, isOpen } = useAssistantStore()

  return (
    <button
      onClick={toggleSidebar}
      className={`p-2 rounded-lg transition-colors ${
        isOpen
          ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400'
          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-text-secondary dark:text-gray-400'
      }`}
      title="AI Research Assistant"
      aria-label="Toggle AI Research Assistant"
    >
      <Bot size={18} />
    </button>
  )
}
