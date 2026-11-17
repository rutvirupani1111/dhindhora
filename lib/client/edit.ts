"use client";
import type { Brief, Doc, Scene } from "@/packages/renderer/core";
import { director, reconcile } from "@/packages/renderer/director";

export const todayISO = () => new Date().toISOString().slice(0, 10);

/** Brief edits re-run the director but keep the storyboard's look; only scenes reading that field relayout. */
export function rebrief(doc: Doc, brief: Brief): Doc {
  if (!doc.scenes.length) return { ...doc, brief };
  const fresh = director(brief, doc.seed, doc.lengthSec, todayISO());
  return { ...doc, brief, scenes: reconcile(doc.scenes, fresh, true) };
}
export function make(doc: Doc): Doc {
  return { ...doc, scenes: reconcile(doc.scenes, director(doc.brief, doc.seed, doc.lengthSec, todayISO())) };
}
export function reshuffle(doc: Doc): Doc {
  const seed = doc.seed + 1;
  return { ...doc, seed, scenes: reconcile(doc.scenes, director(doc.brief, seed, doc.lengthSec, todayISO())) };
}
export function patchScene(doc: Doc, id: string, fn: (s: Scene) => Scene): Doc {
  return { ...doc, scenes: doc.scenes.map((s) => (s.id === id ? fn(s) : s)) };
}
export function markEdited(s: Scene, key: string): Scene {
  return s.edited.includes(key) ? s : { ...s, edited: [...s.edited, key] };
}

export type Missing = { field: string; msg: string }[];
export function validateBrief(b: Brief): { errors: Record<string, string>; missing: string | null } {
  const e: Record<string, string> = {};
  if (!b.name.trim()) e.name = "Dukaan ka naam likho";
  if (b.name.length > 40) e.name = "40 akshar tak";
  if (!b.oneLiner.trim()) e.oneLiner = "Ek line likho";
  if (b.oneLiner.length > 90) e.oneLiner = "90 akshar tak";
  b.points.forEach((p) => { if (p.text.length > 60) e["points." + p.id] = "60 akshar tak"; });
  b.colors.forEach((c, i) => { if (!/^#[0-9a-fA-F]{6}$/.test(c)) e["colors." + i] = "Rang aise likho: #D7261E"; });
  if (b.cta.phone && !/^\+?[0-9 ]{8,15}$/.test(b.cta.phone)) e.phone = "Phone number sahi likho (8 se 15 ank)";
  if (b.cta.url && !/^https?:\/\/.{3,}/.test(b.cta.url)) e.url = "Link https:// se shuru karo";
  if (!b.cta.text.trim()) e.cta = "Bulawa likho, jaise: Aaj hi aaiye";
  b.numbers.forEach((n) => { if (n.label.length > 24) e["numbers." + n.id] = "24 akshar tak"; });
  const pts = b.points.filter((p) => p.text.trim()).length;
  let missing: string | null = null;
  if (!b.name.trim()) missing = "Dukaan ka naam likho";
  else if (!b.oneLiner.trim()) missing = "Ek line likho";
  else if (pts < 3) missing = `${3 - pts} point aur likho`;
  else if (!b.cta.text.trim()) missing = "Bulawa likho";
  else if (Object.keys(e).length) missing = "Laal line wale khane theek karo";
  return { errors: e, missing };
}
