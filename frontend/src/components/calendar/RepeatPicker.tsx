import { useState } from 'react';
import type { RepeatRule, RepeatFrequency } from './types';

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface RepeatPickerProps {
  value: RepeatRule | null;
  onChange: (rule: RepeatRule | null) => void;
}

export function RepeatPicker({ value, onChange }: RepeatPickerProps) {
  const [showCustom, setShowCustom] = useState(value?.frequency === 'custom');

  const frequency = value?.frequency || 'none';
  const interval = value?.interval || 1;
  const daysOfWeek = value?.daysOfWeek || [];

  const handleFrequencyChange = (newFrequency: RepeatFrequency | 'none') => {
    if (newFrequency === 'none') {
      onChange(null);
      setShowCustom(false);
    } else if (newFrequency === 'custom') {
      setShowCustom(true);
      onChange({
        frequency: 'custom',
        interval: 1,
        daysOfWeek: [new Date().getDay()],
      });
    } else {
      setShowCustom(false);
      onChange({ frequency: newFrequency });
    }
  };

  const handleIntervalChange = (newInterval: number) => {
    if (value) {
      onChange({ ...value, interval: Math.max(1, newInterval) });
    }
  };

  const handleDayToggle = (day: number) => {
    if (value && value.frequency === 'custom') {
      const newDays = daysOfWeek.includes(day)
        ? daysOfWeek.filter((d) => d !== day)
        : [...daysOfWeek, day].sort();
      if (newDays.length > 0) {
        onChange({ ...value, daysOfWeek: newDays });
      }
    }
  };

  const getRepeatSummary = (): string => {
    if (!value) return 'Does not repeat';
    switch (value.frequency) {
      case 'daily': return 'Repeats daily';
      case 'weekly': return 'Repeats weekly';
      case 'custom': {
        const dayNames = (value.daysOfWeek || []).map((d) => DAYS_SHORT[d]).join(', ');
        if (value.interval === 1) return `Every week on ${dayNames}`;
        return `Every ${value.interval} weeks on ${dayNames}`;
      }
      default: return 'Does not repeat';
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Repeat</label>

      <div className="flex flex-wrap gap-2">
        {(['none', 'daily', 'weekly', 'custom'] as const).map((option) => {
          const isSelected = frequency === option || (option === 'none' && !value);
          const labels: Record<string, string> = {
            none: 'None', daily: 'Daily', weekly: 'Weekly', custom: 'Custom',
          };
          return (
            <button
              key={option}
              type="button"
              onClick={() => handleFrequencyChange(option)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isSelected
                  ? 'bg-indigo-500 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {labels[option]}
            </button>
          );
        })}
      </div>

      {showCustom && value?.frequency === 'custom' && (
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">Every</span>
            <input
              type="number"
              min="1"
              max="52"
              value={interval}
              onChange={(e) => handleIntervalChange(parseInt(e.target.value) || 1)}
              className="w-16 text-center py-1 px-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">week{interval !== 1 ? 's' : ''}</span>
          </div>

          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">On these days:</p>
            <div className="flex gap-1">
              {DAYS_SHORT.map((dayName, index) => {
                const isSelected = daysOfWeek.includes(index);
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleDayToggle(index)}
                    className={`w-9 h-9 rounded-full text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-indigo-500 text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    {dayName.charAt(0)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <p className="text-sm text-gray-400 dark:text-gray-500">{getRepeatSummary()}</p>
    </div>
  );
}

export default RepeatPicker;
