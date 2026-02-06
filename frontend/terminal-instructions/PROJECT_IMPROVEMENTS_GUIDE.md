# Project Improvements - Feature Development Guide

## Branch
All work happens on: `feature/project-improvements`

## Overview
This guide covers 6 major improvements to the member dashboard project management system.

---

## Feature 1: Fix Image Header Uploads

**Problem**: Cover image upload not working - shows broken placeholder after selecting file.

**Files to modify**:
- `frontend/src/pages/ProjectDetail.jsx` - Cover upload UI
- `frontend/src/store/projectStore.js` - uploadCover action
- `frontend/src/services/api.js` - API call
- `backend/src/routes/projects.js` - Cover upload endpoint

**Requirements**:
- Debug why uploads fail (check API response, file paths, static serving)
- Ensure uploaded images display correctly
- Handle error states with user feedback
- Verify static file serving works on AWS deployment

---

## Feature 2: File Upload & Preview System

**Problem**: Upload button not functional, no drag-and-drop, no file previews.

**Files to modify**:
- `frontend/src/pages/ProjectDetail.jsx` - Files tab
- `frontend/src/components/FileCard.jsx` - File display
- `frontend/src/components/FilePreviewModal.jsx` (NEW)
- `frontend/src/store/projectStore.js` - Upload with progress
- `backend/src/routes/files.js` - Ensure all file types supported

**Requirements**:
- Fix upload button click handler
- Add drag-and-drop zone with visual feedback
- Upload progress bar (real-time percentage)
- Preview modal for:
  - Images (jpg, png, gif, webp)
  - PDFs (embedded viewer)
  - Audio (mp3 - audio player)
  - Video (mp4 - video player)
  - Office files (docx, xlsx, pptx) - download prompt or iframe viewer
  - Google Suite - link handling
- Download button on all file types
- Delete functionality

---

## Feature 3: Date Picker Improvements

**Problem**: Calendar stays open after date selection, has unnecessary time picker.

**Files to modify**:
- `frontend/src/pages/ProjectDetail.jsx` - All date inputs
- `frontend/src/components/DatePicker.jsx` (NEW or modify existing)

**Requirements**:
- Remove time selection from all date pickers
- Add "Confirm" button that closes picker on click
- Auto-close after confirm
- Date-only format (no time display)

---

## Feature 4: Meeting Notes & Audio Player

**Problem**: No typed notes, no audio playback, no recording.

**Files to modify**:
- `frontend/src/pages/ProjectDetail.jsx` - Meetings tab
- `frontend/src/components/MeetingCard.jsx` - Display
- `frontend/src/components/MeetingDetailModal.jsx` (NEW)
- `frontend/src/components/AudioPlayer.jsx` (NEW)
- `frontend/src/components/AudioRecorder.jsx` (NEW)
- `frontend/src/components/RichTextEditor.jsx` (NEW)
- `backend/src/routes/meetings.js` - Notes storage

**Requirements**:
- Rich text editor for meeting notes (bold, italic, bullets, headers)
- Inline audio player on meeting cards
- Playback speed controls: 0.5x, 1x, 1.5x, 2x
- In-browser audio recording (MediaRecorder API)
- Upload recorded audio to server
- Download button for audio files

---

## Feature 5: Action Item Categories & Progress

**Problem**: No categories, progress bar doesn't update.

**Files to modify**:
- `frontend/src/pages/ProjectDetail.jsx` - Action items tab
- `frontend/src/components/ActionItem.jsx` - Category display
- `frontend/src/components/CategoryManager.jsx` (NEW)
- `frontend/src/store/projectStore.js` - Category actions, progress calc
- `backend/src/routes/actions.js` - Category field
- `backend/src/routes/categories.js` (NEW)
- `database/migrations/` - Add categories table

**Requirements**:
- Categories are project-specific
- CRUD for categories (add, edit, delete)
- One category per action item (optional)
- Category displayed as colored badge on action item
- Progress bar = (completed items / total items) * 100
- Progress updates on:
  - Action item marked complete/incomplete
  - Action item created
  - Action item deleted

**Database changes**:
```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  color VARCHAR(7) DEFAULT '#6366f1',
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE action_items ADD COLUMN category_id UUID REFERENCES categories(id) ON DELETE SET NULL;
```

---

## Feature 6: Inactive Projects

**Problem**: No way to archive/deactivate projects without deleting.

**Files to modify**:
- `frontend/src/pages/Projects.jsx` - Project list with inactive filter
- `frontend/src/pages/ProjectDetail.jsx` - Settings menu
- `frontend/src/components/ProjectCard.jsx` - Inactive styling
- `frontend/src/store/projectStore.js` - Status updates
- `backend/src/routes/projects.js` - Status change (admin only)

**Requirements**:
- New status: "inactive" (in addition to active, completed, archived)
- Settings dropdown in project header (top right) with options:
  - "Mark as Inactive"
  - "Mark as Active"
  - "Mark as Completed"
  - (Admin only for status changes)
- Inactive projects shown in separate section below active projects
- Filter to show/hide inactive projects
- Only admins can change project status
- Inactive projects are viewable by all members

---

## Parallel Execution Strategy

```
Terminal 1: Features 1 & 2 (Image Headers + File Upload)
Terminal 2: Features 3 & 4 (Date Picker + Meetings)
Terminal 3: Features 5 & 6 (Categories + Inactive Projects)
```

Each terminal works on different files to avoid conflicts.

---

## Testing Checklist

After all features complete:
- [ ] Cover image upload works
- [ ] File upload with progress works
- [ ] All file types preview correctly
- [ ] Date picker closes on confirm, no time
- [ ] Meeting notes save with rich text
- [ ] Audio player plays with speed controls
- [ ] Audio recording works
- [ ] Categories can be CRUD'd
- [ ] Action item progress updates correctly
- [ ] Inactive status works (admin only)
- [ ] All existing tests pass
- [ ] New tests added for new features

---

## Reference Files

**Frontend Pages**:
- `/frontend/src/pages/Projects.jsx`
- `/frontend/src/pages/ProjectDetail.jsx`

**Frontend Components**:
- `/frontend/src/components/ProjectCard.jsx`
- `/frontend/src/components/ActionItem.jsx`
- `/frontend/src/components/FileCard.jsx`
- `/frontend/src/components/MeetingCard.jsx`
- `/frontend/src/components/NoteCard.jsx`

**Backend Routes**:
- `/backend/src/routes/projects.js`
- `/backend/src/routes/files.js`
- `/backend/src/routes/actions.js`
- `/backend/src/routes/meetings.js`

**Store**:
- `/frontend/src/store/projectStore.js`

**API Service**:
- `/frontend/src/services/api.js`
