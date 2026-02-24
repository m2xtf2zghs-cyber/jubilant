const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: process.env.BACKEND_ENV_FILE || path.resolve(process.cwd(), '.env') });

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Missing DATABASE_URL');
  }

  const schemaPath = path.resolve(process.cwd(), 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  const getSslConfig = (connectionString) => {
    try {
      const u = new URL(connectionString);
      const host = String(u.hostname || '');
      const sslmode = (u.searchParams.get('sslmode') || '').toLowerCase();
      if (sslmode === 'require' || host.endsWith('.render.com')) {
        return { rejectUnauthorized: false };
      }
    } catch (_) {
      // ignore parse errors
    }
    return undefined;
  };

  const ssl = getSslConfig(databaseUrl);
  const client = new Client({ connectionString: databaseUrl, ...(ssl ? { ssl } : {}) });
  await client.connect();
  try {
    const bootstrapCheck = await client.query(`
      select
        to_regclass('public.organizations') as organizations,
        to_regclass('public.users') as users,
        to_regclass('public.clients') as clients,
        to_regclass('public.loans') as loans,
        to_regclass('public.installments') as installments,
        to_regclass('public.collections') as collections,
        to_regclass('public.ledger_entries') as ledger_entries,
        to_regclass('public.audit_logs') as audit_logs
    `);
    const row = bootstrapCheck.rows[0] || {};
    const keys = Object.keys(row);
    const existing = keys.filter((k) => !!row[k]);
    if (existing.length === keys.length) {
      console.log('[schema] already initialized; skipping apply');
      return;
    }
    if (existing.length > 0) {
      throw new Error(`[schema] partial schema detected (${existing.length}/${keys.length} core tables exist). Resolve manually before retrying.`);
    }

    await client.query(sql);
    console.log(`[schema] applied: ${schemaPath}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[schema] failed', err);
  process.exit(1);
});
