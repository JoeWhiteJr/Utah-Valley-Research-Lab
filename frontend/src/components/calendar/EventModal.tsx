import { useState, useEffect } from 'react';
import { X, Trash2, Calendar, Users, Link } from 'lucide-react';
import { format } from 'date-fns';
import { useCalendarStore } from '../../store/calendarStore';
import { useAuthStore } from '../../store/authStore';
import { useProjectStore } from '../../store/projectStore';
import { usersApi } from '../../services/api';
import { ClockPicker } from './ClockPicker';
import { RepeatPicker } from './RepeatPicker';
import type { CalendarScope, CalendarCategory, RepeatRule, CreateEventData } from './types';
import { CATEGORY_COLORS } from './types';

interface EventModalProps {
  scope: CalendarScope;
  onClose: () => void;
}

export function EventModal({ scope, onClose }: EventModalProps) {
  const { user } = useAuthStore();
  const {
    editingEvent, createModalTime, createModalEndTime,
    categories, createEvent, updateEvent, deleteEvent, createCategory,
  } = useCalendarStore();

  // Prefetch projects from store
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string; email: string }[]>([]);

  // Form state
  const isEditing = !!editingEvent;
  const defaultStart = createModalTime || new Date();
  const defaultEnd = createModalEndTime || new Date(defaultStart.getTime() + 60 * 60 * 1000); // +1 hour

  const [title, setTitle] = useState(editingEvent?.title || '');
  const [description, setDescription] = useState(editingEvent?.description || '');
  const [startTime, setStartTime] = useState<Date>(
    editingEvent ? new Date(editingEvent.start_time) : defaultStart
  );
  const [endTime, setEndTime] = useState<Date>(
    editingEvent ? new Date(editingEvent.end_time) : defaultEnd
  );
  const [allDay, setAllDay] = useState(editingEvent?.all_day || false);
  const [categoryId, setCategoryId] = useState<string | null>(editingEvent?.category_id || null);
  const [projectId, setProjectId] = useState<string | null>(editingEvent?.project_id || null);
  const [repeatRule, setRepeatRule] = useState<RepeatRule | null>(editingEvent?.repeat_rule || null);
  const [notes, setNotes] = useState(editingEvent?.notes || '');
  const [attendeeIds, setAttendeeIds] = useState<string[]>(
    editingEvent?.attendees?.map((a) => a.user_id) || []
  );
  const [isSaving, setIsSaving] = useState(false);

  // New category form
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_COLORS[0]);

  // Load projects and team members
  useEffect(() => {
    const projectStore = useProjectStore.getState();
    if (projectStore.projects.length === 0) {
      projectStore.fetchProjects().then(() => {
        setProjects(useProjectStore.getState().projects.map((p: any) => ({ id: p.id, title: p.title })));
      });
    } else {
      setProjects(projectStore.projects.map((p: any) => ({ id: p.id, title: p.title })));
    }

    if (scope === 'lab') {
      usersApi.team().then(({ data }) => {
        setTeamMembers(data.users || []);
      }).catch(() => {});
    }
  }, [scope]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSaving(true);
    const eventData: CreateEventData = {
      title: title.trim(),
      description,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      all_day: allDay,
      scope,
      category_id: categoryId,
      project_id: projectId,
      repeat_rule: repeatRule,
      notes,
      attendee_ids: scope === 'lab' ? attendeeIds : undefined,
    };

    if (isEditing && editingEvent) {
      await updateEvent(editingEvent.id, eventData);
    } else {
      await createEvent(eventData);
    }
    setIsSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    if (editingEvent && window.confirm('Are you sure you want to delete this event?')) {
      await deleteEvent(editingEvent.id);
      onClose();
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    await createCategory({
      name: newCategoryName.trim(),
      color: newCategoryColor,
      scope,
    });
    setNewCategoryName('');
    setShowNewCategory(false);
  };

  const toggleAttendee = (userId: string) => {
    setAttendeeIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
            {isEditing ? 'Edit Event' : 'New Event'}
          </h2>
          <div className="flex items-center gap-2">
            {isEditing && (
              <button onClick={handleDelete} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                <Trash2 size={18} />
              </button>
            )}
            <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500 focus:border-indigo-400"
              required
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Event description..."
              rows={2}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500 focus:border-indigo-400 resize-none"
            />
          </div>

          {/* All Day Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">All day event</span>
          </label>

          {/* Date/Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
              <input
                type="date"
                value={format(startTime, 'yyyy-MM-dd')}
                onChange={(e) => {
                  const d = new Date(e.target.value + 'T' + format(startTime, 'HH:mm'));
                  setStartTime(d);
                }}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
              <input
                type="date"
                value={format(endTime, 'yyyy-MM-dd')}
                onChange={(e) => {
                  const d = new Date(e.target.value + 'T' + format(endTime, 'HH:mm'));
                  setEndTime(d);
                }}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Time Pickers (hidden if all day) */}
          {!allDay && (
            <div className="grid grid-cols-2 gap-4">
              <ClockPicker value={startTime} onChange={setStartTime} label="Start Time" />
              <ClockPicker value={endTime} onChange={setEndTime} label="End Time" />
            </div>
          )}

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCategoryId(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  !categoryId ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                None
              </button>
              {categories.map((cat: CalendarCategory) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryId(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    categoryId === cat.id ? 'ring-2 ring-offset-1' : 'hover:opacity-80'
                  }`}
                  style={{ backgroundColor: `${cat.color}20`, color: cat.color, ringColor: cat.color }}
                >
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                  {cat.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowNewCategory(!showNewCategory)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                + New
              </button>
            </div>

            {showNewCategory && (
              <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Category name"
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500"
                />
                <div className="flex flex-wrap gap-1">
                  {CATEGORY_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewCategoryColor(color)}
                      className={`w-6 h-6 rounded-full transition-transform ${
                        newCategoryColor === color ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleCreateCategory}
                  className="px-3 py-1 bg-indigo-500 text-white text-xs font-medium rounded-lg hover:bg-indigo-600"
                >
                  Create Category
                </button>
              </div>
            )}
          </div>

          {/* Project Link */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <Link size={14} className="inline mr-1" />
              Link to Project
            </label>
            <select
              value={projectId || ''}
              onChange={(e) => setProjectId(e.target.value || null)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500"
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>

          {/* Repeat */}
          <RepeatPicker value={repeatRule} onChange={setRepeatRule} />

          {/* Attendees (lab only) */}
          {scope === 'lab' && teamMembers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Users size={14} className="inline mr-1" />
                Invite Team Members
              </label>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {teamMembers.filter((m) => m.id !== user?.id).map((member) => (
                  <label key={member.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={attendeeIds.includes(member.id)}
                      onChange={() => toggleAttendee(member.id)}
                      className="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{member.name}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{member.email}</span>
                  </label>
                ))}
              </div>

              {/* Show current RSVP status for editing */}
              {isEditing && editingEvent?.attendees && editingEvent.attendees.length > 0 && (
                <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">RSVP Status:</p>
                  {editingEvent.attendees.map((att) => (
                    <div key={att.id} className="flex items-center gap-2 text-xs">
                      <span className="text-gray-700 dark:text-gray-300">{att.user_name}</span>
                      <span className={`px-1.5 py-0.5 rounded-full ${
                        att.status === 'accepted' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                        att.status === 'declined' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                        'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                      }`}>
                        {att.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={3}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500 focus:border-indigo-400 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !title.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : isEditing ? 'Update Event' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EventModal;
