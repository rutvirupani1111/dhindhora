import { checkPassword, claimGuest, endSession, hashPassword, newUserId, startSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkOrigin, ipKey, json, rateLimit } from "@/lib/http";
import { AuthSchema } from "@/lib/schema";

/** Munim ji's desk: email and password accounts (scrypt hashed, httpOnly session cookie). */
export async function POST(req: Request) {
  const bad = checkOrigin(req); if (bad) return bad;
  const rl = await rateLimit("auth:ip:" + ipKey(req), 10, 600); if (rl) return rl;
  const p = AuthSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return json({ error: "invalid", message: "Email sahi likho, password kam se kam 8 akshar" }, 400);
  const email = p.data.email.toLowerCase().trim();
  const rows = await db.query<{ id: string; password_hash: string | null }>("select id, password_hash from users where email = $1 and kind = 'member'", [email]);
  let id: string;
  if (p.data.mode === "signup") {
    if (rows[0]) return json({ error: "exists", message: "Ye email pehle se hai. Andar aao." }, 409);
    id = newUserId();
    await db.query("insert into users (id, kind, email, name, password_hash) values ($1, 'member', $2, $3, $4)", [id, email, p.data.name || email.split("@")[0], await hashPassword(p.data.password)]);
  } else {
    if (!rows[0] || !(await checkPassword(p.data.password, rows[0].password_hash))) return json({ error: "wrong", message: "Email ya password galat hai" }, 401);
    id = rows[0].id;
  }
  await startSession(id);
  const moved = await claimGuest(id);
  await db.query("update users set last_seen_at = now() where id = $1", [id]);
  return json({ ok: true, claimed: moved });
}

export async function DELETE(req: Request) {
  const bad = checkOrigin(req, "none"); if (bad) return bad;
  await endSession();
  return json({ ok: true });
}
