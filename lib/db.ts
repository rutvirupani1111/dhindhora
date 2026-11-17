import { Pool, type PoolClient } from "@neondatabase/serverless";

type G = { __dhPool?: Pool };
const g = globalThis as unknown as G;

function pool() {
  if (!g.__dhPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    g.__dhPool = new Pool({ connectionString: url, max: 5 });
  }
  return g.__dhPool;
}

export type Q = { query<T = Record<string, any>>(sql: string, params?: unknown[]): Promise<T[]> };

export const db: Q & { tx<T>(fn: (q: Q) => Promise<T>): Promise<T> } = {
  async query<T>(sql: string, params: unknown[] = []) {
    const r = await pool().query(sql, params as unknown[]);
    return r.rows as T[];
  },
  async tx<T>(fn: (q: Q) => Promise<T>) {
    const c: PoolClient = await pool().connect();
    try {
      await c.query("begin");
      const out = await fn({ async query<R>(sql: string, params: unknown[] = []) { return (await c.query(sql, params as unknown[])).rows as R[]; } });
      await c.query("commit");
      return out;
    } catch (e) {
      await c.query("rollback").catch(() => {});
      throw e;
    } finally {
      c.release();
    }
  },
};
