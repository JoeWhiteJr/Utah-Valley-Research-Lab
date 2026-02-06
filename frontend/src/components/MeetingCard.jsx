import { useState } from 'react'
import { Mic, FileText, Sparkles, Trash2, Calendar, ChevronDown, ChevronUp, StickyNote } from 'lucide-react'
import { format } from 'date-fns'
import AudioPlayer from './AudioPlayer'
import { RichTextContent } from './RichTextEditor'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export default function MeetingCard({ meeting, onView, onDelete, onEdit }) {
  const [isExpanded, setIsExpanded] = useState(false)

  const hasAudio = !!meeting.audio_path
  const hasTranscript = !!meeting.transcript
  const hasSummary = !!meeting.summary
  const hasNotes = !!meeting.notes

  // Construct audio URL from the path
  const getAudioUrl = () => {
    if (!meeting.audio_path) return null
    // The audio_path from backend is a full system path, we need to serve it via API
    return `${API_URL}/meetings/${meeting.id}/audio`
  }

  return (
    <div className="group bg-white rounded-lg border border-gray-200 p-4 hover:border-primary-300 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${hasAudio ? 'bg-secondary-100 text-secondary-600' : 'bg-gray-100 text-gray-400'}`}>
            <Mic size={20} />
          </div>
          <div>
            <h4
              className="font-medium text-text-primary cursor-pointer hover:text-primary-600"
              onClick={() => onView?.(meeting)}
            >
              {meeting.title}
            </h4>
            <div className="flex items-center gap-3 mt-1 text-xs text-text-secondary">
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
          {onEdit && (
            <button
              onClick={() => onEdit(meeting)}
              className="p-1.5 rounded text-text-secondary hover:text-primary-600 hover:bg-primary-50 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Edit"
            >
              <StickyNote size={16} />
            </button>
          )}
          <button
            onClick={() => onDelete(meeting.id)}
            className="p-1.5 rounded text-text-secondary hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Status badges */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
          hasAudio ? 'bg-secondary-100 text-secondary-700' : 'bg-gray-100 text-gray-500'
        }`}>
          <Mic size={12} />
          {hasAudio ? 'Has audio' : 'No audio'}
        </span>
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
          hasTranscript ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          <FileText size={12} />
          {hasTranscript ? 'Transcribed' : 'No transcript'}
        </span>
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
          hasSummary ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'
        }`}>
          <Sparkles size={12} />
          {hasSummary ? 'Summarized' : 'No summary'}
        </span>
        {hasNotes && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-amber-100 text-amber-700">
            <StickyNote size={12} />
            Has notes
          </span>
        )}
      </div>

      {/* Audio Player - show when audio exists */}
      {hasAudio && (
        <div className="mt-3">
          <AudioPlayer src={getAudioUrl()} />
        </div>
      )}

      {/* Summary preview */}
      {hasSummary && (
        <p className="mt-3 text-sm text-text-secondary line-clamp-2">
          {meeting.summary}
        </p>
      )}

      {/* Expandable notes section */}
      {hasNotes && (
        <div className="mt-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {isExpanded ? 'Hide notes' : 'Show notes'}
          </button>

          {isExpanded && (
            <div className="mt-2 p-3 bg-gray-50 rounded-lg">
              <RichTextContent content={meeting.notes} className="text-sm" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
