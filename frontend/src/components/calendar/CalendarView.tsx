import { useEffect, useMemo, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, ZoomIn, ZoomOut, RotateCcw,
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths } from 'date-fns';
import { useCalendarStore } from '../../store/calendarStore';
import { useAuthStore } from '../../store/authStore';
import { useProjectStore } from '../../store/projectStore';
import { DailyView } from './DailyView';
import { WeeklyView } from './WeeklyView';
import { MonthlyView } from './MonthlyView';
import { EventModal } from './EventModal';
import { DeadlineOverlay } from './DeadlineOverlay';
import type { CalendarScope, CalendarViewType } from './types';

interface CalendarViewProps {
  scope: CalendarScope;
  compact?: boolean;
  projectId?: string;
}

export function CalendarView({ scope, compact = false, projectId }: CalendarViewProps) {
  const { user } = useAuthStore();
  const { projects } = useProjectStore();

  const {
    selectedDate, currentView, hourHeight,
    events, categories, deadlines, filters,
    isCreateModalOpen, editingEvent,
    fetchEvents, fetchCategories, fetchDeadlines,
    setSelectedDate, setCurrentView, setScope,
    openCreateModal, closeCreateModal, setEditingEvent,
    moveEvent, setFilters,
    zoomIn, zoomOut, resetZoom,
  } = useCalendarStore();

  // Set scope and projectId filter when component mounts
  useEffect(() => {
    setScope(scope);
    if (scope === 'project' && projectId) {
      setFilters({ projectId });
    }
    return () => {
      if (scope === 'project') {
        setFilters({ projectId: null });
      }
    };
  }, [scope, projectId, setScope, setFilters]);

  // Calculate date range based on current view
  const dateRange = useMemo(() => {
    switch (currentView) {
      case 'daily':
        return { start: startOfDay(selectedDate), end: endOfDay(selectedDate) };
      case 'weekly':
        return { start: startOfWeek(selectedDate, { weekStartsOn: 0 }), end: endOfWeek(selectedDate, { weekStartsOn: 0 }) };
      case 'monthly':
        return { start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) };
    }
  }, [selectedDate, currentView]);

  // Fetch data on mount and when range changes
  useEffect(() => {
    const start = dateRange.start.toISOString();
    const end = dateRange.end.toISOString();
    fetchEvents(start, end, scope);
    fetchDeadlines(start, end);
  }, [dateRange, scope, fetchEvents, fetchDeadlines]);

  useEffect(() => {
    fetchCategories(scope);
  }, [scope, fetchCategories]);

  // Navigation
  const navigatePrev = () => {
    switch (currentView) {
      case 'daily': setSelectedDate(subDays(selectedDate, 1)); break;
      case 'weekly': setSelectedDate(subWeeks(selectedDate, 1)); break;
      case 'monthly': setSelectedDate(subMonths(selectedDate, 1)); break;
    }
  };
  const navigateNext = () => {
    switch (currentView) {
      case 'daily': setSelectedDate(addDays(selectedDate, 1)); break;
      case 'weekly': setSelectedDate(addWeeks(selectedDate, 1)); break;
      case 'monthly': setSelectedDate(addMonths(selectedDate, 1)); break;
    }
  };
  const goToToday = () => setSelectedDate(new Date());

  // Permission check
  const canCreate = scope === 'personal' || scope === 'project' || scope === 'dashboard' || user?.role === 'admin' || user?.role === 'project_lead';

  // Format header date
  const headerDate = useMemo(() => {
    switch (currentView) {
      case 'daily': return format(selectedDate, 'EEEE, MMMM d, yyyy');
      case 'weekly': {
        const ws = startOfWeek(selectedDate, { weekStartsOn: 0 });
        const we = endOfWeek(selectedDate, { weekStartsOn: 0 });
        return `${format(ws, 'MMM d')} - ${format(we, 'MMM d, yyyy')}`;
      }
      case 'monthly': return format(selectedDate, 'MMMM yyyy');
    }
  }, [selectedDate, currentView]);

  const handleTimeClick = useCallback((time: Date) => {
    if (canCreate) openCreateModal(time);
  }, [canCreate, openCreateModal]);

  const handleEditEvent = useCallback((event: any) => {
    setEditingEvent(event);
  }, [setEditingEvent]);

  const handleMoveEvent = useCallback((id: string, start_time: string, end_time: string) => {
    moveEvent(id, start_time, end_time);
  }, [moveEvent]);

  const handleTimeRangeSelect = useCallback((startTime: Date, endTime: Date) => {
    if (canCreate) openCreateModal(startTime, endTime);
  }, [canCreate, openCreateModal]);

  const handleSwitchToDaily = useCallback((date: Date) => {
    setSelectedDate(date);
    setCurrentView('daily');
  }, [setSelectedDate, setCurrentView]);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button onClick={navigatePrev} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <ChevronLeft size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
            <button onClick={navigateNext} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <ChevronRight size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Today
          </button>

          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{headerDate}</h3>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
            {(['daily', 'weekly', 'monthly'] as CalendarViewType[]).map((view) => (
              <button
                key={view}
                onClick={() => setCurrentView(view)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  currentView === view
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {view === 'daily' ? 'Day' : view === 'weekly' ? 'Week' : 'Month'}
              </button>
            ))}
          </div>

          {/* Zoom (only for day/week) */}
          {currentView !== 'monthly' && (
            <div className="flex items-center gap-0.5 border-l border-gray-200 dark:border-gray-700 pl-2 ml-1">
              <button onClick={zoomOut} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="Zoom out">
                <ZoomOut size={14} className="text-gray-400 dark:text-gray-500" />
              </button>
              <button onClick={resetZoom} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="Reset zoom">
                <RotateCcw size={14} className="text-gray-400 dark:text-gray-500" />
              </button>
              <button onClick={zoomIn} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="Zoom in">
                <ZoomIn size={14} className="text-gray-400 dark:text-gray-500" />
              </button>
            </div>
          )}

          {/* New Event */}
          {canCreate && (
            <button
              onClick={() => openCreateModal(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 text-white text-sm font-medium rounded-lg hover:bg-indigo-600 transition-colors"
            >
              <Plus size={16} />
              New Event
            </button>
          )}
        </div>
      </div>

      {/* Deadline Overlay */}
      {deadlines.length > 0 && (
        <div className="px-4 pt-3">
          <DeadlineOverlay deadlines={deadlines} />
        </div>
      )}

      {/* Calendar Body */}
      <div className="overflow-auto" style={{ maxHeight: compact ? (currentView === 'monthly' ? '350px' : '400px') : (currentView === 'monthly' ? '600px' : '700px') }}>
        {currentView === 'daily' && (
          <DailyView
            selectedDate={selectedDate}
            events={events}
            deadlines={deadlines}
            hourHeight={hourHeight}
            onTimeClick={handleTimeClick}
            onEditEvent={handleEditEvent}
            onMoveEvent={handleMoveEvent}
            onTimeRangeSelect={handleTimeRangeSelect}
            scope={scope}
          />
        )}
        {currentView === 'weekly' && (
          <WeeklyView
            selectedDate={selectedDate}
            events={events}
            deadlines={deadlines}
            hourHeight={hourHeight}
            onTimeClick={handleTimeClick}
            onEditEvent={handleEditEvent}
            onMoveEvent={handleMoveEvent}
            onTimeRangeSelect={handleTimeRangeSelect}
            onSelectDate={setSelectedDate}
            scope={scope}
          />
        )}
        {currentView === 'monthly' && (
          <MonthlyView
            selectedDate={selectedDate}
            events={events}
            deadlines={deadlines}
            onSelectDate={setSelectedDate}
            onSwitchToDaily={handleSwitchToDaily}
            onEditEvent={handleEditEvent}
            onTimeClick={handleTimeClick}
            scope={scope}
          />
        )}
      </div>

      {/* Event Modal */}
      {isCreateModalOpen && (
        <EventModal
          scope={scope}
          onClose={closeCreateModal}
        />
      )}
    </div>
  );
}

export default CalendarView;
