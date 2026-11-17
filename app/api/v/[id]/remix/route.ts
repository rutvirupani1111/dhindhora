import { revalidatePath } from "next/cache";
import { getActor, mintGuest } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkOrigin, ipKey, json, notFound, rateLimit } from "@/lib/http";
import { LIMITS, clearBrand, newProjectId, rowMeta } from "@/lib/projects";
import type { DocIn } from "@/lib/schema";

/** Copies a public video's published doc into a new project for the caller, brand cleared. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const o = checkOrigin(req, "none"); if (o) return o;
  const { id } = await params;
  const rl = await rateLimit("remix:ip:" + ipKey(req), 20, 3600); if (rl) return rl;
  const src = await db.query<{ published_doc: DocIn }>(
    "select published_doc from projects where id = $1 and visibility = 'public' and published_doc is not null and deleted_at is null and hidden_at is null",
    [id],
  );
  if (!src[0]) return notFound();
  const actor = (await getActor()) || (await mintGuest());
  const [{ n }] = await db.query<{ n: number }>("select count(*)::int as n from projects where owner_id = $1 and deleted_at is null", [actor.id]);
  if (n >= LIMITS[actor.kind]) return json({ error: "limit", message: "Dukaan ki hadd poori ho gayi" }, 403);
  const doc = clearBrand(src[0].published_doc);
  const nid = newProjectId();
  const m = rowMeta(doc);
  await db.tx(async (q) => {
    await q.query(
      `insert into projects (id, owner_id, title, doc, style, aspect, length_sec, renderer_version, schema_version, remix_of)
       values ($1, $2, 'Remix', $3, $4, $5, $6, $7, $8, $9)`,
      [nid, actor.id, JSON.stringify(doc), m.style, m.aspect, m.length_sec, m.renderer_version, m.schema_version, id],
    );
    await q.query("update projects set remix_count = remix_count + 1 where id = $1", [id]);
  });
  revalidatePath(`/v/${id}`);
  return json({ id: nid, version: 1 }, 201);
}
