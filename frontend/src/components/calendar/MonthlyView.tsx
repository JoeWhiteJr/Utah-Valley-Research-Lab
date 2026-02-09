import { useMemo } from 'react';
import { startOfMonth, startOfWeek, addDays, isSameDay, isToday, isSameMonth, format } from 'date-fns';
import type { CalendarEvent, DeadlineEvent } from './types';
import { DAYS_SHORT } from './types';

interface MonthlyViewProps {
  selectedDate: Date;
  events: CalendarEvent[];
  deadlines: DeadlineEvent[];
  onSelectDate: (date: Date) => void;
  onSwitchToDaily: (date: Date) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onTimeClick?: (time: Date) => void;
  scope: 'lab' | 'personal';
}

export function MonthlyView({
  selectedDate, events, deadlines,
  onSelectDate, onSwitchToDaily, onEditEvent, onTimeClick,
}: MonthlyViewProps) {
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(selectedDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) days.push(addDays(calendarStart, i));
    return days;
  }, [selectedDate]);

  const weeks = useMemo(() => {
    const result: Date[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      result.push(calendarDays.slice(i, i + 7));
    }
    return result;
  }, [calendarDays]);

  const getEventsForDay = (day: Date) => {
    return events.filter((e) => isSameDay(new Date(e.start_time), day));
  };

  const getDeadlinesForDay = (day: Date) => {
    return deadlines.filter((dl) => isSameDay(new Date(dl.due_date), day));
  };

  const handleDayClick = (day: Date) => {
    onSelectDate(day);
    if (onTimeClick) {
      const noon = new Date(day);
      noon.setHours(12, 0, 0, 0);
      onTimeClick(noon);
    } else {
      onSwitchToDaily(day);
    }
  };

  return (
    <div className="flex flex-col bg-white dark:bg-gray-900">
      {/* Day Headers */}
      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
        {DAYS_SHORT.map((dayName) => (
          <div key={dayName} className="py-2 text-center text-[0.65rem] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {dayName}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 grid grid-rows-6">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-800">
            {week.map((day, dayIndex) => {
              const inCurrentMonth = isSameMonth(day, selectedDate);
              const selected = isSameDay(day, selectedDate);
              const today = isToday(day);
              const dayEvents = getEventsForDay(day);
              const dayDeadlines = getDeadlinesForDay(day);

              return (
                <button
                  key={dayIndex}
                  onClick={() => handleDayClick(day)}
                  className={`
                    relative flex flex-col p-1.5 border-r border-gray-100 dark:border-gray-800 text-left transition-colors
                    ${selected ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''}
                    ${!inCurrentMonth ? 'opacity-40' : ''}
                    hover:bg-gray-50 dark:hover:bg-gray-800
                  `}
                  style={{ minHeight: '70px' }}
                >
                  <div className={`
                    w-6 h-6 flex items-center justify-center rounded-full text-sm font-medium mb-1
                    ${today ? 'bg-indigo-500 text-white' : selected ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-gray-100'}
                  `}>
                    {format(day, 'd')}
                  </div>

                  <div className="flex-1 space-y-0.5 overflow-hidden">
                    {dayEvents.slice(0, 3).map((event) => (
                      <div
                        key={event.id}
                        className="text-[0.55rem] truncate px-1 py-0.5 rounded text-gray-900 dark:text-gray-100"
                        style={{
                          backgroundColor: `${event.category_color || '#6366f1'}20`,
                        }}
                        onClick={(e) => { e.stopPropagation(); onEditEvent(event); }}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[0.5rem] px-1 text-gray-400 dark:text-gray-500">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                    {dayDeadlines.map((dl) => (
                      <div
                        key={dl.id}
                        className="text-[0.55rem] truncate px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                      >
                        {dl.title}
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default MonthlyView;
