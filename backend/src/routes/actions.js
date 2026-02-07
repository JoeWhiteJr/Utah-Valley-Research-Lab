const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate, requireProjectAccess } = require('../middleware/auth');

const router = express.Router();

// Helper: fetch assignees for a list of action items
async function fetchAssigneesForActions(actionIds) {
  if (actionIds.length === 0) return {};
  const result = await db.query(`
    SELECT aia.action_item_id, aia.user_id, u.name as user_name
    FROM action_item_assignees aia
    JOIN users u ON aia.user_id = u.id
    WHERE aia.action_item_id = ANY($1)
    ORDER BY aia.assigned_at ASC
  `, [actionIds]);

  const map = {};
  for (const row of result.rows) {
    if (!map[row.action_item_id]) map[row.action_item_id] = [];
    map[row.action_item_id].push({ user_id: row.user_id, user_name: row.user_name });
  }
  return map;
}

// Helper: set assignees for an action item (replaces all)
async function setAssignees(actionItemId, userIds, client) {
  const queryFn = client || db;
  // Remove existing
  await queryFn.query('DELETE FROM action_item_assignees WHERE action_item_id = $1', [actionItemId]);
  // Insert new
  if (userIds && userIds.length > 0) {
    const values = userIds.map((uid, i) => `($1, $${i + 2})`).join(', ');
    const params = [actionItemId, ...userIds];
    await queryFn.query(
      `INSERT INTO action_item_assignees (action_item_id, user_id) VALUES ${values} ON CONFLICT DO NOTHING`,
      params
    );
  }
}

// Helper: attach assignees to action objects
function attachAssignees(actions, assigneesMap) {
  return actions.map(a => ({
    ...a,
    assignees: assigneesMap[a.id] || [],
    // Keep backward compatibility: set assigned_name from first assignee
    assigned_name: (assigneesMap[a.id] && assigneesMap[a.id][0])
      ? assigneesMap[a.id][0].user_name
      : a.assigned_name || null
  }));
}

// Get all action items assigned to current user
router.get('/my', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT DISTINCT a.*, u.name as assigned_name, p.title as project_title,
        c.name as category_name, c.color as category_color
      FROM action_items a
      LEFT JOIN users u ON a.assigned_to = u.id
      LEFT JOIN projects p ON a.project_id = p.id
      LEFT JOIN categories c ON a.category_id = c.id
      LEFT JOIN action_item_assignees aia ON a.id = aia.action_item_id
      WHERE a.assigned_to = $1 OR aia.user_id = $1
      ORDER BY a.completed ASC, a.due_date ASC NULLS LAST, a.created_at DESC
    `, [req.user.id]);

    const actionIds = result.rows.map(a => a.id);
    const assigneesMap = await fetchAssigneesForActions(actionIds);
    const actions = attachAssignees(result.rows, assigneesMap);

    res.json({ actions });
  } catch (error) {
    next(error);
  }
});

// Get action items for a project
router.get('/project/:projectId', authenticate, requireProjectAccess(), async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT a.*, u.name as assigned_name,
        c.name as category_name, c.color as category_color
      FROM action_items a
      LEFT JOIN users u ON a.assigned_to = u.id
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.project_id = $1
      ORDER BY a.sort_order ASC, a.created_at ASC
    `, [req.params.projectId]);

    const actionIds = result.rows.map(a => a.id);
    const assigneesMap = await fetchAssigneesForActions(actionIds);
    const actions = attachAssignees(result.rows, assigneesMap);

    res.json({ actions });
  } catch (error) {
    next(error);
  }
});

// Get progress for a project (auto-calculated from tasks)
router.get('/project/:projectId/progress', authenticate, requireProjectAccess(), async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT
        COUNT(*) as total_tasks,
        COUNT(*) FILTER (WHERE completed = true) as completed_tasks
      FROM action_items
      WHERE project_id = $1
    `, [req.params.projectId]);

    const { total_tasks, completed_tasks } = result.rows[0];
    const total = parseInt(total_tasks);
    const completed = parseInt(completed_tasks);
    const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

    res.json({ progress, total_tasks: total, completed_tasks: completed });
  } catch (error) {
    next(error);
  }
});

// Create action item
router.post('/project/:projectId', authenticate, requireProjectAccess(), [
  body('title').trim().notEmpty(),
  body('due_date').optional().isISO8601(),
  body('assigned_to').optional().isUUID(),
  body('assignee_ids').optional().isArray(),
  body('assignee_ids.*').optional().isUUID(),
  body('category_id').optional({ nullable: true }).isUUID(),
  body('parent_task_id').optional({ nullable: true }).isUUID()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { title, due_date, assigned_to, assignee_ids, category_id, parent_task_id } = req.body;
    const projectId = req.params.projectId;

    // If parent_task_id is set, validate it belongs to the same project
    if (parent_task_id) {
      const parentCheck = await db.query(
        'SELECT id FROM action_items WHERE id = $1 AND project_id = $2',
        [parent_task_id, projectId]
      );
      if (parentCheck.rows.length === 0) {
        return res.status(400).json({ error: { message: 'Parent task not found in this project' } });
      }
    }

    // Get max sort order
    const orderResult = await db.query(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM action_items WHERE project_id = $1',
      [projectId]
    );

    const result = await db.query(
      'INSERT INTO action_items (project_id, title, due_date, assigned_to, category_id, sort_order, parent_task_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [projectId, title, due_date || null, assigned_to || null, category_id || null, orderResult.rows[0].next_order, parent_task_id || null]
    );

    const actionItem = result.rows[0];

    // Handle multiple assignees
    const effectiveAssignees = assignee_ids || (assigned_to ? [assigned_to] : []);
    if (effectiveAssignees.length > 0) {
      await setAssignees(actionItem.id, effectiveAssignees);
    }

    // Fetch with category info and assignees
    const actionWithCategory = await db.query(`
      SELECT a.*, c.name as category_name, c.color as category_color
      FROM action_items a
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.id = $1
    `, [actionItem.id]);

    const assigneesMap = await fetchAssigneesForActions([actionItem.id]);
    const actions = attachAssignees(actionWithCategory.rows, assigneesMap);

    res.status(201).json({ action: actions[0] });
  } catch (error) {
    next(error);
  }
});

// Reorder action items (must be before /:id route)
router.put('/reorder', authenticate, [
  body('items').isArray(),
  body('items.*.id').isUUID(),
  body('items.*.sort_order').isInt({ min: 0 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { items } = req.body;
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      for (const item of items) {
        await client.query(
          'UPDATE action_items SET sort_order = $1 WHERE id = $2',
          [item.sort_order, item.id]
        );
      }

      await client.query('COMMIT');
      res.json({ message: 'Reorder successful' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Set parent task (make subtask) - used by drag-and-drop
router.put('/:id/parent', authenticate, [
  body('parent_task_id').optional({ nullable: true })
], async (req, res, next) => {
  try {
    const { parent_task_id } = req.body;
    const actionId = req.params.id;

    const existing = await db.query('SELECT id, project_id FROM action_items WHERE id = $1', [actionId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Action item not found' } });
    }

    // Prevent circular reference
    if (parent_task_id === actionId) {
      return res.status(400).json({ error: { message: 'A task cannot be its own parent' } });
    }

    // Validate parent belongs to same project
    if (parent_task_id) {
      const parentCheck = await db.query(
        'SELECT id, parent_task_id FROM action_items WHERE id = $1 AND project_id = $2',
        [parent_task_id, existing.rows[0].project_id]
      );
      if (parentCheck.rows.length === 0) {
        return res.status(400).json({ error: { message: 'Parent task not found in this project' } });
      }
      // Prevent nested subtasks (only one level deep)
      if (parentCheck.rows[0].parent_task_id) {
        return res.status(400).json({ error: { message: 'Cannot nest subtasks more than one level deep' } });
      }
    }

    // Check if this task already has subtasks - if so, it cannot become a subtask itself
    const childCheck = await db.query(
      'SELECT id FROM action_items WHERE parent_task_id = $1 LIMIT 1',
      [actionId]
    );
    if (childCheck.rows.length > 0 && parent_task_id) {
      return res.status(400).json({ error: { message: 'A task with subtasks cannot become a subtask itself' } });
    }

    await db.query(
      'UPDATE action_items SET parent_task_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [parent_task_id || null, actionId]
    );

    const result = await db.query(`
      SELECT a.*, u.name as assigned_name, c.name as category_name, c.color as category_color
      FROM action_items a
      LEFT JOIN users u ON a.assigned_to = u.id
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.id = $1
    `, [actionId]);

    const assigneesMap = await fetchAssigneesForActions([actionId]);
    const actions = attachAssignees(result.rows, assigneesMap);

    res.json({ action: actions[0] });
  } catch (error) {
    next(error);
  }
});

// Update action item
router.put('/:id', authenticate, [
  body('title').optional().trim().notEmpty(),
  body('completed').optional().isBoolean(),
  body('due_date').optional({ nullable: true }).isISO8601(),
  body('assigned_to').optional({ nullable: true }).isUUID(),
  body('assignee_ids').optional().isArray(),
  body('assignee_ids.*').optional().isUUID(),
  body('category_id').optional({ nullable: true }).isUUID(),
  body('parent_task_id').optional({ nullable: true })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { title, completed, due_date, assigned_to, assignee_ids, category_id, parent_task_id } = req.body;

    const existing = await db.query('SELECT id, project_id FROM action_items WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Action item not found' } });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    updates.push('updated_at = CURRENT_TIMESTAMP');

    if (title !== undefined) { updates.push(`title = $${paramCount++}`); values.push(title); }
    if (completed !== undefined) { updates.push(`completed = $${paramCount++}`); values.push(completed); }
    if (due_date !== undefined) { updates.push(`due_date = $${paramCount++}`); values.push(due_date); }
    if (assigned_to !== undefined) { updates.push(`assigned_to = $${paramCount++}`); values.push(assigned_to); }
    if (category_id !== undefined) { updates.push(`category_id = $${paramCount++}`); values.push(category_id); }
    if (parent_task_id !== undefined) { updates.push(`parent_task_id = $${paramCount++}`); values.push(parent_task_id); }

    // Handle assignee_ids update separately
    if (assignee_ids !== undefined) {
      await setAssignees(req.params.id, assignee_ids);
      // Also update the legacy assigned_to to first assignee for backward compat
      if (assigned_to === undefined) {
        updates.push(`assigned_to = $${paramCount++}`);
        values.push(assignee_ids.length > 0 ? assignee_ids[0] : null);
      }
    }

    if (values.length === 0 && assignee_ids === undefined) {
      return res.status(400).json({ error: { message: 'No fields to update' } });
    }

    if (values.length > 0) {
      values.push(req.params.id);
      await db.query(
        `UPDATE action_items SET ${updates.join(', ')} WHERE id = $${paramCount}`,
        values
      );
    }

    // Fetch with category info
    const result = await db.query(`
      SELECT a.*, u.name as assigned_name, c.name as category_name, c.color as category_color
      FROM action_items a
      LEFT JOIN users u ON a.assigned_to = u.id
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.id = $1
    `, [req.params.id]);

    const assigneesMap = await fetchAssigneesForActions([req.params.id]);
    const actions = attachAssignees(result.rows, assigneesMap);

    res.json({ action: actions[0] });
  } catch (error) {
    next(error);
  }
});

// Delete action item
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM action_items WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Action item not found' } });
    }

    res.json({ message: 'Action item deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
