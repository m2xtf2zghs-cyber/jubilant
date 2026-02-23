const express = require('express');
const cors = require('cors');
const { config } = require('./config');
const { rootRouter } = require('./routes');
const { errorHandler, notFoundHandler } = require('./utils/http');
const { closePool } = require('./db');

const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
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
