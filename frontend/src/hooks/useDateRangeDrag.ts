import { useState, useRef, useCallback, useEffect } from 'react';

interface UseDateRangeDragOptions {
  onRangeSelected: (startDate: Date, endDate: Date) => void;
  enabled?: boolean;
}

interface UseDateRangeDragReturn {
  dragStartDate: Date | null;
  dragCurrentDate: Date | null;
  isDragging: boolean;
  onCellMouseDown: (date: Date) => void;
  onCellMouseEnter: (date: Date) => void;
  onMouseUp: () => void;
  isInRange: (date: Date) => boolean;
}

export function useDateRangeDrag({
  onRangeSelected,
  enabled = true,
}: UseDateRangeDragOptions): UseDateRangeDragReturn {
  const [dragStartDate, setDragStartDate] = useState<Date | null>(null);
  const [dragCurrentDate, setDragCurrentDate] = useState<Date | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<Date | null>(null);
  const dragCurrentRef = useRef<Date | null>(null);

  const onCellMouseDown = useCallback(
    (date: Date) => {
      if (!enabled) return;
      dragStartRef.current = date;
      dragCurrentRef.current = date;
      setDragStartDate(date);
      setDragCurrentDate(date);
      setIsDragging(true);
    },
    [enabled]
  );

  const onCellMouseEnter = useCallback(
    (date: Date) => {
      if (!isDragging) return;
      dragCurrentRef.current = date;
      setDragCurrentDate(date);
    },
    [isDragging]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseUp = () => {
      const start = dragStartRef.current;
      const current = dragCurrentRef.current;

      if (start && current) {
        const startTime = start.getTime();
        const currentTime = current.getTime();

        // Only fire range selection if dragged across different days
        if (startTime !== currentTime) {
          const minDate = new Date(Math.min(startTime, currentTime));
          const maxDate = new Date(Math.max(startTime, currentTime));

          // Set to beginning/end of day
          minDate.setHours(0, 0, 0, 0);
          maxDate.setHours(23, 59, 59, 999);

          onRangeSelected(minDate, maxDate);
        }
      }

      dragStartRef.current = null;
      dragCurrentRef.current = null;
      setDragStartDate(null);
      setDragCurrentDate(null);
      setIsDragging(false);
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [isDragging, onRangeSelected]);

  const isInRange = useCallback(
    (date: Date): boolean => {
      if (!dragStartDate || !dragCurrentDate || !isDragging) return false;

      const start = Math.min(dragStartDate.getTime(), dragCurrentDate.getTime());
      const end = Math.max(dragStartDate.getTime(), dragCurrentDate.getTime());
      const check = new Date(date);
      check.setHours(12, 0, 0, 0); // Normalize to midday for comparison

      const startNorm = new Date(start);
      startNorm.setHours(0, 0, 0, 0);
      const endNorm = new Date(end);
      endNorm.setHours(23, 59, 59, 999);

      return check.getTime() >= startNorm.getTime() && check.getTime() <= endNorm.getTime();
    },
    [dragStartDate, dragCurrentDate, isDragging]
  );

  return {
    dragStartDate,
    dragCurrentDate,
    isDragging,
    onCellMouseDown,
    onCellMouseEnter,
    onMouseUp: () => {},
    isInRange,
  };
}
