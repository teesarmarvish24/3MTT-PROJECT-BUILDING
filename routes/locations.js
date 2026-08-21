const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    res.json(await db.all('SELECT * FROM locations WHERE user_id = ? ORDER BY created_at ASC', [req.user.id]));
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { label, address } = req.body || {};
    if (!label || !String(label).trim()) return res.status(400).json({ error: 'A label is required.' });
    if (!address || !String(address).trim()) return res.status(400).json({ error: 'An address is required.' });

    const result = await db.run('INSERT INTO locations (user_id, label, address) VALUES (?, ?, ?)', [
      req.user.id,
      String(label).trim(),
      String(address).trim(),
    ]);

    res.status(201).json(await db.get('SELECT * FROM locations WHERE id = ?', [result.lastInsertRowid]));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await db.run('DELETE FROM locations WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Location not found.' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
