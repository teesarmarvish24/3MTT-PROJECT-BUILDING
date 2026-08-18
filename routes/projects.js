const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();
router.use(authenticate);

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

router.get('/', (req, res) => {
  const projects = db
    .prepare(
      `SELECT p.*,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS total_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status != 'completed') AS open_count
      FROM projects p
      WHERE p.user_id = ?
      ORDER BY p.created_at ASC`
    )
    .all(req.user.id);
  res.json(projects);
});

router.post('/', (req, res) => {
  const { name, color = '#2f6f4f' } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'Project name is required.' });
  }
  if (!HEX_COLOR.test(color)) {
    return res.status(400).json({ error: 'Color must be a hex value like #2f6f4f.' });
  }

  const result = db
    .prepare('INSERT INTO projects (user_id, name, color) VALUES (?, ?, ?)')
    .run(req.user.id, String(name).trim(), color);

  res.status(201).json(db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const project = db
    .prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!project) return res.status(404).json({ error: 'Project not found.' });

  const name = req.body.name !== undefined ? String(req.body.name).trim() : project.name;
  const color = req.body.color !== undefined ? req.body.color : project.color;
  if (!name) return res.status(400).json({ error: 'Project name is required.' });
  if (!HEX_COLOR.test(color)) {
    return res.status(400).json({ error: 'Color must be a hex value like #2f6f4f.' });
  }

  db.prepare('UPDATE projects SET name = ?, color = ? WHERE id = ? AND user_id = ?').run(
    name,
    color,
    project.id,
    req.user.id
  );

  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(project.id));
});

router.delete('/:id', (req, res) => {
  const result = db
    .prepare('DELETE FROM projects WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Project not found.' });
  res.status(204).end();
});

module.exports = router;
