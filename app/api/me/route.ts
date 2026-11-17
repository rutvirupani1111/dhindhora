import { getActor, isAdmin } from "@/lib/auth";
import { json } from "@/lib/http";

export async function GET() {
  const a = await getActor();
  if (!a) return json({ id: null, kind: "anon", name: null });
  return json({ id: a.id, kind: a.kind, name: a.name, email: a.email, admin: isAdmin(a) });
}
