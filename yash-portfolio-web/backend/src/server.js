const express = require('express');
const cors = require('cors');
const { config } = require('./config');
const { rootRouter } = require('./routes');
const { errorHandler, notFoundHandler } = require('./utils/http');
const { closePool } = require('./db');

const app = express();

const normalizeOrigin = (value) => String(value || '').trim().replace(/\/+$/, '').toLowerCase();
const exactCorsOrigins = new Set((config.corsOrigin || []).map(normalizeOrigin).filter(Boolean));

function isAllowedNetlifyPreview(origin) {
  if (!config.corsAllowNetlifyPreviews) return false;
  try {
    const reqUrl = new URL(origin);
    const host = String(reqUrl.hostname || '').toLowerCase();
    const match = host.match(/^[a-z0-9-]+--([a-z0-9-]+\.netlify\.app)$/i);
    if (!match) return false;
    const baseHost = match[1];
    const baseOrigin = normalizeOrigin(`${reqUrl.protocol}//${baseHost}`);
    return exactCorsOrigins.has(baseOrigin);
  } catch (_) {
    return false;
  }
}

function resolveCorsOrigin(origin, callback) {
  if (!origin) return callback(null, true); // curl/server-to-server/no-browser origin
  const normalized = normalizeOrigin(origin);
  if (exactCorsOrigins.has('*') || exactCorsOrigins.has(normalized) || isAllowedNetlifyPreview(origin)) {
    return callback(null, true);
  }
  return callback(null, false);
}

app.use(cors({ origin: resolveCorsOrigin, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.use((req, _res, next) => {
  req.requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  next();
});

app.use(rootRouter);
app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(`[backend] listening on http://localhost:${config.port}`);
});

async function shutdown(signal) {
  console.log(`[backend] received ${signal}, shutting down...`);
  server.close(async () => {
    try {
      await closePool();
    } catch (err) {
      console.error('[backend] pool close error', err);
    }
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = { app };
