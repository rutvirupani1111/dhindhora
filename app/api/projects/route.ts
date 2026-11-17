import { getActor, mintGuest } from "@/lib/auth";
import { db } from "@/lib/db";
import { bad, checkOrigin, json, rateLimit } from "@/lib/http";
import { LIMITS, rowMeta, titleOf } from "@/lib/projects";
import { CreateSchema } from "@/lib/schema";

export async function GET(req: Request) {
  const a = await getActor();
  if (!a) return json({ items: [], next: null });
  const url = new URL(req.url);
  const deleted = url.searchParams.get("deleted") === "1";
  const cursor = url.searchParams.get("cursor");
  const rows = await db.query(
    `select id, title, style, aspect, length_sec, status, visibility, version, published_version, updated_at, deleted_at,
            doc->'scenes'->0 as cover_scene, doc->'brief'->'colors' as colors, doc->'brief'->'name' as name, doc->>'seed' as seed
       from projects
      where owner_id = $1 and ${deleted ? "deleted_at is not null and deleted_at > now() - interval '30 days'" : "deleted_at is null"}
        and ($2::timestamptz is null or updated_at < $2::timestamptz)
      order by updated_at desc limit 25`,
    [a.id, cursor],
  );
  const more = rows.length > 24;
  const items = rows.slice(0, 24);
  return json({ items, next: more ? items[items.length - 1].updated_at : null });
}

export async function POST(req: Request) {
  const o = checkOrigin(req); if (o) return o;
  const p = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return bad("invalid_doc", { issues: p.error.issues.slice(0, 5) });
  const actor = (await getActor()) || (await mintGuest());
  const rl = await rateLimit("write:" + actor.id, 60, 60); if (rl) return rl;
  const [{ n }] = await db.query<{ n: number }>("select count(*)::int as n from projects where owner_id = $1 and deleted_at is null", [actor.id]);
  if (n >= LIMITS[actor.kind]) return json({ error: "limit", message: actor.kind === "guest" ? "10 dukaan ho gayi. Account bana lo, 100 tak bana sakte ho." : "100 dukaan ki hadd" }, 403);
  const m = rowMeta(p.data.doc);
  const r = await db.query<{ version: number }>(
    `insert into projects (id, owner_id, title, doc, style, aspect, length_sec, renderer_version, schema_version)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9) on conflict (id) do nothing returning version`,
    [p.data.id, actor.id, titleOf(p.data.doc), JSON.stringify(p.data.doc), m.style, m.aspect, m.length_sec, m.renderer_version, m.schema_version],
  );
  if (!r[0]) return json({ error: "exists" }, 409);
  await db.query("insert into project_revisions (project_id, version, doc) values ($1, 1, $2)", [p.data.id, JSON.stringify(p.data.doc)]);
  return json({ id: p.data.id, version: 1, owner: actor.id }, 201);
}
