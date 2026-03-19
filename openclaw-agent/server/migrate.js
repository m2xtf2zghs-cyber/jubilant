import fs from "fs/promises";
import path from "path";
import { Pool } from "pg";
import { config } from "./config.js";

if (!config.databaseUrl) {
  console.error("DATABASE_URL is required to run migrations.");
  process.exit(1);
}

const migrationsDir = path.resolve(process.cwd(), "server/migrations");
const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
});

async function ensureTable() {
  await pool.query(`
    create table if not exists schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `);
}

async function main() {
  await ensureTable();
  const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    const already = await pool.query("select 1 from schema_migrations where filename = $1", [file]);
    if (already.rowCount) continue;
    const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
    await pool.query("begin");
    try {
      await pool.query(sql);
      await pool.query("insert into schema_migrations (filename) values ($1)", [file]);
      await pool.query("commit");
      console.log(`Applied migration ${file}`);
    } catch (error) {
      await pool.query("rollback");
      throw error;
    }
  }
}

main()
  .then(async () => {
    await pool.end();
  })
  .catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exit(1);
  });
