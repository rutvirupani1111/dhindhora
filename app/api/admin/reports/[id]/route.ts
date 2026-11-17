import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActor, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkOrigin, json, notFound } from "@/lib/http";

const Body = z.object({ action: z.enum(["kept", "hidden", "deleted", "feature", "unfeature"]) });

/** Resolve a report (id = report id), or toggle featured (id = project id). ADMIN_EMAILS only. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const o = checkOrigin(req); if (o) return o;
  const a = await getActor();
  if (!isAdmin(a)) return notFound();
  const { id } = await params;
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return json({ error: "invalid" }, 400);
  const act = p.data.action;
  if (act === "feature" || act === "unfeature") {
    await db.query("update projects set featured = $2 where id = $1", [id, act === "feature"]);
    return json({ ok: true });
  }
  const rep = await db.query<{ project_id: string }>("select project_id from reports where id = $1", [Number(id)]);
  if (!rep[0]) return notFound();
  const pid = rep[0].project_id;
  await db.query("update reports set resolved_at = now(), resolution = $2 where project_id = $1 and resolved_at is null", [pid, act]);
  if (act === "kept") await db.query("update projects set hidden_at = null where id = $1", [pid]);
  if (act === "hidden") await db.query("update projects set hidden_at = coalesce(hidden_at, now()) where id = $1", [pid]);
  if (act === "deleted") await db.query("update projects set deleted_at = now() where id = $1", [pid]);
  revalidatePath(`/v/${pid}`);
  return json({ ok: true });
}
