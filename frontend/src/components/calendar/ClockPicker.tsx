import { useState, useRef, useCallback, useEffect } from 'react';

interface ClockPickerProps {
  value: Date;
  onChange: (time: Date) => void;
  label?: string;
}

type ClockMode = 'hour' | 'minute';

export function ClockPicker({ value, onChange, label }: ClockPickerProps) {
  const [mode, setMode] = useState<ClockMode>('hour');
  const [hoverAngle, setHoverAngle] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const clockRef = useRef<HTMLDivElement>(null);

  const hours = value.getHours();
  const minutes = value.getMinutes();
  const isPM = hours >= 12;
  const displayHour = hours % 12 || 12;

  const hourAngle = ((displayHour % 12) / 12) * 360 - 90;
  const minuteAngle = (minutes / 60) * 360 - 90;

  const processClockInteraction = useCallback(
    (clientX: number, clientY: number, finalize: boolean) => {
      const clock = clockRef.current;
      if (!clock) return;

      const rect = clock.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const x = clientX - rect.left - centerX;
      const y = clientY - rect.top - centerY;

      let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
      if (angle < 0) angle += 360;

      if (mode === 'hour') {
        let hour = Math.round(angle / 30);
        if (hour === 0) hour = 12;

        let newHour = hour;
        if (isPM && hour !== 12) newHour = hour + 12;
        if (!isPM && hour === 12) newHour = 0;

        const newTime = new Date(value);
        newTime.setHours(newHour);
        onChange(newTime);

        if (finalize) {
          setMode('minute');
        }
      } else {
        let minute = Math.round(angle / 6);
        if (minute === 60) minute = 0;

        const newTime = new Date(value);
        newTime.setMinutes(minute);
        onChange(newTime);
      }
    },
    [mode, value, onChange, isPM]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(true);
      processClockInteraction(e.clientX, e.clientY, false);
    },
    [processClockInteraction]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isDragging) return; // Document-level handler covers drag moves

      const clock = clockRef.current;
      if (!clock) return;

      const rect = clock.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const x = e.clientX - rect.left - centerX;
      const y = e.clientY - rect.top - centerY;

      // Bug B fix: use raw angle for smooth preview (no snapping)
      let angle = Math.atan2(y, x) * (180 / Math.PI);
      setHoverAngle(angle);
    },
    [isDragging]
  );

  const handleMouseLeave = useCallback(() => {
    if (!isDragging) {
      setHoverAngle(null);
    }
  }, [isDragging]);

  // Document-level mousemove/mouseup for drag support (Bug C fix)
  useEffect(() => {
    if (!isDragging) return;

    const handleDocMouseMove = (e: MouseEvent) => {
      processClockInteraction(e.clientX, e.clientY, false);
    };

    const handleDocMouseUp = (e: MouseEvent) => {
      processClockInteraction(e.clientX, e.clientY, true);
      setIsDragging(false);
      setHoverAngle(null);
    };

    document.addEventListener('mousemove', handleDocMouseMove);
    document.addEventListener('mouseup', handleDocMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleDocMouseMove);
      document.removeEventListener('mouseup', handleDocMouseUp);
    };
  }, [isDragging, processClockInteraction]);

  const togglePeriod = () => {
    const newTime = new Date(value);
    newTime.setHours(isPM ? hours - 12 : hours + 12);
    onChange(newTime);
  };

  const hourNumbers = Array.from({ length: 12 }, (_, i) => i + 1);
  const minuteMarks = Array.from({ length: 12 }, (_, i) => i * 5);

  return (
    <div className="space-y-4">
      {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>}

      {/* Time Display */}
      <div className="flex items-center justify-center gap-2 mb-4">
        <button
          onClick={() => setMode('hour')}
          className={`text-3xl font-bold transition-colors ${
            mode === 'hour' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'
          }`}
        >
          {displayHour.toString().padStart(2, '0')}
        </button>
        <span className="text-3xl font-bold text-gray-400 dark:text-gray-500">:</span>
        <button
          onClick={() => setMode('minute')}
          className={`text-3xl font-bold transition-colors ${
            mode === 'minute' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'
          }`}
        >
          {minutes.toString().padStart(2, '0')}
        </button>
        <button
          onClick={togglePeriod}
          className="ml-2 px-3 py-1 rounded-lg text-sm font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
        >
          {isPM ? 'PM' : 'AM'}
        </button>
      </div>

      {/* Clock Face */}
      <div
        ref={clockRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative w-56 h-56 mx-auto rounded-full cursor-pointer bg-gray-50 dark:bg-gray-800"
        style={{ boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.08)' }}
      >
        {/* Center Dot */}
        <div className="absolute top-1/2 left-1/2 w-3 h-3 -ml-1.5 -mt-1.5 rounded-full z-10 bg-indigo-500" />

        {/* Hand */}
        <div
          className="absolute top-1/2 left-1/2 origin-left h-0.5 rounded-full bg-indigo-500"
          style={{
            width: mode === 'hour' ? '60px' : '80px',
            transform: `rotate(${mode === 'hour' ? hourAngle : minuteAngle}deg)`,
            transition: isDragging ? 'none' : 'transform 200ms ease',
            zIndex: 5,
          }}
        />

        {/* Hand tip dot (Bug A fix: repositioned with explicit transformOrigin) */}
        <div
          className="absolute rounded-full bg-indigo-500"
          style={{
            width: '10px',
            height: '10px',
            top: 'calc(50% - 5px)',
            left: 'calc(50% - 5px)',
            transformOrigin: '5px 5px',
            transform: `rotate(${mode === 'hour' ? hourAngle : minuteAngle}deg) translateX(${mode === 'hour' ? 55 : 75}px)`,
            transition: isDragging ? 'none' : 'transform 200ms ease',
            zIndex: 6,
          }}
        />

        {/* Preview hand on hover */}
        {hoverAngle !== null && !isDragging && (
          <div
            className="absolute top-1/2 left-1/2 origin-left h-0.5 rounded-full bg-indigo-300"
            style={{
              width: mode === 'hour' ? '60px' : '80px',
              transform: `rotate(${hoverAngle}deg)`,
              zIndex: 4,
              opacity: 0.5,
            }}
          />
        )}

        {/* Numbers/Marks */}
        {mode === 'hour'
          ? hourNumbers.map((hour) => {
              const angle = ((hour / 12) * 360 - 90) * (Math.PI / 180);
              const radius = 85;
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;
              const isSelected = displayHour === hour;

              return (
                <div
                  key={hour}
                  className={`absolute w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-all ${
                    isSelected ? 'bg-indigo-500 text-white scale-110' : 'text-gray-900 dark:text-gray-100'
                  }`}
                  style={{
                    left: `calc(50% + ${x}px - 16px)`,
                    top: `calc(50% + ${y}px - 16px)`,
                  }}
                >
                  {hour}
                </div>
              );
            })
          : minuteMarks.map((minute) => {
              const angle = ((minute / 60) * 360 - 90) * (Math.PI / 180);
              const radius = 85;
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;
              const isSelected = minutes >= minute && minutes < minute + 5;

              return (
                <div
                  key={minute}
                  className={`absolute w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-all ${
                    isSelected ? 'bg-indigo-500 text-white scale-110' : 'text-gray-900 dark:text-gray-100'
                  }`}
                  style={{
                    left: `calc(50% + ${x}px - 16px)`,
                    top: `calc(50% + ${y}px - 16px)`,
                  }}
                >
                  {minute.toString().padStart(2, '0')}
                </div>
              );
            })}
      </div>

      <p className="text-center text-xs text-gray-400 dark:text-gray-500">
        {mode === 'hour' ? 'Click or drag to set hour' : 'Click or drag to set minutes'}
      </p>
    </div>
  );
}

export default ClockPicker;
