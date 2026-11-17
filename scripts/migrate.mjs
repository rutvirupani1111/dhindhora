// Applies db/migrations/*.sql in order, once each. Usage: node --env-file=.env.local scripts/migrate.mjs
import fs from "node:fs";
import path from "node:path";
import { Pool } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL is not set"); process.exit(1); }
const pool = new Pool({ connectionString: url });
const dir = path.resolve("db/migrations");
await pool.query("create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())");
const done = new Set((await pool.query("select name from schema_migrations")).rows.map((r) => r.name));
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  if (done.has(f)) continue;
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(fs.readFileSync(path.join(dir, f), "utf8"));
    await c.query("insert into schema_migrations (name) values ($1)", [f]);
    await c.query("commit");
    console.log("applied", f);
  } catch (e) {
    await c.query("rollback"); console.error("failed", f, e.message); process.exit(1);
  } finally { c.release(); }
}
await pool.end();
console.log("migrations up to date");
