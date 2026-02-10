import { useMemo, useCallback, useRef } from 'react';
import { startOfWeek, addDays, isSameDay, isToday, format } from 'date-fns';
import { EventBlock } from './EventBlock';
import type { CalendarEvent, CalendarScope, DeadlineEvent } from './types';
import { TIME_CONFIG } from './types';
import { useGridDragToCreate } from '../../hooks/useGridDragToCreate';

interface WeeklyViewProps {
  selectedDate: Date;
  events: CalendarEvent[];
  deadlines: DeadlineEvent[];
  hourHeight: number;
  onTimeClick: (time: Date) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onMoveEvent: (id: string, start_time: string, end_time: string) => void;
  onTimeRangeSelect?: (startTime: Date, endTime: Date) => void;
  onSelectDate: (date: Date) => void;
  scope: CalendarScope;
}

export function WeeklyView({
  selectedDate, events, deadlines, hourHeight,
  onTimeClick, onEditEvent, onMoveEvent, onTimeRangeSelect, onSelectDate, scope,
}: WeeklyViewProps) {
  const weekStart = useMemo(() => startOfWeek(selectedDate, { weekStartsOn: 0 }), [selectedDate]);
  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) days.push(addDays(weekStart, i));
    return days;
  }, [weekStart]);

  const hours = useMemo(() => {
    const h: number[] = [];
    for (let i = TIME_CONFIG.START_HOUR; i <= TIME_CONFIG.END_HOUR; i++) h.push(i);
    return h;
  }, []);

  const blocksByDay = useMemo(() => {
    return weekDays.map((day) => ({
      date: day,
      blocks: events.filter((e) => isSameDay(new Date(e.start_time), day)),
    }));
  }, [weekDays, events]);

  const gridHeight = (TIME_CONFIG.END_HOUR - TIME_CONFIG.START_HOUR + 1) * hourHeight;

  const formatHour = (hour: number) => {
    if (hour === 0) return '12a';
    if (hour < 12) return `${hour}a`;
    if (hour === 12) return '12p';
    return `${hour - 12}p`;
  };

  // Refs for each day column to support drag-to-create
  const columnRefs = useRef<(HTMLDivElement | null)[]>([]);
  // We use the first column ref as the gridRef for the hook, but we need per-column Y coords
  // Instead, use a wrapper ref for the entire grid area
  const gridRef = useRef<HTMLDivElement>(null);

  const getDateForColumn = useCallback(
    (columnIndex: number): Date | null => {
      return weekDays[columnIndex] || null;
    },
    [weekDays]
  );

  const { justDraggedRef, onMouseDown, getPreviewStyle } = useGridDragToCreate({
    hourHeight,
    gridRef,
    onRangeSelected: onTimeRangeSelect || (() => {}),
    getDateForColumn,
    baseDate: selectedDate,
  });

  const handleColumnClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, day: Date) => {
      if (justDraggedRef.current) return;

      const target = e.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      const clickY = e.clientY - rect.top;
      const fractionalHour = clickY / hourHeight;
      const hour = Math.floor(fractionalHour) + TIME_CONFIG.START_HOUR;
      const minutes = Math.round((fractionalHour % 1) * 60);

      const clickTime = new Date(day);
      clickTime.setHours(hour, minutes, 0, 0);
      onTimeClick(clickTime);
    },
    [hourHeight, onTimeClick, justDraggedRef]
  );

  // Current time indicator
  const now = new Date();

  const previewStyle = getPreviewStyle();

  return (
    <div className="flex flex-col bg-white dark:bg-gray-900">
      {/* Week Header */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <div className="w-14 flex-shrink-0" />
        {weekDays.map((day, index) => {
          const selected = isSameDay(day, selectedDate);
          const today = isToday(day);

          return (
            <button
              key={index}
              onClick={() => onSelectDate(day)}
              className={`flex-1 py-2 text-center transition-colors ${
                selected ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''
              }`}
            >
              <div className="text-[0.65rem] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-0.5">
                {format(day, 'EEE')}
              </div>
              <div className={`text-lg font-medium relative ${
                selected ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-gray-100'
              }`}>
                {format(day, 'd')}
                {today && !selected && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-red-500" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Time Grid */}
      <div className="flex-1 overflow-auto">
        <div className="flex relative" ref={gridRef} style={{ height: gridHeight }}>
          {/* Hour Labels */}
          <div className="w-14 flex-shrink-0 relative">
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute left-0 w-14 pr-2 text-right"
                style={{ top: (hour - TIME_CONFIG.START_HOUR) * hourHeight }}
              >
                <span className="text-xs text-gray-400 dark:text-gray-500 -mt-2 block">{formatHour(hour)}</span>
              </div>
            ))}
          </div>

          {/* Day Columns */}
          {blocksByDay.map(({ date, blocks }, dayIndex) => {
            const selected = isSameDay(date, selectedDate);
            const today = isToday(date);

            return (
              <div
                key={dayIndex}
                ref={(el) => { columnRefs.current[dayIndex] = el; }}
                onClick={(e) => handleColumnClick(e, date)}
                onMouseDown={(e) => onMouseDown(e, dayIndex)}
                className={`flex-1 relative border-l border-gray-100 dark:border-gray-800 cursor-pointer ${selected ? 'bg-indigo-50/30 dark:bg-indigo-900/20' : ''}`}
              >
                {/* Hour lines */}
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="absolute left-0 right-0 border-t border-gray-100 dark:border-gray-800"
                    style={{ top: (hour - TIME_CONFIG.START_HOUR) * hourHeight }}
                  />
                ))}

                {/* Drag preview for this column */}
                {previewStyle && previewStyle.columnIndex === dayIndex && (
                  <div
                    className="absolute left-0.5 right-0.5 rounded-lg border-2 border-dashed border-indigo-400 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/30 pointer-events-none z-30"
                    style={{ top: previewStyle.top, height: previewStyle.height }}
                  />
                )}

                {/* Events */}
                {blocks.map((block) => (
                  <EventBlock
                    key={block.id}
                    event={block}
                    hourHeight={hourHeight}
                    onEdit={onEditEvent}
                    onResize={onMoveEvent}
                    readOnly={scope === 'dashboard' && block.scope === 'project'}
                  />
                ))}

                {/* Current time line for today */}
                {today && (() => {
                  const nowTop = (now.getHours() + now.getMinutes() / 60 - TIME_CONFIG.START_HOUR) * hourHeight;
                  if (nowTop < 0) return null;
                  return (
                    <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: nowTop }}>
                      <div className="h-0.5 bg-red-500" />
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default WeeklyView;
