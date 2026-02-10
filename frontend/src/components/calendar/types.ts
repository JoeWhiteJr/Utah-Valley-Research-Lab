// Calendar event from the API
export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  start_time: string; // ISO datetime
  end_time: string;
  all_day: boolean;
  scope: CalendarScope;
  created_by: string;
  creator_name?: string;
  category_id: string | null;
  category_name?: string;
  category_color?: string;
  project_id: string | null;
  project_title?: string;
  meeting_id: string | null;
  meeting_title?: string;
  repeat_rule: RepeatRule | null;
  reminders: Reminder[];
  notes: string;
  attendees?: EventAttendee[];
  created_at: string;
  updated_at: string;
}

export interface CalendarCategory {
  id: string;
  name: string;
  color: string;
  scope: CalendarScope;
  created_by: string | null;
}

export interface DeadlineEvent {
  id: string;
  title: string;
  due_date: string;
  project_id: string;
  project_title: string;
  completed: boolean;
}

export interface RepeatRule {
  frequency: RepeatFrequency;
  interval?: number;
  daysOfWeek?: number[];
}

export interface Reminder {
  type: 'minutes' | 'hours' | 'days';
  value: number;
}

export interface EventAttendee {
  id: string;
  user_id: string;
  user_name: string;
  user_email?: string;
  status: RSVPStatus;
  responded_at: string | null;
}

export interface CreateEventData {
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  all_day?: boolean;
  scope: CalendarScope;
  category_id?: string | null;
  project_id?: string | null;
  meeting_id?: string | null;
  repeat_rule?: RepeatRule | null;
  reminders?: Reminder[];
  notes?: string;
  attendee_ids?: string[];
}

export type CalendarScope = 'lab' | 'personal' | 'project' | 'dashboard';
export type CalendarViewType = 'daily' | 'weekly' | 'monthly';
export type RSVPStatus = 'pending' | 'accepted' | 'declined';
export type RepeatFrequency = 'daily' | 'weekly' | 'custom';

// Constants
export const TIME_CONFIG = {
  START_HOUR: 6,
  END_HOUR: 23,
  DEFAULT_HOUR_HEIGHT: 60,
  MIN_HOUR_HEIGHT: 30,
  MAX_HOUR_HEIGHT: 120,
  ZOOM_STEP: 15,
};

export const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const CATEGORY_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#64748b', '#78716c',
];
