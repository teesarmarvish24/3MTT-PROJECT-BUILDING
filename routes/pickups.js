const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();
router.use(authenticate);

const WASTE_TYPES = ['general', 'recyclable', 'organic', 'hazardous'];
const TIME_WINDOWS = ['morning', 'afternoon', 'evening'];
const RECURRENCES = ['none', 'weekly', 'biweekly', 'monthly'];
const STATUSES = ['scheduled', 'collected', 'missed', 'cancelled'];

function isValidDate(str) {
  return /^\d{4}-\d{2}-\d{2}$/.test(str);
}

function nextDate(dateStr, recurrence) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (recurrence === 'weekly') d.setUTCDate(d.getUTCDate() + 7);
  else if (recurrence === 'biweekly') d.setUTCDate(d.getUTCDate() + 14);
  else if (recurrence === 'monthly') d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

function validatePickup(body, { partial = false } = {}) {
  const errors = [];
  const { waste_type: wasteType, address, time_window: timeWindow, scheduled_date: date, recurrence } = body;

  if (!partial || wasteType !== undefined) {
    if (!WASTE_TYPES.includes(wasteType)) errors.push('Waste type must be general, recyclable, organic or hazardous.');
  }
  if (!partial || address !== undefined) {
    if (!address || !String(address).trim()) errors.push('Pickup address is required.');
  }
  if (timeWindow !== undefined && !TIME_WINDOWS.includes(timeWindow)) {
    errors.push('Time window must be morning, afternoon or evening.');
  }
  if (!partial || date !== undefined) {
    if (!date || !isValidDate(date)) errors.push('Scheduled date must be in YYYY-MM-DD format.');
  }
  if (recurrence !== undefined && !RECURRENCES.includes(recurrence)) {
    errors.push('Recurrence must be none, weekly, biweekly or monthly.');
  }
  return errors;
}

function attachFeedbackFlag(pickups) {
  if (pickups.length === 0) return pickups;
  const ids = pickups.map((p) => p.id);
  const placeholders = ids.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT pickup_id, rating, comment FROM feedback WHERE pickup_id IN (${placeholders})`)
    .all(...ids);
  const byPickup = new Map(rows.map((r) => [r.pickup_id, r]));
  for (const p of pickups) {
    const fb = byPickup.get(p.id);
    p.feedback_rating = fb ? fb.rating : null;
    p.feedback_comment = fb ? fb.comment : null;
  }
  return pickups;
}

function findOwnedPickup(id, userId) {
  return db.prepare('SELECT * FROM pickups WHERE id = ? AND user_id = ?').get(id, userId);
}

// List pickups: /api/pickups?status=&waste_type=&due_soon=1
router.get('/', (req, res) => {
  const { status, waste_type: wasteType, due_soon: dueSoon } = req.query;

  let sql = 'SELECT * FROM pickups WHERE user_id = ?';
  const params = [req.user.id];

  if (status && STATUSES.includes(status)) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (wasteType && WASTE_TYPES.includes(wasteType)) {
    sql += ' AND waste_type = ?';
    params.push(wasteType);
  }
  if (dueSoon) {
    sql += " AND status = 'scheduled' AND scheduled_date <= date('now', '+2 days')";
  }

  sql += ` ORDER BY
    CASE status WHEN 'scheduled' THEN 0 ELSE 1 END,
    scheduled_date ASC`;

  const pickups = db.prepare(sql).all(...params);
  res.json(attachFeedbackFlag(pickups));
});

router.get('/:id', (req, res) => {
  const pickup = findOwnedPickup(req.params.id, req.user.id);
  if (!pickup) return res.status(404).json({ error: 'Pickup not found.' });

  pickup.feedback = db.prepare('SELECT * FROM feedback WHERE pickup_id = ?').get(pickup.id) || null;
  res.json(pickup);
});

router.post('/', (req, res) => {
  const errors = validatePickup(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });

  const {
    waste_type: wasteType,
    address,
    time_window: timeWindow = 'morning',
    scheduled_date: scheduledDate,
    recurrence = 'none',
    notes = '',
  } = req.body;

  const result = db
    .prepare(
      `INSERT INTO pickups (user_id, waste_type, address, time_window, scheduled_date, recurrence, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(req.user.id, wasteType, String(address).trim(), timeWindow, scheduledDate, recurrence, String(notes).trim());

  res.status(201).json(db.prepare('SELECT * FROM pickups WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const pickup = findOwnedPickup(req.params.id, req.user.id);
  if (!pickup) return res.status(404).json({ error: 'Pickup not found.' });

  const errors = validatePickup(req.body || {}, { partial: true });
  if (req.body.status !== undefined && !STATUSES.includes(req.body.status)) {
    errors.push('Status must be scheduled, collected, missed or cancelled.');
  }
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });

  const updated = {
    waste_type: req.body.waste_type !== undefined ? req.body.waste_type : pickup.waste_type,
    address: req.body.address !== undefined ? String(req.body.address).trim() : pickup.address,
    time_window: req.body.time_window !== undefined ? req.body.time_window : pickup.time_window,
    scheduled_date: req.body.scheduled_date !== undefined ? req.body.scheduled_date : pickup.scheduled_date,
    recurrence: req.body.recurrence !== undefined ? req.body.recurrence : pickup.recurrence,
    status: req.body.status !== undefined ? req.body.status : pickup.status,
    notes: req.body.notes !== undefined ? String(req.body.notes).trim() : pickup.notes,
  };

  db.prepare(
    `UPDATE pickups
     SET waste_type = ?, address = ?, time_window = ?, scheduled_date = ?, recurrence = ?, status = ?, notes = ?, updated_at = datetime('now')
     WHERE id = ? AND user_id = ?`
  ).run(
    updated.waste_type,
    updated.address,
    updated.time_window,
    updated.scheduled_date,
    updated.recurrence,
    updated.status,
    updated.notes,
    pickup.id,
    req.user.id
  );

  let created = null;
  const justResolved = pickup.status === 'scheduled' && (updated.status === 'collected' || updated.status === 'missed');
  if (justResolved && updated.recurrence !== 'none') {
    const newDate = nextDate(updated.scheduled_date, updated.recurrence);
    const result = db
      .prepare(
        `INSERT INTO pickups (user_id, waste_type, address, time_window, scheduled_date, recurrence, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(req.user.id, updated.waste_type, updated.address, updated.time_window, newDate, updated.recurrence, updated.notes);
    created = db.prepare('SELECT * FROM pickups WHERE id = ?').get(result.lastInsertRowid);
  }

  res.json({ pickup: db.prepare('SELECT * FROM pickups WHERE id = ?').get(pickup.id), next_pickup: created });
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM pickups WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Pickup not found.' });
  res.status(204).end();
});

// ---------- Feedback ----------
router.post('/:id/feedback', (req, res) => {
  const pickup = findOwnedPickup(req.params.id, req.user.id);
  if (!pickup) return res.status(404).json({ error: 'Pickup not found.' });

  if (!['collected', 'missed'].includes(pickup.status)) {
    return res.status(400).json({ error: 'Feedback can only be left after a pickup is collected or missed.' });
  }

  const existing = db.prepare('SELECT id FROM feedback WHERE pickup_id = ?').get(pickup.id);
  if (existing) return res.status(409).json({ error: 'Feedback has already been submitted for this pickup.' });

  const { rating, comment = '' } = req.body || {};
  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ error: 'Rating must be a whole number from 1 to 5.' });
  }

  const result = db
    .prepare('INSERT INTO feedback (pickup_id, user_id, rating, comment) VALUES (?, ?, ?, ?)')
    .run(pickup.id, req.user.id, ratingNum, String(comment).trim());

  res.status(201).json(db.prepare('SELECT * FROM feedback WHERE id = ?').get(result.lastInsertRowid));
});

router.get('/:id/feedback', (req, res) => {
  const pickup = findOwnedPickup(req.params.id, req.user.id);
  if (!pickup) return res.status(404).json({ error: 'Pickup not found.' });

  const feedback = db.prepare('SELECT * FROM feedback WHERE pickup_id = ?').get(pickup.id);
  if (!feedback) return res.status(404).json({ error: 'No feedback submitted for this pickup yet.' });
  res.json(feedback);
});

module.exports = router;
