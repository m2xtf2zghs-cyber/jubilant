const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: process.env.BACKEND_ENV_FILE || path.resolve(process.cwd(), '.env') });

function getArg(name, fallback) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : (process.env[name.toUpperCase()] || fallback);
}

function must(name, value) {
  if (!value) throw new Error(`Missing required value: ${name}`);
  return value;
}

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
    // ignore parse errors
  }
  return undefined;
}

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function safeDbHost(connectionString) {
  try {
    const u = new URL(connectionString);
    return u.hostname || null;
  } catch (_) {
    return null;
  }
}

function tsFileStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function pickOrderColumns(cols) {
  const preferred = [
    'created_at',
    'entry_time',
    'collection_date',
    'expense_date',
    'due_date',
    'effective_date',
    'received_at',
    'installment_no',
    'id',
  ];
  const picked = preferred.filter((c) => cols.has(c));
  if (!picked.length && cols.has('id')) return ['id'];
  return picked;
}

async function main() {
  const databaseUrl = must('DATABASE_URL', process.env.DATABASE_URL);
  const orgCodeArg = String(getArg('orgCode', '') || '').trim().toLowerCase();
  const outArg = String(getArg('out', '') || '').trim();
  const defaultOut = path.resolve(process.cwd(), 'backups', `yash-backup-${orgCodeArg || 'all'}-${tsFileStamp()}.json`);
  const outPath = path.resolve(process.cwd(), outArg || defaultOut);

  const ssl = getSslConfig(databaseUrl);
  const client = new Client({ connectionString: databaseUrl, ...(ssl ? { ssl } : {}) });
  await client.connect();

  const tableOrder = [
    'organizations',
    'users',
    'devices',
    'clients',
    'loan_products',
    'loans',
    'installments',
    'collections',
    'expenses',
    'ledger_entries',
    'opening_balances',
    'reminder_logs',
    'audit_logs',
    'sync_outbox_events',
  ];

  try {
    let org = null;
    if (orgCodeArg) {
      const orgRes = await client.query(
        `select id, code, name, timezone, base_currency, created_at, updated_at
         from organizations
         where lower(code) = $1`,
        [orgCodeArg]
      );
      org = orgRes.rows[0] || null;
      if (!org) throw new Error(`Organization not found for orgCode=${orgCodeArg}`);
    }

    const columnsRes = await client.query(
      `
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = any($1::text[])
      order by table_name, ordinal_position
      `,
      [tableOrder]
    );

    const columnsByTable = new Map();
    for (const row of columnsRes.rows) {
      const key = String(row.table_name);
      if (!columnsByTable.has(key)) columnsByTable.set(key, new Set());
      columnsByTable.get(key).add(String(row.column_name));
    }

    const tables = {};
    const counts = {};

    for (const table of tableOrder) {
      const cols = columnsByTable.get(table);
      if (!cols) continue;

      let where = '';
      let params = [];
      if (org) {
        if (table === 'organizations') {
          where = ' where id = $1';
          params = [org.id];
        } else if (cols.has('organization_id')) {
          where = ' where organization_id = $1';
          params = [org.id];
        }
      }

      const orderCols = pickOrderColumns(cols);
      const orderBy = orderCols.length ? ` order by ${orderCols.map(quoteIdent).join(', ')}` : '';
      const sql = `select * from ${quoteIdent(table)}${where}${orderBy}`;
      const res = await client.query(sql, params);
      tables[table] = res.rows;
      counts[table] = res.rows.length;
    }

    const payload = {
      meta: {
        generatedAt: new Date().toISOString(),
        format: 'yash-portfolio-backup-json/v1',
        dbHost: safeDbHost(databaseUrl),
        orgFilter: org ? { id: org.id, code: org.code, name: org.name } : null,
      },
      counts,
      tables,
    };

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));

    console.log(JSON.stringify({
      ok: true,
      outPath,
      orgCode: org ? org.code : null,
      totalRows: Object.values(counts).reduce((sum, n) => sum + Number(n || 0), 0),
      counts,
    }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[backup:json] failed', err);
  process.exit(1);
});
