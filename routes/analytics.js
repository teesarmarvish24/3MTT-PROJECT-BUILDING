const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const userId = req.user.id;

  const byStatus = db
    .prepare('SELECT status, COUNT(*) AS count FROM tasks WHERE user_id = ? GROUP BY status')
    .all(userId);

  const byPriority = db
    .prepare('SELECT priority, COUNT(*) AS count FROM tasks WHERE user_id = ? GROUP BY priority')
    .all(userId);

  const total = db.prepare('SELECT COUNT(*) AS count FROM tasks WHERE user_id = ?').get(userId).count;
  const completed = db
    .prepare("SELECT COUNT(*) AS count FROM tasks WHERE user_id = ? AND status = 'completed'")
    .get(userId).count;
  const overdue = db
    .prepare(
      `SELECT COUNT(*) AS count FROM tasks
       WHERE user_id = ? AND status != 'completed' AND due_date IS NOT NULL AND due_date < date('now')`
    )
    .get(userId).count;

  const completedRows = db
    .prepare(
      `SELECT date(updated_at) AS day, COUNT(*) AS count
       FROM tasks
       WHERE user_id = ? AND status = 'completed' AND date(updated_at) >= date('now', '-13 days')
       GROUP BY day`
    )
    .all(userId);

  const dayMap = new Map(completedRows.map((r) => [r.day, r.count]));
  const trend = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    trend.push({ day: key, count: dayMap.get(key) || 0 });
  }

  res.json({
    total,
    completed,
    overdue,
    completionRate: total ? Math.round((completed / total) * 100) : 0,
    byStatus,
    byPriority,
    trend,
  });
});

module.exports = router;
