const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM locations WHERE user_id = ? ORDER BY created_at ASC').all(req.user.id));
});

router.post('/', (req, res) => {
  const { label, address } = req.body || {};
  if (!label || !String(label).trim()) return res.status(400).json({ error: 'A label is required.' });
  if (!address || !String(address).trim()) return res.status(400).json({ error: 'An address is required.' });

  const result = db
    .prepare('INSERT INTO locations (user_id, label, address) VALUES (?, ?, ?)')
    .run(req.user.id, String(label).trim(), String(address).trim());

  res.status(201).json(db.prepare('SELECT * FROM locations WHERE id = ?').get(result.lastInsertRowid));
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM locations WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Location not found.' });
  res.status(204).end();
});

module.exports = router;
