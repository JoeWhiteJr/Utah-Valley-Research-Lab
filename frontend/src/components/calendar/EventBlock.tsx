import { useState, useRef, useEffect } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { CalendarEvent } from './types';
import { TIME_CONFIG } from './types';

interface EventBlockProps {
  event: CalendarEvent;
  hourHeight: number;
  onEdit: (event: CalendarEvent) => void;
  onResize?: (id: string, start_time: string, end_time: string) => void;
}

export function EventBlock({ event, hourHeight, onEdit, onResize }: EventBlockProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: event.id,
    data: { startTime: event.start_time, endTime: event.end_time },
  });

  const [isResizing, setIsResizing] = useState(false);
  const [resizeDeltaY, setResizeDeltaY] = useState(0);
  const resizeStartY = useRef(0);

  const start = new Date(event.start_time);
  const end = new Date(event.end_time);

  const startHour = start.getHours() + start.getMinutes() / 60;
  const endHour = end.getHours() + end.getMinutes() / 60;

  const top = (startHour - TIME_CONFIG.START_HOUR) * hourHeight;
  const baseHeight = Math.max((endHour - startHour) * hourHeight, hourHeight / 4);

  // Snap resize delta to 15-min increments
  const snap15 = (hourHeight / 60) * 15;
  const snappedDelta = isResizing ? Math.round(resizeDeltaY / snap15) * snap15 : 0;
  const height = Math.max(baseHeight + snappedDelta, snap15);
  const isCompact = height < 40;

  const color = event.category_color || '#6366f1';

  const formatTime = (d: Date) => {
    const h = d.getHours();
    const m = d.getMinutes();
    const period = h >= 12 ? 'p' : 'a';
    const hour = h % 12 || 12;
    return m === 0 ? `${hour}${period}` : `${hour}:${m.toString().padStart(2, '0')}${period}`;
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    resizeStartY.current = e.clientY;
    setIsResizing(true);
    setResizeDeltaY(0);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      setResizeDeltaY(e.clientY - resizeStartY.current);
    };

    const handleMouseUp = (e: MouseEvent) => {
      const delta = e.clientY - resizeStartY.current;
      const snapped = Math.round(delta / snap15) * snap15;
      const finalHeight = Math.max(baseHeight + snapped, snap15);
      const durationHours = finalHeight / hourHeight;
      const newEndTotalMinutes = Math.round((startHour + durationHours) * 60);
      const clampedMinutes = Math.min(newEndTotalMinutes, (TIME_CONFIG.END_HOUR + 1) * 60);
      const newEnd = new Date(start);
      newEnd.setHours(Math.floor(clampedMinutes / 60), clampedMinutes % 60, 0, 0);

      if (onResize && newEnd.getTime() > start.getTime()) {
        onResize(event.id, event.start_time, newEnd.toISOString());
      }

      setIsResizing(false);
      setResizeDeltaY(0);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, snap15, baseHeight, hourHeight, startHour, start, event.id, event.start_time, onResize]);

  const style: React.CSSProperties = {
    position: 'absolute',
    top,
    height,
    left: '4px',
    right: '4px',
    backgroundColor: `${color}20`,
    borderLeft: `3px solid ${color}`,
    zIndex: isDragging || isResizing ? 50 : 10,
    opacity: isDragging ? 0.8 : 1,
    transform: transform ? `translate(0, ${transform.y}px)` : undefined,
    cursor: isResizing ? 's-resize' : 'grab',
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
      data-event-block
      onClick={(e) => { e.stopPropagation(); onEdit(event); }}
      className="rounded-lg px-2 py-1 overflow-hidden hover:shadow-md transition-shadow group"
    >
      <div className={`font-medium text-gray-900 dark:text-gray-100 truncate ${isCompact ? 'text-[0.6rem]' : 'text-xs'}`}>
        {event.title}
      </div>
      {!isCompact && (
        <>
          <div className="text-[0.65rem] text-gray-500 dark:text-gray-400">
            {formatTime(start)} - {formatTime(end)}
          </div>
          {event.project_title && (
            <div className="text-[0.6rem] text-gray-400 dark:text-gray-500 truncate mt-0.5">
              {event.project_title}
            </div>
          )}
        </>
      )}
      {/* Resize handle */}
      {onResize && (
        <div
          onMouseDown={handleResizeStart}
          className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: `linear-gradient(transparent, ${color}40)` }}
        />
      )}
    </div>
  );
}

export default EventBlock;
