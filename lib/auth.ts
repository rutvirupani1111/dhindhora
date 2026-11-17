import { createHash, createHmac, randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { db, type Q } from "./db";

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
export const GUEST_COOKIE = "dh_guest";
export const SESSION_COOKIE = "dh_session";
const secret = () => process.env.AUTH_SECRET || "dev-only-secret-change-me";

export type Actor = { id: string; kind: "guest" | "member" | "system"; name: string | null; email: string | null };

export function newUserId() { return "u_" + randomBytes(12).toString("base64url").slice(0, 16); }
export function sign(v: string) { return v + "." + createHmac("sha256", secret()).update(v).digest("base64url"); }
export function unsign(s: string | undefined) {
  if (!s) return null;
  const i = s.lastIndexOf("."); if (i < 1) return null;
  const v = s.slice(0, i);
  const a = Buffer.from(sign(v)), b = Buffer.from(s);
  return a.length === b.length && timingSafeEqual(a, b) ? v : null;
}
export const sha256 = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");

export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const h = await scrypt(pw, salt, 32);
  return `scrypt$${salt.toString("base64url")}$${h.toString("base64url")}`;
}
export async function checkPassword(pw: string, stored: string | null) {
  if (!stored) return false;
  const [, s, h] = stored.split("$");
  const got = await scrypt(pw, Buffer.from(s, "base64url"), 32);
  const want = Buffer.from(h, "base64url");
  return got.length === want.length && timingSafeEqual(got, want);
}

const cookieBase = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };

/** The current actor: a signed-in member first, then the guest cookie. */
export async function getActor(): Promise<Actor | null> {
  const jar = await cookies();
  const tok = jar.get(SESSION_COOKIE)?.value;
  if (tok) {
    const rows = await db.query<Actor>(
      "select u.id, u.kind, u.name, u.email from sessions s join users u on u.id = s.user_id where s.token_hash = $1 and s.expires_at > now()",
      [sha256(tok)],
    );
    if (rows[0]) return rows[0];
  }
  const gid = unsign(jar.get(GUEST_COOKIE)?.value);
  if (gid) {
    const rows = await db.query<Actor>("select id, kind, name, email from users where id = $1 and kind = 'guest' and claimed_into is null", [gid]);
    if (rows[0]) return rows[0];
  }
  return null;
}

export async function mintGuest(q: Q = db): Promise<Actor> {
  const id = newUserId();
  await q.query("insert into users (id, kind) values ($1, 'guest')", [id]);
  (await cookies()).set(GUEST_COOKIE, sign(id), { ...cookieBase, maxAge: 180 * 86400 });
  return { id, kind: "guest", name: null, email: null };
}

export async function startSession(userId: string) {
  const tok = randomBytes(32).toString("base64url");
  await db.query("insert into sessions (token_hash, user_id, expires_at) values ($1, $2, now() + interval '30 days')", [sha256(tok), userId]);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, tok, { ...cookieBase, maxAge: 30 * 86400 });
}
export async function endSession() {
  const jar = await cookies();
  const tok = jar.get(SESSION_COOKIE)?.value;
  if (tok) await db.query("delete from sessions where token_hash = $1", [sha256(tok)]);
  jar.delete(SESSION_COOKIE);
}

/** On sign-in, the guest's projects move to the member and the guest cookie is cleared. */
export async function claimGuest(memberId: string) {
  const jar = await cookies();
  const gid = unsign(jar.get(GUEST_COOKIE)?.value);
  if (!gid || gid === memberId) return 0;
  const moved = await db.tx(async (q) => {
    const r = await q.query<{ id: string }>("update projects set owner_id = $1 where owner_id = $2 returning id", [memberId, gid]);
    await q.query("update logos set owner_id = $1 where owner_id = $2", [memberId, gid]);
    await q.query("update users set claimed_into = $1 where id = $2 and kind = 'guest'", [memberId, gid]);
    return r.length;
  });
  jar.delete(GUEST_COOKIE);
  return moved;
}

export function isAdmin(a: Actor | null) {
  if (!a?.email) return false;
  return (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).includes(a.email.toLowerCase());
}
