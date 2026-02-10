import { useCallback, useMemo, useRef } from 'react';
import { DndContext, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { EventBlock } from './EventBlock';
import type { CalendarEvent, CalendarScope, DeadlineEvent } from './types';
import { TIME_CONFIG } from './types';
import { useGridDragToCreate } from '../../hooks/useGridDragToCreate';

interface DailyViewProps {
  selectedDate: Date;
  events: CalendarEvent[];
  deadlines: DeadlineEvent[];
  hourHeight: number;
  onTimeClick: (time: Date) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onMoveEvent: (id: string, start_time: string, end_time: string) => void;
  onTimeRangeSelect?: (startTime: Date, endTime: Date) => void;
  scope: CalendarScope;
}

export function DailyView({
  selectedDate, events, deadlines, hourHeight,
  onTimeClick, onEditEvent, onMoveEvent, onTimeRangeSelect, scope,
}: DailyViewProps) {
  const mouseSensor = useSensor(MouseSensor, { activationConstraint: { distance: 5 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } });
  const sensors = useSensors(mouseSensor, touchSensor);

  const gridRef = useRef<HTMLDivElement>(null);

  const { dragState, justDraggedRef, onMouseDown, getPreviewStyle } = useGridDragToCreate({
    hourHeight,
    gridRef,
    onRangeSelected: onTimeRangeSelect || (() => {}),
    baseDate: selectedDate,
  });

  const hours = useMemo(() => {
    const h: number[] = [];
    for (let i = TIME_CONFIG.START_HOUR; i <= TIME_CONFIG.END_HOUR; i++) h.push(i);
    return h;
  }, []);

  const gridHeight = (TIME_CONFIG.END_HOUR - TIME_CONFIG.START_HOUR + 1) * hourHeight;

  // Filter events for this day
  const dayEvents = useMemo(() => {
    return events.filter((e) => {
      const s = new Date(e.start_time);
      return s.getFullYear() === selectedDate.getFullYear()
        && s.getMonth() === selectedDate.getMonth()
        && s.getDate() === selectedDate.getDate();
    });
  }, [events, selectedDate]);

  const handleTimeClick = useCallback(
    (e: React.MouseEvent, hour: number) => {
      if (justDraggedRef.current) return;

      const target = e.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      const clickY = e.clientY - rect.top;
      const minuteOffset = Math.round((clickY / hourHeight) * 60);

      const clickTime = new Date(selectedDate);
      clickTime.setHours(hour, minuteOffset, 0, 0);
      onTimeClick(clickTime);
    },
    [selectedDate, onTimeClick, hourHeight, justDraggedRef]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, delta } = event;
      const blockId = active.id as string;
      const blockData = active.data.current as { startTime: string; endTime: string } | undefined;

      if (blockData && delta.y !== 0) {
        const deltaMinutes = (delta.y / hourHeight) * 60;
        const oldStart = new Date(blockData.startTime);
        const oldEnd = new Date(blockData.endTime);
        const newStart = new Date(oldStart.getTime() + deltaMinutes * 60000);
        const duration = oldEnd.getTime() - oldStart.getTime();
        const newEnd = new Date(newStart.getTime() + duration);

        onMoveEvent(blockId, newStart.toISOString(), newEnd.toISOString());
      }
    },
    [hourHeight, onMoveEvent]
  );

  // Current time indicator
  const now = new Date();
  const isToday = now.getFullYear() === selectedDate.getFullYear()
    && now.getMonth() === selectedDate.getMonth()
    && now.getDate() === selectedDate.getDate();
  const currentTimeTop = isToday
    ? (now.getHours() + now.getMinutes() / 60 - TIME_CONFIG.START_HOUR) * hourHeight
    : -1;

  const previewStyle = getPreviewStyle();

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex relative" style={{ height: gridHeight }}>
        {/* Hour Labels */}
        <div className="w-14 flex-shrink-0 relative">
          {hours.map((hour) => (
            <div
              key={hour}
              className="absolute left-0 w-14 pr-2 text-right"
              style={{ top: (hour - TIME_CONFIG.START_HOUR) * hourHeight }}
            >
              <span className="text-xs text-gray-400 dark:text-gray-500 -mt-2 block">
                {hour === 0 ? '12a' : hour < 12 ? `${hour}a` : hour === 12 ? '12p' : `${hour - 12}p`}
              </span>
            </div>
          ))}
        </div>

        {/* Time Grid */}
        <div className="flex-1 relative" ref={gridRef}>
          {hours.map((hour) => (
            <div
              key={hour}
              onClick={(e) => handleTimeClick(e, hour)}
              onMouseDown={(e) => onMouseDown(e)}
              className="absolute left-0 right-0 border-t border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-indigo-50/30 dark:hover:bg-indigo-900/20"
              style={{ top: (hour - TIME_CONFIG.START_HOUR) * hourHeight, height: hourHeight }}
            />
          ))}

          {/* Drag preview */}
          {previewStyle && (
            <div
              className="absolute left-1 right-1 rounded-lg border-2 border-dashed border-indigo-400 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/30 pointer-events-none z-30"
              style={{ top: previewStyle.top, height: previewStyle.height }}
            />
          )}

          {/* Events */}
          {dayEvents.map((event) => (
            <EventBlock
              key={event.id}
              event={event}
              hourHeight={hourHeight}
              onEdit={onEditEvent}
              onResize={onMoveEvent}
              readOnly={scope === 'dashboard' && event.scope === 'project'}
            />
          ))}

          {/* Deadline markers */}
          {deadlines.map((dl) => {
            const d = new Date(dl.due_date);
            if (d.getFullYear() !== selectedDate.getFullYear() || d.getMonth() !== selectedDate.getMonth() || d.getDate() !== selectedDate.getDate()) return null;
            return (
              <div
                key={dl.id}
                className="absolute left-0 right-0 flex items-center gap-1 px-2 py-0.5 text-[0.6rem] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border-l-2 border-amber-400 z-5"
                style={{ top: 0 }}
              >
                <span className="font-medium truncate">{dl.title}</span>
                <span className="text-amber-500 dark:text-amber-400 flex-shrink-0">deadline</span>
              </div>
            );
          })}

          {/* Current time line */}
          {isToday && currentTimeTop >= 0 && (
            <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: currentTimeTop }}>
              <div className="flex items-center">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1" />
                <div className="flex-1 h-0.5 bg-red-500" />
              </div>
            </div>
          )}
        </div>
      </div>
    </DndContext>
  );
}

export default DailyView;
