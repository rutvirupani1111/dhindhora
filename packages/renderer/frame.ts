import type { Doc, Scene, StyleId } from "./core";
import { easeInOut, fnv1a, mulberry32, clamp } from "./core";
import { dims, layoutScene, safeArea, type Measure } from "./layout";
import { SCENES, background, border, type Assets, type Ctx, type R } from "./scenes";
import { palette, STYLES } from "./styles";
import { RENDERER_VERSION } from "./core";

export const TRANSITION_MS = 400;

export function totalMs(doc: Doc) { return doc.scenes.reduce((a, s) => a + s.durMs, 0); }
export function starts(doc: Doc) {
  const out: number[] = []; let acc = 0;
  for (const s of doc.scenes) { out.push(acc); acc += s.durMs; }
  return out;
}
export function sceneIndexAt(doc: Doc, t: number) {
  const st = starts(doc);
  for (let i = st.length - 1; i >= 0; i--) if (t >= st[i]) return i;
  return 0;
}

export type FrameOpts = { width: number; height: number; detail?: 0 | 1 | 2; assets?: Assets; styleOverride?: StyleId; measure?: Measure };

/** Draws one scene at its own local time into a canvas already scaled to logical units. */
export function drawSceneLocal(ctx: Ctx, doc: Doc, scene: Scene, localMs: number, o: { detail: 0 | 1 | 2; assets: Assets; styleOverride?: StyleId; measure?: Measure }) {
  const [W, H] = dims(doc.aspect);
  const st = o.styleOverride || scene.style || doc.style;
  let lock = scene.lock;
  if (!lock || lock.rv !== RENDERER_VERSION || lock.style !== st || lock.aspect !== doc.aspect) {
    lock = layoutScene({ ...scene, style: st }, doc, o.measure, 0);
  }
  const R: R = {
    ctx, W, H, S: safeArea(doc.aspect), p: palette(st, doc.brief), scene, brief: doc.brief, lock,
    t: scene.inMs + Math.max(0, localMs) * scene.speed, dur: scene.durMs * scene.speed,
    detail: o.detail, assets: o.assets, rng: mulberry32(fnv1a(scene.id) ^ doc.seed), seed: doc.seed,
  };
  ctx.save();
  background(R);
  SCENES[scene.type](R);
  border(R);
  ctx.restore();
}

/** frameAt(doc, t): the whole video is a pure function of time. */
export function frameAt(ctx: Ctx, doc: Doc, t: number, o: FrameOpts) {
  const [W, H] = dims(doc.aspect);
  const detail = o.detail ?? 2;
  const assets = o.assets || {};
  ctx.save();
  ctx.setTransform(o.width / W, 0, 0, o.height / H, 0, 0);
  if (!doc.scenes.length) {
    ctx.fillStyle = STYLES[doc.style].ground; ctx.fillRect(0, 0, W, H); ctx.restore(); return;
  }
  const total = totalMs(doc);
  t = clamp(t, 0, Math.max(0, total - 1));
  const st = starts(doc);
  const i = sceneIndexAt(doc, t);
  const s = doc.scenes[i];
  const local = (k: number) => t - st[k] + (k > 0 ? TRANSITION_MS : 0);
  const sub = { detail, assets, styleOverride: o.styleOverride, measure: o.measure };
  drawSceneLocal(ctx, doc, s, local(i), sub);
  const end = st[i] + s.durMs;
  const next = doc.scenes[i + 1];
  if (next && t > end - TRANSITION_MS) {
    const p = easeInOut((t - (end - TRANSITION_MS)) / TRANSITION_MS);
    const tr = STYLES[o.styleOverride || s.style || doc.style].transition;
    const drawNext = () => drawSceneLocal(ctx, doc, next, t - (end - TRANSITION_MS), sub);
    ctx.save();
    switch (tr) {
      case "hinge":
        ctx.transform(Math.max(0.001, p), 0, 0, 1, 0, 0); drawNext(); break;
      case "halftone-burn": {
        ctx.beginPath();
        const step = 90, r = p * step * 0.75;
        for (let y = 0; y < H + step; y += step) for (let x = 0; x < W + step; x += step) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); }
        ctx.clip(); drawNext(); break;
      }
      case "shutter":
        ctx.beginPath(); ctx.rect(0, 0, W, H * p); ctx.clip(); drawNext();
        ctx.restore(); ctx.save();
        ctx.fillStyle = "#8C8A85"; ctx.fillRect(0, H * p - 30, W, 30); ctx.fillStyle = "#77756f"; ctx.fillRect(0, H * p - 8, W, 8);
        break;
      case "paper-fold":
        ctx.beginPath(); ctx.rect(W * (1 - p), 0, W * p, H); ctx.clip(); drawNext();
        ctx.restore(); ctx.save();
        ctx.fillStyle = "rgba(20,20,20,.25)"; ctx.fillRect(W * (1 - p) - 14, 0, 14, H);
        break;
      case "bulb-flicker":
        // exactly one flash per transition: never more than 3 a second (photosensitivity)
        if (p >= 0.5) drawNext();
        if (p > 0.42 && p < 0.58) { ctx.fillStyle = "rgba(242,183,5,.55)"; ctx.fillRect(0, 0, W, H); }
        break;
    }
    ctx.restore();
  }
  ctx.restore();
}

/** The first frame where the hook's text is fully on screen: the project's cover. */
export function coverTime(doc: Doc) {
  const s = doc.scenes[0];
  if (!s) return 0;
  return Math.min(s.durMs - 50, 1500);
}

/** Text boxes of the scene at time t for hit testing (scenes settle into their locked boxes). */
export function boxesAt(doc: Doc, t: number) {
  const i = sceneIndexAt(doc, t);
  const s = doc.scenes[i];
  const out: { key: string; box: [number, number, number, number]; sceneIndex: number }[] = [];
  if (!s?.lock) return out;
  for (const [key, b] of Object.entries(s.lock.blocks)) out.push({ key, box: b.box, sceneIndex: i });
  return out;
}
