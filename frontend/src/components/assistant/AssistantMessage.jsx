import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FileText, User, Bot } from 'lucide-react'

export default function AssistantMessage({ message }) {
  const isUser = message.role === 'user'
  const citations = message.citations || []
  const [expandedCitation, setExpandedCitation] = useState(null)

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser
          ? 'bg-primary-100 dark:bg-primary-900/50'
          : 'bg-purple-100 dark:bg-purple-900/50'
      }`}>
        {isUser
          ? <User size={16} className="text-primary-600 dark:text-primary-400" />
          : <Bot size={16} className="text-purple-600 dark:text-purple-400" />
        }
      </div>

      {/* Message content */}
      <div className={`flex-1 min-w-0 ${isUser ? 'text-right' : ''}`}>
        <div className={`inline-block max-w-full text-left rounded-lg px-4 py-2.5 ${
          isUser
            ? 'bg-primary-600 text-white dark:bg-primary-700'
            : 'bg-gray-100 dark:bg-gray-700 text-text-primary dark:text-gray-100'
        }`}>
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="text-sm prose prose-sm dark:prose-invert max-w-none
              prose-p:my-1.5 prose-headings:my-2 prose-ul:my-1.5 prose-ol:my-1.5
              prose-li:my-0.5 prose-code:text-purple-600 dark:prose-code:text-purple-400
              prose-pre:bg-gray-200 dark:prose-pre:bg-gray-800 prose-pre:rounded-md">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Citations */}
        {!isUser && citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {citations.map((citation, i) => (
              <div key={i} className="relative">
                <button
                  onClick={() => setExpandedCitation(expandedCitation === i ? null : i)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full
                    bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300
                    hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                >
                  <FileText size={10} />
                  Source {citation.sourceIndex}: {citation.fileName}
                </button>

                {/* Tooltip/preview */}
                {expandedCitation === i && (
                  <div className="absolute left-0 bottom-full mb-1 z-10 w-72 p-3 rounded-lg shadow-lg
                    bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600
                    text-xs text-text-secondary dark:text-gray-300">
                    <p className="font-medium text-text-primary dark:text-gray-100 mb-1">
                      {citation.fileName}
                    </p>
                    <p className="text-gray-500 dark:text-gray-400 mb-1.5">
                      Project: {citation.projectTitle}
                    </p>
                    <p className="line-clamp-4">{citation.chunkPreview}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
