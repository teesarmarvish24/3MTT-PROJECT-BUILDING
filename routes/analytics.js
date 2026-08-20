const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const userId = req.user.id;

  const byStatus = db
    .prepare('SELECT status, COUNT(*) AS count FROM pickups WHERE user_id = ? GROUP BY status')
    .all(userId);
  const byWasteType = db
    .prepare('SELECT waste_type, COUNT(*) AS count FROM pickups WHERE user_id = ? GROUP BY waste_type')
    .all(userId);

  const total = db.prepare('SELECT COUNT(*) AS count FROM pickups WHERE user_id = ?').get(userId).count;
  const collected = db
    .prepare("SELECT COUNT(*) AS count FROM pickups WHERE user_id = ? AND status = 'collected'")
    .get(userId).count;
  const missed = db
    .prepare("SELECT COUNT(*) AS count FROM pickups WHERE user_id = ? AND status = 'missed'")
    .get(userId).count;

  const ratingRow = db
    .prepare(
      `SELECT COUNT(*) AS count, COALESCE(AVG(f.rating), 0) AS avg
       FROM feedback f JOIN pickups p ON p.id = f.pickup_id
       WHERE p.user_id = ?`
    )
    .get(userId);

  const ratingBreakdownRows = db
    .prepare(
      `SELECT f.rating, COUNT(*) AS count
       FROM feedback f JOIN pickups p ON p.id = f.pickup_id
       WHERE p.user_id = ? GROUP BY f.rating`
    )
    .all(userId);

  const trendRows = db
    .prepare(
      `SELECT date(updated_at) AS day, COUNT(*) AS count
       FROM pickups
       WHERE user_id = ? AND status = 'collected' AND date(updated_at) >= date('now', '-13 days')
       GROUP BY day`
    )
    .all(userId);

  const dayMap = new Map(trendRows.map((r) => [r.day, r.count]));
  const trend = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    trend.push({ day: key, count: dayMap.get(key) || 0 });
  }

  res.json({
    total,
    collected,
    missed,
    completionRate: collected + missed > 0 ? Math.round((collected / (collected + missed)) * 100) : 0,
    byStatus,
    byWasteType,
    avgRating: Math.round(ratingRow.avg * 10) / 10,
    ratingCount: ratingRow.count,
    ratingBreakdown: ratingBreakdownRows,
    trend,
  });
});

module.exports = router;
