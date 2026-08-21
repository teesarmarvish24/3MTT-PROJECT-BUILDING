const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [byStatus, byWasteType, totalRow, collectedRow, missedRow, ratingRow, ratingBreakdownRows, trendRows] =
      await Promise.all([
        db.all('SELECT status, COUNT(*) AS count FROM pickups WHERE user_id = ? GROUP BY status', [userId]),
        db.all('SELECT waste_type, COUNT(*) AS count FROM pickups WHERE user_id = ? GROUP BY waste_type', [userId]),
        db.get('SELECT COUNT(*) AS count FROM pickups WHERE user_id = ?', [userId]),
        db.get("SELECT COUNT(*) AS count FROM pickups WHERE user_id = ? AND status = 'collected'", [userId]),
        db.get("SELECT COUNT(*) AS count FROM pickups WHERE user_id = ? AND status = 'missed'", [userId]),
        db.get(
          `SELECT COUNT(*) AS count, COALESCE(AVG(f.rating), 0) AS avg
           FROM feedback f JOIN pickups p ON p.id = f.pickup_id
           WHERE p.user_id = ?`,
          [userId]
        ),
        db.all(
          `SELECT f.rating, COUNT(*) AS count
           FROM feedback f JOIN pickups p ON p.id = f.pickup_id
           WHERE p.user_id = ? GROUP BY f.rating`,
          [userId]
        ),
        db.all(
          `SELECT date(updated_at) AS day, COUNT(*) AS count
           FROM pickups
           WHERE user_id = ? AND status = 'collected' AND date(updated_at) >= date('now', '-13 days')
           GROUP BY day`,
          [userId]
        ),
      ]);

    const total = totalRow.count;
    const collected = collectedRow.count;
    const missed = missedRow.count;

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
  } catch (err) {
    next(err);
  }
});

module.exports = router;
