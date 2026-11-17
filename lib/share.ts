import { db } from "./db";
import type { DocIn } from "./schema";

export type Shared = { id: string; title: string; doc: DocIn; visibility: "unlisted" | "public"; remix_count: number; is_demo: boolean; published_version: number };

/** Share routes read only published_doc, only when unlisted or public, not deleted and not hidden. */
export async function getShared(id: string): Promise<Shared | null> {
  if (!/^[A-Za-z0-9_-]{10}$/.test(id)) return null;
  const r = await db.query<Shared>(
    `select id, title, published_doc as doc, visibility, remix_count, is_demo, published_version from projects
      where id = $1 and visibility in ('unlisted','public') and published_doc is not null and deleted_at is null and hidden_at is null`,
    [id],
  );
  return r[0] || null;
}

/** JSON safe to inline inside <script type="application/json">. */
export function inlineJson(v: unknown) {
  return JSON.stringify(v).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
export const escHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const SHARE_CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
