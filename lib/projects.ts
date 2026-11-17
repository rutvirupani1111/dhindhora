import { randomBytes } from "node:crypto";
import type { DocIn } from "./schema";

export const LIMITS = { guest: 10, member: 100, system: 1000 } as const;
export function newProjectId() {
  const a = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const b = randomBytes(10); let s = ""; for (const x of b) s += a[x % 62];
  return s;
}
export function titleOf(doc: DocIn) { return (doc.brief.name || "Bina naam ki dukaan").slice(0, 80); }

export const PLACEHOLDER_NAME = "Aapki dukaan ka naam";
/** Remix and "Doosri dukaan ke liye": keep the template, clear the brand. */
export function clearBrand(doc: DocIn): DocIn {
  const old = doc.brief;
  const secrets = [old.name, old.cta.phone, old.cta.address, old.cta.url].filter((s): s is string => !!s && s.trim().length > 1);
  const brief = {
    ...old,
    name: PLACEHOLDER_NAME,
    logo: undefined,
    cta: { text: old.cta.text, phone: "", address: "", url: "" },
  };
  const scenes = doc.scenes.map((s) => {
    const text: Record<string, string> = {};
    for (const [k, v] of Object.entries(s.text)) if (!secrets.some((x) => v.includes(x))) text[k] = v;
    const { lock: _drop, ...rest } = s;
    return { ...rest, text };
  });
  return { ...doc, brief, scenes } as DocIn;
}

export function rowMeta(doc: DocIn) {
  return { style: doc.style, aspect: doc.aspect, length_sec: doc.lengthSec, renderer_version: doc.renderer, schema_version: doc.schema };
}
