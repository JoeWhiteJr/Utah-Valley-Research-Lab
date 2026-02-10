import { X, Calendar, FileText, StickyNote, FolderOpen } from 'lucide-react';
import { format } from 'date-fns';
import type { CalendarEvent } from './types';

interface EventDetailModalProps {
  event: CalendarEvent;
  onClose: () => void;
}

export function EventDetailModal({ event, onClose }: EventDetailModalProps) {
  const start = new Date(event.start_time);
  const end = new Date(event.end_time);
  const color = event.category_color || '#6366f1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Color bar + Header */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-1 h-8 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: color }} />
              <h2 className="font-semibold text-lg text-gray-900 dark:text-gray-100 truncate">
                {event.title}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          {/* Project badge */}
          {event.project_title && (
            <div className="mt-2 ml-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
              <FolderOpen size={12} />
              {event.project_title}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="p-5 space-y-4">
          {/* Time */}
          <div className="flex items-start gap-3">
            <Calendar size={16} className="text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {format(start, 'EEEE, MMMM d, yyyy')}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {event.all_day
                  ? 'All day'
                  : `${format(start, 'h:mm a')} - ${format(end, 'h:mm a')}`}
              </div>
            </div>
          </div>

          {/* Category */}
          {event.category_name && (
            <div className="flex items-center gap-2 ml-7">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-sm text-gray-600 dark:text-gray-400">{event.category_name}</span>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="flex items-start gap-3">
              <FileText size={16} className="text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{event.description}</p>
            </div>
          )}

          {/* Notes */}
          {event.notes && (
            <div className="flex items-start gap-3">
              <StickyNote size={16} className="text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{event.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default EventDetailModal;
