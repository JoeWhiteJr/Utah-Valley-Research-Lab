# Terminal 3: Action Item Categories & Inactive Projects

## Your Role
You are handling Features 5 and 6 from the PROJECT_IMPROVEMENTS_GUIDE.md.

## Branch
Work on: `feature/project-improvements`

## Your Tasks

### Feature 5: Action Item Categories

**Database migration**:
Create new migration file for categories:
```sql
-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  color VARCHAR(7) DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, name)
);

-- Add category_id to action_items
ALTER TABLE action_items
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_categories_project ON categories(project_id);
CREATE INDEX IF NOT EXISTS idx_actions_category ON action_items(category_id);
```

**Backend routes** (create `backend/src/routes/categories.js`):
- GET /categories/project/:projectId - List categories for project
- POST /categories/project/:projectId - Create category
- PUT /categories/:id - Update category (name, color)
- DELETE /categories/:id - Delete category

**Frontend CategoryManager component**:
- List existing categories with color badges
- Add new category (name + color picker)
- Edit category name/color
- Delete category (with confirmation)
- Show in ProjectDetail action items tab

**Update ActionItem component**:
- Show category badge (colored pill with name)
- Category selector in action item creation/edit
- Filter actions by category (optional)

**Progress bar calculation**:
- Calculate: (completed_count / total_count) * 100
- Update on action complete/incomplete toggle
- Update on action create/delete
- Store in projectStore and sync to backend

### Feature 6: Inactive Projects

**Add "inactive" status**:
- Projects can be: active, completed, inactive
- Update backend enum/validation

**Settings dropdown in ProjectDetail**:
- Top-right corner settings icon (gear or three dots)
- Dropdown menu:
  - "Mark as Active" (if not active)
  - "Mark as Completed" (if not completed)
  - "Mark as Inactive" (if not inactive)
- Only show to admins
- Call updateProject with new status

**Update Projects list page**:
- Show inactive projects in separate section below active
- Visual distinction (muted colors, "Inactive" badge)
- Filter options: All, Active, Completed, Inactive
- Inactive section collapsible

**Permissions**:
- Only admins can change project status
- All members can view inactive projects
- Check user.role === 'admin' before showing status options

## Files You May Edit
- `frontend/src/pages/Projects.jsx`
- `frontend/src/pages/ProjectDetail.jsx` (Action items tab, settings menu)
- `frontend/src/components/ActionItem.jsx`
- `frontend/src/components/ProjectCard.jsx`
- `frontend/src/components/CategoryManager.jsx` (CREATE)
- `frontend/src/components/CategoryBadge.jsx` (CREATE)
- `frontend/src/store/projectStore.js`
- `frontend/src/services/api.js`
- `backend/src/routes/actions.js`
- `backend/src/routes/categories.js` (CREATE)
- `backend/src/routes/projects.js` (status update)
- `backend/src/routes/index.js` (add categories route)
- `database/migrations/` (new migration)

## Files You Must NOT Edit
- Files tab in ProjectDetail.jsx (Terminal 1)
- Meetings tab in ProjectDetail.jsx (Terminal 2)
- Any file/upload or meeting related files

## When Done
1. Run database migration
2. Test category CRUD
3. Test action item category assignment
4. Test progress bar updates
5. Test inactive project status flow
6. Test admin-only restrictions
7. Commit with descriptive message
8. Report completion
