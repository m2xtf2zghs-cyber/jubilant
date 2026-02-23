const express = require('express');
const { asyncHandler } = require('../utils/http');
const { query } = require('../db');

const router = express.Router();

router.get('/health', asyncHandler(async (_req, res) => {
  const started = Date.now();
  const db = { ok: false };
  try {
    await query('select 1 as ok');
    db.ok = true;
  } catch (error) {
    db.ok = false;
    db.error = error.message;
  }

  res.json({
    ok: db.ok,
    service: 'yash-portfolio-backend',
    timestamp: new Date().toISOString(),
    db,
    responseMs: Date.now() - started,
  });
}));

module.exports = router;
