import { getActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkOrigin, json, notFound, rateLimit } from "@/lib/http";
import { LIMITS, clearBrand, newProjectId, rowMeta } from "@/lib/projects";
import type { DocIn } from "@/lib/schema";

/** "Doosri dukaan ke liye": the same template for another shop, brand cleared. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const o = checkOrigin(req, "none"); if (o) return o;
  const { id } = await params;
  const a = await getActor(); if (!a) return notFound();
  const rl = await rateLimit("write:" + a.id, 60, 60); if (rl) return rl;
  const src = await db.query<{ doc: DocIn }>("select doc from projects where id = $1 and owner_id = $2 and deleted_at is null", [id, a.id]);
  if (!src[0]) return notFound();
  const [{ n }] = await db.query<{ n: number }>("select count(*)::int as n from projects where owner_id = $1 and deleted_at is null", [a.id]);
  if (n >= LIMITS[a.kind]) return json({ error: "limit" }, 403);
  const doc = clearBrand(src[0].doc);
  const nid = newProjectId();
  const m = rowMeta(doc);
  await db.query(
    `insert into projects (id, owner_id, title, doc, style, aspect, length_sec, renderer_version, schema_version, remix_of)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [nid, a.id, "Doosri dukaan", JSON.stringify(doc), m.style, m.aspect, m.length_sec, m.renderer_version, m.schema_version, id],
  );
  return json({ id: nid, version: 1 }, 201);
}
