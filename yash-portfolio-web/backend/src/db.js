const { Pool } = require('pg');
const { config } = require('./config');

function getSslConfig(connectionString) {
  if (!connectionString) return undefined;
  try {
    const u = new URL(connectionString);
    const host = String(u.hostname || '');
    const sslmode = (u.searchParams.get('sslmode') || '').toLowerCase();
    if (sslmode === 'require' || host.endsWith('.render.com')) {
      return { rejectUnauthorized: false };
    }
  } catch (_) {
    // ignore URL parse errors and fall back to plain connection
  }
  return undefined;
}

const ssl = getSslConfig(config.databaseUrl);

const pool = new Pool({
  connectionString: config.databaseUrl,
  ...(ssl ? { ssl } : {}),
});

async function query(text, params = [], client) {
  const executor = client || pool;
  return executor.query(text, params);
}

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      // ignore rollback errors
    }
    throw error;
  } finally {
    client.release();
  }
}

async function closePool() {
  await pool.end();
}

module.exports = { pool, query, withTransaction, closePool };
