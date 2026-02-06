# Terminal 2: Date Picker & Meeting Improvements

## Your Role
You are handling Features 3 and 4 from the PROJECT_IMPROVEMENTS_GUIDE.md.

## Branch
Work on: `feature/project-improvements`

## Your Tasks

### Feature 3: Date Picker Improvements

**Current issues**:
- Calendar stays open after selecting date
- Has time picker that isn't needed

**Requirements**:
- Find all date inputs in ProjectDetail.jsx
- Remove time selection (date only)
- Add "Confirm" button to date picker
- Close picker automatically after confirm click
- Display format: "Jan 15, 2025" (no time)

**Implementation options**:
- Modify existing date picker behavior
- Create custom DatePicker component wrapper
- Use a library like react-datepicker if not already used

### Feature 4: Meeting Notes & Audio

**Rich Text Editor for Notes**:
- Create `RichTextEditor.jsx` component
- Use a library like:
  - react-quill (recommended - simple)
  - tiptap (modern, extensible)
  - slate (powerful but complex)
- Features needed: bold, italic, underline, bullets, numbered list, headers
- Store HTML content in meeting.notes field
- Display rendered HTML in meeting view

**Inline Audio Player**:
- Create `AudioPlayer.jsx` component
- Custom controls (not browser default)
- Play/pause button
- Progress bar (seekable)
- Current time / total duration display
- Speed control dropdown: 0.5x, 1x, 1.5x, 2x
- Volume control (optional)
- Display on MeetingCard when audio exists

**Audio Recording**:
- Create `AudioRecorder.jsx` component
- Use MediaRecorder API
- Start/stop recording button
- Recording indicator (pulsing dot)
- Preview recorded audio before saving
- Upload recorded blob to server
- Discard option

**Backend changes**:
- Add `notes` field to meetings if not exists
- Ensure audio file serving works

## Files You May Edit
- `frontend/src/pages/ProjectDetail.jsx` (Meetings tab, date inputs)
- `frontend/src/components/MeetingCard.jsx`
- `frontend/src/components/AudioPlayer.jsx` (CREATE)
- `frontend/src/components/AudioRecorder.jsx` (CREATE)
- `frontend/src/components/RichTextEditor.jsx` (CREATE)
- `frontend/src/components/DatePicker.jsx` (CREATE if needed)
- `frontend/src/store/projectStore.js` (meeting notes)
- `backend/src/routes/meetings.js`

## Files You Must NOT Edit
- Files tab in ProjectDetail.jsx (Terminal 1)
- Action items tab in ProjectDetail.jsx (Terminal 3)
- `frontend/src/pages/Projects.jsx` (Terminal 3)
- Any file/upload or category related files

## Dependencies to Install (if needed)
```bash
# Rich text editor (choose one)
npm install react-quill
# or
npm install @tiptap/react @tiptap/starter-kit

# Date picker (if not using native)
npm install react-datepicker
```

## When Done
1. Test date picker with confirm button
2. Test rich text editor saves/loads
3. Test audio player with speed controls
4. Test audio recording and upload
5. Commit with descriptive message
6. Report completion
