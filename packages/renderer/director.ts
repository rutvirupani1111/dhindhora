// The director: a pure, deterministic function from a brief and a take number to a storyboard. No AI.
import type { Brief, Doc, Scene, SceneType } from "./core";
import { canonicalJSON, fnv1a, hasDeva, mulberry32 } from "./core";

const OFFER_RE = /\d+\s*%|₹\s*\d+|rs\.?\s*\d+|\boff\b|sale|offer|छूट|ऑफ़र/i;
const ONLINE_RE = /\b(app|website|online|order)\b|ऐप|वेबसाइट|ऑनलाइन/i;

type Beat = { type: SceneType; source: string[]; variant?: 0 | 1 | 2; optional?: number; text?: Record<string, string> };

function words(s: string) { return s.trim() ? s.trim().split(/\s+/).length : 0; }
function readMs(s: string) { return (words(s) / (hasDeva(s) ? 2.2 : 2.6)) * 1000; }

export function sceneId(type: string, source: string[], occ: number) {
  return (fnv1a(type + "|" + (source[0] || "") + "|" + occ).toString(36) + "00000000").slice(0, 8);
}

export function director(brief: Brief, seed: number, lengthSec: Doc["lengthSec"] = 15, todayISO?: string): Scene[] {
  const rng = mulberry32((fnv1a(canonicalJSON(brief)) ^ seed) >>> 0);
  const beats: Beat[] = [];
  const name = brief.name.trim();
  // hook
  if (brief.logo && name.length <= 14) beats.push({ type: "seal", source: ["name"] });
  else beats.push({ type: "shutter", source: ["name", "oneLiner"] });
  // offer
  const o = brief.offer;
  if (o?.oldPrice != null && o?.newPrice != null) beats.push({ type: "price", source: ["offer"] });
  else {
    if (OFFER_RE.test(brief.oneLiner)) beats.push({ type: "shutter", source: ["oneLiner"], variant: 1 });
    else {
      const hit = brief.points.find((p) => OFFER_RE.test(p.text));
      if (hit) beats.push({ type: "shutter", source: ["points." + hit.id], variant: 1 });
    }
  }
  if (ONLINE_RE.test(brief.oneLiner)) beats.push({ type: "phone", source: ["oneLiner", ...brief.points.map((p) => "points." + p.id)], optional: 3 });
  // points
  const pts = brief.points.filter((p) => p.text.trim());
  if (pts.length === 3) beats.push({ type: "kite", source: pts.map((p) => "points." + p.id) });
  else if (pts.length >= 4) beats.push({ type: "magazine", source: pts.slice(0, 6).map((p) => "points." + p.id) });
  // numbers
  const nums = brief.numbers;
  if (nums.length === 1 || nums.length === 2) nums.forEach((n, i) => beats.push({ type: "meter", source: ["numbers." + n.id], optional: i === 1 ? 4 : undefined }));
  else if (nums.length >= 3) beats.push({ type: "meter", source: nums.map((n) => "numbers." + n.id), variant: 2 });
  const groups = new Map<string, string[]>();
  for (const n of nums) { const k = n.prefix + "|" + n.suffix; groups.set(k, [...(groups.get(k) || []), "numbers." + n.id]); }
  const g = [...groups.values()].find((v) => v.length >= 2);
  if (g) beats.push({ type: "ladoo", source: g, optional: 1 });
  if (o?.endsOn && (!todayISO || o.endsOn >= todayISO)) beats.push({ type: "countdown", source: ["offer"], optional: 2 });
  beats.push({ type: "end", source: ["cta", "name"] });

  // never the same type twice in a row
  for (let i = 1; i < beats.length - 1; i++) {
    if (beats[i].type === beats[i - 1].type) {
      const j = beats.findIndex((b, k) => k > i && k < beats.length - 1 && b.type !== beats[i].type);
      if (j > 0) [beats[i], beats[j]] = [beats[j], beats[i]];
    }
  }

  // drop optional beats until the minimums fit
  const totalMs = lengthSec * 1000;
  const MIN = 1400;
  let list = beats.slice();
  for (const level of [1, 2, 3, 4]) {
    if (list.length * MIN <= totalMs) break;
    list = list.filter((b) => b.optional !== level);
  }
  while (list.length * MIN > totalMs && list.length > 2) list.splice(list.length - 2, 1);

  const occ = new Map<string, number>();
  const scenes: Scene[] = list.map((b) => {
    const key = b.type + (b.source[0] || "");
    const n = occ.get(key) || 0; occ.set(key, n + 1);
    const variant = b.variant ?? (b.type === "meter" ? (Math.floor(rng() * 2) as 0 | 1) : (Math.floor(rng() * 3) as 0 | 1 | 2));
    return { id: sceneId(b.type, b.source, n), type: b.type, variant, durMs: 0, inMs: 0, speed: 1, source: b.source, text: b.text || {}, edited: [] };
  });
  // reshuffles also swap the order of the middle beats a little, so takes feel different
  if (scenes.length > 3 && seed > 1) {
    const mid = scenes.slice(1, -1);
    for (let i = mid.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [mid[i], mid[j]] = [mid[j], mid[i]]; }
    for (let i = 1; i < mid.length; i++) if (mid[i].type === mid[i - 1].type && i + 1 < mid.length) [mid[i], mid[i + 1]] = [mid[i + 1], mid[i]];
    scenes.splice(1, mid.length, ...mid);
  }
  assignDurations(scenes, brief, lengthSec);
  return scenes;
}

function naturalMs(s: Scene, b: Brief, idx: number, n: number) {
  let txt = "";
  if (s.type === "shutter") txt = s.source[0] === "name" ? b.name + " " + b.oneLiner : b.oneLiner;
  else if (s.type === "kite" || s.type === "magazine") txt = s.source.map((r) => b.points.find((p) => "points." + p.id === r)?.text || "").join(" ");
  else if (s.type === "end") txt = [b.cta.text, b.cta.phone, b.cta.address, b.name].filter(Boolean).join(" ");
  else if (s.type === "phone") txt = b.oneLiner;
  else txt = s.source.join(" ");
  const floor = s.type === "magazine" ? 800 * s.source.length : s.type === "kite" ? 1800 : 1200;
  let ms = readMs(txt) + floor;
  if (idx === 0) ms = Math.max(ms, 1600);
  if (idx === n - 1) ms = Math.max(ms, 2500);
  return Math.max(1400, ms);
}

/** Scale to lengthSec, clamp, redistribute, round to 100 ms (3 whole frames at 30 fps); the sum is exact. */
export function assignDurations(scenes: Scene[], b: Brief, lengthSec: number) {
  const total = lengthSec * 1000, n = scenes.length;
  if (!n) return;
  const nat = scenes.map((s, i) => naturalMs(s, b, i, n));
  const sum = nat.reduce((a, x) => a + x, 0);
  const mins = scenes.map((_, i) => (i === n - 1 ? 2500 : i === 0 ? 1600 : 1400));
  let d = nat.map((x, i) => Math.min(6000, Math.max(mins[i], (x * total) / sum)));
  const cap = 12000;
  for (let pass = 0; pass < 8; pass++) {
    const rem = total - d.reduce((a, x) => a + x, 0);
    if (Math.abs(rem) < 1) break;
    const free = d.map((x, i) => (rem > 0 ? x < cap : x > Math.min(mins[i], total / n)));
    const base = d.reduce((a, x, i) => a + (free[i] ? x : 0), 0) || 1;
    d = d.map((x, i) => (free[i] ? Math.min(cap, Math.max(Math.min(mins[i], total / n), x + (rem * x) / base)) : x));
  }
  let units = d.map((x) => Math.max(14, Math.round(x / 100)));
  let diff = lengthSec * 10 - units.reduce((a, x) => a + x, 0);
  while (diff !== 0) {
    const order = units.map((u, i) => i).sort((a, c) => units[c] - units[a]);
    for (const i of order) {
      if (diff === 0) break;
      if (diff > 0 && units[i] < 120) { units[i]++; diff--; }
      else if (diff < 0 && units[i] > 14) { units[i]--; diff++; }
    }
    if (order.every((i) => (diff > 0 ? units[i] >= 120 : units[i] <= 14))) break;
  }
  scenes.forEach((s, i) => (s.durMs = units[i] * 100));
}

/** A new take keeps every hand edit: matched by first source key, edited fields copied back, user scenes kept in place. */
export function reconcile(oldScenes: Scene[], fresh: Scene[], keepLook = false): Scene[] {
  const used = new Set<string>();
  let out = fresh.map((s) => {
    const old = oldScenes.find((o) => !used.has(o.id) && !o.userAdded && o.source[0] === s.source[0] && o.type === s.type)
      || oldScenes.find((o) => !used.has(o.id) && !o.userAdded && o.source[0] === s.source[0]);
    if (!old) return s;
    used.add(old.id);
    const n: Scene = { ...s, id: old.id, edited: old.edited.slice(), text: { ...s.text }, lock: old.lock };
    if (keepLook) { n.variant = old.variant; if (old.style) n.style = old.style; }
    for (const k of old.edited) {
      if (k.startsWith("text.")) { const key = k.slice(5); if (old.text[key] !== undefined) n.text[key] = old.text[key]; }
      else if (k === "durMs") n.durMs = old.durMs;
      else if (k === "inMs") n.inMs = old.inMs;
      else if (k === "speed") n.speed = old.speed;
      else if (k === "variant") n.variant = old.variant;
      else if (k === "style") n.style = old.style;
      else if (k === "type") n.type = old.type;
    }
    if (old.text.em !== undefined) n.text.em = old.text.em;
    if (old.text.days !== undefined) n.text.days = old.text.days;
    return n;
  });
  if (keepLook) {
    // a brief edit keeps the storyboard order the user is looking at
    const idx = (id: string) => { const i = oldScenes.findIndex((o) => o.id === id); return i < 0 ? 1e6 : i; };
    const last = out[out.length - 1];
    out = out.slice(0, -1).sort((a, b) => idx(a.id) - idx(b.id)).concat(last ? [last] : []);
  }
  // order edits and user-added scenes return to their old relative positions
  oldScenes.forEach((o, idx) => {
    if (o.userAdded) out.splice(Math.min(idx, out.length), 0, o);
    else if (o.edited.includes("order")) {
      const at = out.findIndex((s) => s.id === o.id);
      if (at >= 0) { const [m] = out.splice(at, 1); out.splice(Math.min(idx, out.length), 0, m); }
    }
  });
  return out;
}
