const express = require('express');
const db = require('../config/db');

const router = express.Router();

router.get('/ranking', (req, res) => {

  const sqlRanking = `
    SELECT
      user_id,
      SUM(CO2) AS total_CO2,
      SUM(kcal) AS total_kcal,
      SUM(money) AS total_money
    FROM user_routes
    GROUP BY user_id
    ORDER BY total_CO2 DESC, total_kcal DESC, total_money DESC
  `;
  
  db.query(sqlRanking, (err, results) => {
    if (err) {
      console.error('Query error:', err);
      return res.status(500).json({ error: 'DB error' });
    }
    
    if (results.length === 0) {
      console.log('No ranking data found');
    }

    res.json(results);
  });
});

module.exports = router;
