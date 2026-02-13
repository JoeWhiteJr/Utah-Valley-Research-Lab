import { useMemo, useRef, useState, useCallback } from 'react';
import { startOfMonth, startOfWeek, addDays, isSameDay, isToday, isSameMonth, format } from 'date-fns';
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors, useDroppable, useDraggable } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import type { CalendarEvent, DeadlineEvent } from './types';
import { DAYS_SHORT } from './types';
import { useDateRangeDrag } from '../../hooks/useDateRangeDrag';

interface MonthlyViewProps {
  selectedDate: Date;
  events: CalendarEvent[];
  deadlines: DeadlineEvent[];
  onSelectDate: (date: Date) => void;
  onSwitchToDaily: (date: Date) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onMoveEvent: (id: string, start_time: string, end_time: string) => void;
  onTimeClick?: (time: Date) => void;
  onTimeRangeSelect?: (startTime: Date, endTime: Date) => void;
  scope: 'lab' | 'personal';
}

function DraggableEventPill({ event, onEditEvent }: { event: CalendarEvent; onEditEvent: (e: CalendarEvent) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: event.id,
    data: { startTime: event.start_time, endTime: event.end_time },
  });

  const style: React.CSSProperties = {
    backgroundColor: `${event.category_color || '#6366f1'}20`,
    ...(transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : {}),
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-event-item
      className="text-[0.55rem] truncate px-1 py-0.5 rounded text-gray-900 dark:text-gray-100"
      style={style}
      onClick={(e) => { e.stopPropagation(); onEditEvent(event); }}
    >
      {event.title}
    </div>
  );
}

function DroppableDayCell({ dayISO, children }: { dayISO: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: dayISO });

  return (
    <div ref={setNodeRef} className={`flex-1 space-y-0.5 overflow-hidden ${isOver ? 'ring-2 ring-indigo-400 rounded' : ''}`}>
      {children}
    </div>
  );
}

export function MonthlyView({
  selectedDate, events, deadlines,
  onSelectDate, onSwitchToDaily, onEditEvent, onMoveEvent, onTimeClick, onTimeRangeSelect,
}: MonthlyViewProps) {
  const justDraggedRef = useRef(false);

  const { isDragging, onCellMouseDown, onCellMouseEnter, isInRange } = useDateRangeDrag({
    onRangeSelected: (start, end) => {
      if (onTimeRangeSelect) {
        onTimeRangeSelect(start, end);
      }
      justDraggedRef.current = true;
      requestAnimationFrame(() => {
        justDraggedRef.current = false;
      });
    },
    enabled: !!onTimeRangeSelect,
  });

  // Drag-and-drop sensors
  const mouseSensor = useSensor(MouseSensor, { activationConstraint: { distance: 5 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } });
  const sensors = useSensors(mouseSensor, touchSensor);

  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const found = events.find((e) => e.id === event.active.id);
    setActiveEvent(found || null);
  }, [events]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveEvent(null);
    const { active, over } = event;
    if (!over) return;

    const eventId = active.id as string;
    const targetDayISO = over.id as string;
    const found = events.find((e) => e.id === eventId);
    if (!found) return;

    const oldStart = new Date(found.start_time);
    const oldEnd = new Date(found.end_time);
    const duration = oldEnd.getTime() - oldStart.getTime();
    const targetDay = new Date(targetDayISO);

    // Keep the same time, change only the date
    const newStart = new Date(targetDay);
    newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), oldStart.getSeconds(), oldStart.getMilliseconds());
    const newEnd = new Date(newStart.getTime() + duration);

    onMoveEvent(eventId, newStart.toISOString(), newEnd.toISOString());
  }, [events, onMoveEvent]);

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
    if (justDraggedRef.current) return;
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
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex-1 grid grid-rows-6">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-800">
            {week.map((day, dayIndex) => {
              const inCurrentMonth = isSameMonth(day, selectedDate);
              const selected = isSameDay(day, selectedDate);
              const today = isToday(day);
              const dayEvents = getEventsForDay(day);
              const dayDeadlines = getDeadlinesForDay(day);
              const inDragRange = isInRange(day);
              const dayISO = format(day, 'yyyy-MM-dd');

              return (
                <div
                  key={dayIndex}
                  onClick={() => handleDayClick(day)}
                  onMouseDown={(e) => {
                    if (e.button !== 0) return;
                    if ((e.target as HTMLElement).closest('[data-event-item]')) return;
                    onCellMouseDown(day);
                  }}
                  onMouseEnter={() => onCellMouseEnter(day)}
                  className={`
                    relative flex flex-col p-1.5 border-r border-gray-100 dark:border-gray-800 text-left transition-colors cursor-pointer select-none
                    ${inDragRange ? 'bg-indigo-100 dark:bg-indigo-900/30' : selected ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''}
                    ${!inCurrentMonth ? 'opacity-40' : ''}
                    ${!inDragRange ? 'hover:bg-gray-50 dark:hover:bg-gray-800' : ''}
                  `}
                  style={{ minHeight: '70px' }}
                >
                  <div className={`
                    w-6 h-6 flex items-center justify-center rounded-full text-sm font-medium mb-1
                    ${today ? 'bg-indigo-500 text-white' : selected ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-gray-100'}
                  `}>
                    {format(day, 'd')}
                  </div>

                  <DroppableDayCell dayISO={dayISO}>
                    {dayEvents.slice(0, 3).map((event) => (
                      <DraggableEventPill key={event.id} event={event} onEditEvent={onEditEvent} />
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
                  </DroppableDayCell>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <DragOverlay>
        {activeEvent ? (
          <div
            className="text-[0.55rem] truncate px-1 py-0.5 rounded text-gray-900 dark:text-gray-100 shadow-lg"
            style={{ backgroundColor: `${activeEvent.category_color || '#6366f1'}40` }}
          >
            {activeEvent.title}
          </div>
        ) : null}
      </DragOverlay>
      </DndContext>
    </div>
  );
}

export default MonthlyView;
