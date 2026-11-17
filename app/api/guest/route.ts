import { getActor, mintGuest } from "@/lib/auth";
import { checkOrigin, ipKey, json, rateLimit } from "@/lib/http";

export async function POST(req: Request) {
  const bad = checkOrigin(req, "none"); if (bad) return bad;
  const a = await getActor();
  if (a) return json({ id: a.id, kind: a.kind, name: a.name });
  const rl = await rateLimit("guest:ip:" + ipKey(req), 5, 3600); if (rl) return rl;
  const g = await mintGuest();
  return json({ id: g.id, kind: g.kind, name: null });
}
