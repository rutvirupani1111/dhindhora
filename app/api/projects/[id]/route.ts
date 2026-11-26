import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { bad, checkOrigin, json, notFound, rateLimit } from "@/lib/http";
import { rowMeta, titleOf } from "@/lib/projects";
import { PutSchema } from "@/lib/schema";

type P = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: P) {
  const { id } = await params;
  const a = await getActor(); if (!a) return notFound();
  const r = await db.query("select id, doc, version, visibility, status, published_version, title from projects where id = $1 and owner_id = $2 and deleted_at is null", [id, a.id]);
  return r[0] ? json(r[0]) : notFound();
}

/** Optimistic concurrency: writes only when baseVersion matches, else 409 with the server doc for a 3-way merge. */
export async function PUT(req: Request, { params }: P) {
  const o = checkOrigin(req); if (o) return o;
  const { id } = await params;
  const a = await getActor(); if (!a) return notFound();
  const p = PutSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return bad("invalid_doc", { issues: p.error.issues.slice(0, 5) });
  const rl = await rateLimit("write:" + a.id, 60, 60); if (rl) return rl;
  const m = rowMeta(p.data.doc);
  const doc = JSON.stringify(p.data.doc);
  const r = await db.query<{ version: number }>(
    `update projects set doc = $3, title = $4, style = $5, aspect = $6, length_sec = $7, renderer_version = $8, version = version + 1, updated_at = now()
      where id = $1 and owner_id = $2 and deleted_at is null and version = $9 returning version`,
    [id, a.id, doc, titleOf(p.data.doc), m.style, m.aspect, m.length_sec, m.renderer_version, p.data.baseVersion],
  );
  if (!r[0]) {
    const cur = await db.query<{ version: number; doc: unknown }>("select version, doc from projects where id = $1 and owner_id = $2 and deleted_at is null", [id, a.id]);
    if (!cur[0]) return notFound();
    return json({ error: "conflict", version: cur[0].version, doc: cur[0].doc }, 409);
  }
  const v = r[0].version;
  await db.query("insert into project_revisions (project_id, version, doc) values ($1, $2, $3) on conflict do nothing", [id, v, doc]);
  await db.query("delete from project_revisions where project_id = $1 and version <= $2", [id, v - 20]);
  return json({ version: v });
}

export async function DELETE(req: Request, { params }: P) {
  const o = checkOrigin(req, "none"); if (o) return o;
  const { id } = await params;
  const a = await getActor(); if (!a) return notFound();
  const r = await db.query("update projects set deleted_at = now() where id = $1 and owner_id = $2 and deleted_at is null returning id", [id, a.id]);
  if (!r[0]) return notFound();
  // a closed shop's link stops playing at once, not when the cached share page next happens to refresh
  revalidatePath(`/v/${id}`); revalidatePath(`/v/${id}/data.json`);
  return json({ ok: true });
}
