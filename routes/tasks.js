const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();
router.use(authenticate);

const PRIORITIES = ['low', 'medium', 'high'];
const STATUSES = ['pending', 'in-progress', 'completed'];

function validateTask(body, { partial = false } = {}) {
  const errors = [];
  const { title, priority, status, due_date: dueDate } = body;

  if (!partial || title !== undefined) {
    if (!title || !String(title).trim()) errors.push('Title is required.');
  }
  if (priority !== undefined && !PRIORITIES.includes(priority)) {
    errors.push('Priority must be low, medium or high.');
  }
  if (status !== undefined && !STATUSES.includes(status)) {
    errors.push('Status must be pending, in-progress or completed.');
  }
  if (dueDate !== undefined && dueDate !== null && dueDate !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    errors.push('Due date must be in YYYY-MM-DD format.');
  }
  return errors;
}

function attachTags(tasks) {
  if (tasks.length === 0) return tasks;
  const ids = tasks.map((t) => t.id);
  const placeholders = ids.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT tt.task_id, tag.id, tag.name, tag.color
       FROM task_tags tt
       JOIN tags tag ON tag.id = tt.tag_id
       WHERE tt.task_id IN (${placeholders})`
    )
    .all(...ids);

  const byTask = new Map();
  for (const row of rows) {
    if (!byTask.has(row.task_id)) byTask.set(row.task_id, []);
    byTask.get(row.task_id).push({ id: row.id, name: row.name, color: row.color });
  }
  for (const task of tasks) {
    task.tags = byTask.get(task.id) || [];
  }
  return tasks;
}

function setTaskTags(taskId, tagIds) {
  db.prepare('DELETE FROM task_tags WHERE task_id = ?').run(taskId);
  if (!Array.isArray(tagIds)) return;
  const insert = db.prepare('INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)');
  for (const tagId of tagIds) {
    insert.run(taskId, tagId);
  }
}

function findOwnedTask(id, userId) {
  return db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(id, userId);
}

// ---------- Tasks ----------
router.get('/', (req, res) => {
  const {
    status,
    priority,
    search,
    project_id: projectId,
    tag_id: tagId,
    due_soon: dueSoon,
  } = req.query;

  let sql = `
    SELECT t.*, p.name AS project_name, p.color AS project_color,
      (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = t.id) AS subtask_count,
      (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = t.id AND s.completed = 1) AS subtask_done,
      (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) AS comment_count
    FROM tasks t
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.user_id = ?
  `;
  const params = [req.user.id];

  if (status && STATUSES.includes(status)) {
    sql += ' AND t.status = ?';
    params.push(status);
  }
  if (priority && PRIORITIES.includes(priority)) {
    sql += ' AND t.priority = ?';
    params.push(priority);
  }
  if (search) {
    sql += ' AND (t.title LIKE ? OR t.description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (projectId) {
    sql += ' AND t.project_id = ?';
    params.push(projectId);
  }
  if (tagId) {
    sql += ' AND EXISTS (SELECT 1 FROM task_tags tt WHERE tt.task_id = t.id AND tt.tag_id = ?)';
    params.push(tagId);
  }
  if (dueSoon) {
    sql += " AND t.status != 'completed' AND t.due_date IS NOT NULL AND t.due_date <= date('now', '+3 days')";
  }

  sql += ` ORDER BY
    CASE t.status WHEN 'completed' THEN 1 ELSE 0 END,
    t.due_date IS NULL,
    t.due_date ASC,
    CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END`;

  const tasks = db.prepare(sql).all(...params);
  res.json(attachTags(tasks));
});

router.get('/:id', (req, res) => {
  const task = db
    .prepare(
      `SELECT t.*, p.name AS project_name, p.color AS project_color
       FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
       WHERE t.id = ? AND t.user_id = ?`
    )
    .get(req.params.id, req.user.id);
  if (!task) return res.status(404).json({ error: 'Task not found.' });

  attachTags([task]);
  task.subtasks = db
    .prepare('SELECT * FROM subtasks WHERE task_id = ? ORDER BY position ASC, id ASC')
    .all(task.id);
  task.comments = db
    .prepare(
      `SELECT c.*, u.name AS author_name FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.task_id = ? ORDER BY c.created_at ASC`
    )
    .all(task.id);

  res.json(task);
});

router.post('/', (req, res) => {
  const errors = validateTask(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });

  const {
    title,
    description = '',
    priority = 'medium',
    due_date: dueDate = null,
    project_id: projectId = null,
    tag_ids: tagIds = [],
  } = req.body;

  if (projectId) {
    const project = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').get(projectId, req.user.id);
    if (!project) return res.status(400).json({ error: 'Invalid project.' });
  }

  const result = db
    .prepare(
      'INSERT INTO tasks (user_id, project_id, title, description, priority, due_date) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(
      req.user.id,
      projectId || null,
      String(title).trim(),
      String(description).trim(),
      priority,
      dueDate || null
    );

  setTaskTags(result.lastInsertRowid, tagIds);

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
  attachTags([task]);
  res.status(201).json(task);
});

router.put('/:id', (req, res) => {
  const task = findOwnedTask(req.params.id, req.user.id);
  if (!task) return res.status(404).json({ error: 'Task not found.' });

  const errors = validateTask(req.body || {}, { partial: true });
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });

  if (req.body.project_id) {
    const project = db
      .prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?')
      .get(req.body.project_id, req.user.id);
    if (!project) return res.status(400).json({ error: 'Invalid project.' });
  }

  const updated = {
    title: req.body.title !== undefined ? String(req.body.title).trim() : task.title,
    description:
      req.body.description !== undefined ? String(req.body.description).trim() : task.description,
    priority: req.body.priority !== undefined ? req.body.priority : task.priority,
    status: req.body.status !== undefined ? req.body.status : task.status,
    due_date: req.body.due_date !== undefined ? req.body.due_date || null : task.due_date,
    project_id: req.body.project_id !== undefined ? req.body.project_id || null : task.project_id,
  };

  db.prepare(
    `UPDATE tasks
     SET title = ?, description = ?, priority = ?, status = ?, due_date = ?, project_id = ?, updated_at = datetime('now')
     WHERE id = ? AND user_id = ?`
  ).run(
    updated.title,
    updated.description,
    updated.priority,
    updated.status,
    updated.due_date,
    updated.project_id,
    task.id,
    req.user.id
  );

  if (req.body.tag_ids !== undefined) {
    setTaskTags(task.id, req.body.tag_ids);
  }

  const result = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id);
  attachTags([result]);
  res.json(result);
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Task not found.' });
  res.status(204).end();
});

// ---------- Subtasks ----------
router.get('/:taskId/subtasks', (req, res) => {
  const task = findOwnedTask(req.params.taskId, req.user.id);
  if (!task) return res.status(404).json({ error: 'Task not found.' });
  res.json(db.prepare('SELECT * FROM subtasks WHERE task_id = ? ORDER BY position ASC, id ASC').all(task.id));
});

router.post('/:taskId/subtasks', (req, res) => {
  const task = findOwnedTask(req.params.taskId, req.user.id);
  if (!task) return res.status(404).json({ error: 'Task not found.' });

  const { title } = req.body || {};
  if (!title || !String(title).trim()) return res.status(400).json({ error: 'Subtask title is required.' });

  const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM subtasks WHERE task_id = ?').get(task.id).m;
  const result = db
    .prepare('INSERT INTO subtasks (task_id, title, position) VALUES (?, ?, ?)')
    .run(task.id, String(title).trim(), maxPos + 1);

  res.status(201).json(db.prepare('SELECT * FROM subtasks WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:taskId/subtasks/:id', (req, res) => {
  const task = findOwnedTask(req.params.taskId, req.user.id);
  if (!task) return res.status(404).json({ error: 'Task not found.' });

  const subtask = db.prepare('SELECT * FROM subtasks WHERE id = ? AND task_id = ?').get(req.params.id, task.id);
  if (!subtask) return res.status(404).json({ error: 'Subtask not found.' });

  const title = req.body.title !== undefined ? String(req.body.title).trim() : subtask.title;
  const completed = req.body.completed !== undefined ? (req.body.completed ? 1 : 0) : subtask.completed;
  if (!title) return res.status(400).json({ error: 'Subtask title is required.' });

  db.prepare('UPDATE subtasks SET title = ?, completed = ? WHERE id = ?').run(title, completed, subtask.id);
  res.json(db.prepare('SELECT * FROM subtasks WHERE id = ?').get(subtask.id));
});

router.delete('/:taskId/subtasks/:id', (req, res) => {
  const task = findOwnedTask(req.params.taskId, req.user.id);
  if (!task) return res.status(404).json({ error: 'Task not found.' });

  const result = db.prepare('DELETE FROM subtasks WHERE id = ? AND task_id = ?').run(req.params.id, task.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Subtask not found.' });
  res.status(204).end();
});

// ---------- Comments ----------
router.get('/:taskId/comments', (req, res) => {
  const task = findOwnedTask(req.params.taskId, req.user.id);
  if (!task) return res.status(404).json({ error: 'Task not found.' });
  res.json(
    db
      .prepare(
        `SELECT c.*, u.name AS author_name FROM comments c JOIN users u ON u.id = c.user_id
         WHERE c.task_id = ? ORDER BY c.created_at ASC`
      )
      .all(task.id)
  );
});

router.post('/:taskId/comments', (req, res) => {
  const task = findOwnedTask(req.params.taskId, req.user.id);
  if (!task) return res.status(404).json({ error: 'Task not found.' });

  const { body } = req.body || {};
  if (!body || !String(body).trim()) return res.status(400).json({ error: 'Comment cannot be empty.' });

  const result = db
    .prepare('INSERT INTO comments (task_id, user_id, body) VALUES (?, ?, ?)')
    .run(task.id, req.user.id, String(body).trim());

  const comment = db
    .prepare('SELECT c.*, u.name AS author_name FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?')
    .get(result.lastInsertRowid);
  res.status(201).json(comment);
});

router.delete('/:taskId/comments/:id', (req, res) => {
  const task = findOwnedTask(req.params.taskId, req.user.id);
  if (!task) return res.status(404).json({ error: 'Task not found.' });

  const result = db
    .prepare('DELETE FROM comments WHERE id = ? AND task_id = ? AND user_id = ?')
    .run(req.params.id, task.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Comment not found.' });
  res.status(204).end();
});

module.exports = router;
