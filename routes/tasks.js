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

// List tasks with optional filtering: /api/tasks?status=pending&priority=high&search=report
router.get('/', (req, res) => {
  const { status, priority, search } = req.query;

  let sql = 'SELECT * FROM tasks WHERE user_id = ?';
  const params = [req.user.id];

  if (status && STATUSES.includes(status)) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (priority && PRIORITIES.includes(priority)) {
    sql += ' AND priority = ?';
    params.push(priority);
  }
  if (search) {
    sql += ' AND (title LIKE ? OR description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  sql += ` ORDER BY
    CASE status WHEN 'completed' THEN 1 ELSE 0 END,
    due_date IS NULL,
    due_date ASC,
    CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END`;

  res.json(db.prepare(sql).all(...params));
});

router.post('/', (req, res) => {
  const errors = validateTask(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });

  const { title, description = '', priority = 'medium', due_date: dueDate = null } = req.body;

  const result = db
    .prepare(
      'INSERT INTO tasks (user_id, title, description, priority, due_date) VALUES (?, ?, ?, ?, ?)'
    )
    .run(req.user.id, String(title).trim(), String(description).trim(), priority, dueDate || null);

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(task);
});

router.put('/:id', (req, res) => {
  const task = db
    .prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!task) return res.status(404).json({ error: 'Task not found.' });

  const errors = validateTask(req.body || {}, { partial: true });
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });

  const updated = {
    title: req.body.title !== undefined ? String(req.body.title).trim() : task.title,
    description:
      req.body.description !== undefined ? String(req.body.description).trim() : task.description,
    priority: req.body.priority !== undefined ? req.body.priority : task.priority,
    status: req.body.status !== undefined ? req.body.status : task.status,
    due_date: req.body.due_date !== undefined ? req.body.due_date || null : task.due_date,
  };

  db.prepare(
    `UPDATE tasks
     SET title = ?, description = ?, priority = ?, status = ?, due_date = ?, updated_at = datetime('now')
     WHERE id = ? AND user_id = ?`
  ).run(
    updated.title,
    updated.description,
    updated.priority,
    updated.status,
    updated.due_date,
    task.id,
    req.user.id
  );

  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id));
});

router.delete('/:id', (req, res) => {
  const result = db
    .prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Task not found.' });
  res.status(204).end();
});

module.exports = router;
