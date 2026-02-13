import { AlertTriangle } from 'lucide-react';
import type { DeadlineEvent } from './types';

interface DeadlineOverlayProps {
  deadlines: DeadlineEvent[];
}

export function DeadlineOverlay({ deadlines }: DeadlineOverlayProps) {
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Start of today
  const activeDeadlines = deadlines.filter((dl) => {
    const dueDate = new Date(dl.due_date);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate >= now || dl.completed;
  });

  if (activeDeadlines.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl mb-4">
      <div className="flex items-center gap-1 text-amber-700 dark:text-amber-300 text-xs font-medium w-full mb-1">
        <AlertTriangle size={14} />
        Upcoming Deadlines
      </div>
      {activeDeadlines.slice(0, 5).map((dl) => (
        <div
          key={dl.id}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
            dl.completed
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 line-through'
              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
          }`}
        >
          <span className="font-medium truncate max-w-[150px]">{dl.title}</span>
          {dl.project_title && (
            <span className="text-amber-500 dark:text-amber-400">({dl.project_title})</span>
          )}
        </div>
      ))}
      {activeDeadlines.length > 5 && (
        <span className="text-xs text-amber-500 dark:text-amber-400">+{activeDeadlines.length - 5} more</span>
      )}
    </div>
  );
}

export default DeadlineOverlay;
