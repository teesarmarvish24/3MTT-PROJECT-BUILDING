const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();
router.use(authenticate);

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM tags WHERE user_id = ? ORDER BY name ASC').all(req.user.id));
});

router.post('/', (req, res) => {
  const { name, color = '#6b7671' } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'Tag name is required.' });
  }
  if (!HEX_COLOR.test(color)) {
    return res.status(400).json({ error: 'Color must be a hex value like #6b7671.' });
  }

  const trimmed = String(name).trim();
  const existing = db.prepare('SELECT id FROM tags WHERE user_id = ? AND name = ?').get(req.user.id, trimmed);
  if (existing) return res.status(409).json({ error: 'A tag with this name already exists.' });

  const result = db
    .prepare('INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)')
    .run(req.user.id, trimmed, color);

  res.status(201).json(db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid));
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM tags WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Tag not found.' });
  res.status(204).end();
});

module.exports = router;
