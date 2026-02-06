# Terminal 1: Image Headers & File Upload System

## Your Role
You are handling Features 1 and 2 from the PROJECT_IMPROVEMENTS_GUIDE.md.

## Branch
Work on: `feature/project-improvements`

## Your Tasks

### Feature 1: Fix Image Header Uploads

**Debug the current issue**:
1. Check `ProjectDetail.jsx` cover upload handler
2. Check `projectStore.js` `uploadCover` action
3. Check `api.js` for correct FormData handling
4. Check `backend/src/routes/projects.js` POST /:id/cover endpoint
5. Verify static file serving configuration in Express
6. Check if uploads directory exists and has correct permissions

**Fix**:
- Ensure API returns correct URL path
- Ensure frontend displays image from correct URL
- Add error handling and user feedback
- Test locally before marking complete

### Feature 2: File Upload & Preview System

**Fix upload button**:
- Wire up the file input click handler
- Add drag-and-drop zone (use onDragOver, onDrop events)
- Visual feedback when dragging over zone

**Add upload progress**:
- Use axios onUploadProgress callback
- Show progress bar during upload
- Update `projectStore.js` to track upload progress

**Create FilePreviewModal component**:
- Modal overlay with backdrop
- Close button and click-outside-to-close
- Content based on file type:
  - Images: `<img>` tag
  - PDF: `<iframe>` or PDF.js viewer
  - Audio: `<audio>` with controls
  - Video: `<video>` with controls
  - Office/other: Show file info + download button
- Download button for all types
- Delete button (if user has permission)

**Update FileCard component**:
- Click to open preview modal
- Show file type icon
- Show file size
- Show upload date

## Files You May Edit
- `frontend/src/pages/ProjectDetail.jsx` (Files tab section only)
- `frontend/src/components/FileCard.jsx`
- `frontend/src/components/FilePreviewModal.jsx` (CREATE)
- `frontend/src/store/projectStore.js` (upload progress state)
- `frontend/src/services/api.js` (progress callback)
- `backend/src/routes/projects.js` (cover upload fixes)
- `backend/src/routes/files.js` (if needed)
- `backend/server.js` or `app.js` (static file serving)

## Files You Must NOT Edit
- Meetings tab in ProjectDetail.jsx (Terminal 2)
- Action items tab in ProjectDetail.jsx (Terminal 3)
- `frontend/src/pages/Projects.jsx` (Terminal 3)
- Any meeting or category related files

## When Done
1. Test cover image upload
2. Test file upload with progress
3. Test all preview types work
4. Commit with descriptive message
5. Report completion
