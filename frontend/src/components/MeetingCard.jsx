import { useState, memo } from 'react'
import { Mic, FileText, Sparkles, Trash2, Calendar, ChevronDown, ChevronUp, StickyNote } from 'lucide-react'
import { format } from 'date-fns'
import AudioPlayer from './AudioPlayer'
import { RichTextContent } from './RichTextEditor'

const MeetingCard = memo(function MeetingCard({ meeting, onView, onDelete }) {
  const [isExpanded, setIsExpanded] = useState(false)

  const hasAudio = !!meeting.audio_path
  const hasTranscript = !!meeting.transcript
  const hasSummary = !!meeting.summary
  const hasNotes = !!meeting.notes

  return (
    <div className="group bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-primary-300 dark:hover:border-primary-500 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${hasAudio ? 'bg-secondary-100 text-secondary-600 dark:bg-secondary-900/30 dark:text-secondary-300' : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'}`}>
            <Mic size={20} />
          </div>
          <div>
            <h4
              className="font-medium text-text-primary dark:text-gray-100 cursor-pointer hover:text-primary-600 dark:hover:text-primary-400"
              onClick={() => onView?.(meeting)}
            >
              {meeting.title}
            </h4>
            <div className="flex items-center gap-3 mt-1 text-xs text-text-secondary dark:text-gray-400">
              {meeting.recorded_at && (
                <span className="flex items-center gap-1">
                  <Calendar size={12} />
                  {format(new Date(meeting.recorded_at), 'MMM d, yyyy')}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onDelete(meeting.id)}
            className="p-1.5 rounded text-text-secondary dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Delete meeting"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Status badges */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
          hasAudio ? 'bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
        }`}>
          <Mic size={12} />
          {hasAudio ? 'Has audio' : 'No audio'}
        </span>
        {hasTranscript ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
            <FileText size={12} />
            Transcribed
          </span>
        ) : (
          <button
            onClick={() => onView?.(meeting)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <FileText size={12} />
            No transcript
          </button>
        )}
        {hasSummary ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
            <Sparkles size={12} />
            Summarized
          </span>
        ) : (
          <button
            onClick={() => onView?.(meeting)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <Sparkles size={12} />
            No summary
          </button>
        )}
        {hasNotes && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            <StickyNote size={12} />
            Has notes
          </span>
        )}
      </div>

      {/* Audio Player - show when audio exists */}
      {hasAudio && (
        <div className="mt-3">
          <AudioPlayer meetingId={meeting.id} />
        </div>
      )}

      {/* Open Meeting Notes button */}
      <button
        onClick={() => onView?.(meeting)}
        className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-text-secondary dark:text-gray-400 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-primary-300 dark:hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
      >
        <FileText size={14} />
        Open Meeting Notes
      </button>

      {/* Expandable notes section */}
      {hasNotes && (
        <div className="mt-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-sm text-text-secondary dark:text-gray-400 hover:text-text-primary dark:hover:text-gray-100 transition-colors"
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {isExpanded ? 'Hide notes' : 'Show notes'}
          </button>

          {isExpanded && (
            <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <RichTextContent content={meeting.notes} className="text-sm" />
            </div>
          )}
        </div>
      )}
    </div>
  )
})

export default MeetingCard
