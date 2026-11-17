import type { Aspect, Brief, Doc, LayoutLock, Scene, StyleId, TextBlock } from "./core";
import { RENDERER_VERSION, canonicalJSON, fnv1a, hasDeva } from "./core";
import { STYLES } from "./styles";

export function dims(a: Aspect): [number, number] {
  return a === "9:16" ? [1080, 1920] : a === "1:1" ? [1080, 1080] : [1920, 1080];
}
export type Rect = { x: number; y: number; w: number; h: number };
/** 9:16 keeps text out of the top 12% and bottom 18% (Reels/Shorts overlays); others use a 6% inset. */
export function safeArea(a: Aspect): Rect {
  const [W, H] = dims(a);
  if (a === "9:16") return { x: W * 0.07, y: H * 0.12, w: W * 0.86, h: H * 0.7 };
  return { x: W * 0.06, y: H * 0.06, w: W * 0.88, h: H * 0.88 };
}

export function pointById(b: Brief, ref: string) {
  const id = ref.split(".")[1];
  return b.points.find((p) => p.id === id)?.text ?? "";
}
export function numberById(b: Brief, ref: string) {
  const id = ref.split(".")[1];
  return b.numbers.find((n) => n.id === id);
}
export function sceneNumbers(scene: Scene, b: Brief) {
  return scene.source.filter((s) => s.startsWith("numbers.")).map((s) => numberById(b, s)).filter(Boolean) as Brief["numbers"];
}
export function scenePoints(scene: Scene, b: Brief) {
  return scene.source.filter((s) => s.startsWith("points.")).map((s) => pointById(b, s));
}

/** Text for a key: the hand override if set, else read live from the brief. */
export function textFor(scene: Scene, b: Brief, key: string): string {
  if (scene.text[key] !== undefined) return scene.text[key];
  const pts = scenePoints(scene, b);
  const nums = sceneNumbers(scene, b);
  switch (scene.type) {
    case "shutter": {
      const first = scene.source[0] || "name";
      if (key === "head") return first === "name" ? b.name : first === "oneLiner" ? b.oneLiner : pts[0] || b.name;
      if (key === "sub") return first === "name" ? b.oneLiner : b.name;
      return "";
    }
    case "kite": case "magazine": {
      const i = Number(key.slice(1)); return pts[i] ?? "";
    }
    case "meter": case "ladoo": {
      const i = Number(key.slice(3)); return nums[i]?.label ?? "";
    }
    case "phone":
      return key === "title" ? b.name : key === "line" ? b.oneLiner : key === "cta" ? b.cta.text : "";
    case "seal": return key === "name" ? b.name : key === "sub" ? b.oneLiner : "";
    case "price": return key === "tag" ? "Ab sirf" : key === "head" ? b.name : "";
    case "countdown": return key === "head" ? "Offer khatam hone mein" : key === "label" ? "din baaki" : "";
    case "end":
      return key === "cta" ? b.cta.text : key === "name" ? b.name : key === "phone" ? b.cta.phone || "" : key === "address" ? b.cta.address || "" : "";
  }
  return "";
}

export type BlockSpec = { key: string; box: [number, number, number, number]; maxPx: number; kind: "display" | "body"; align: "left" | "center" };

/** The text keys a scene draws and the box each must fit in, before fitting. */
export function blockSpecs(scene: Scene, b: Brief, aspect: Aspect): BlockSpec[] {
  const S = safeArea(aspect);
  const [W] = dims(aspect);
  const wide = aspect === "16:9";
  const big = W / 1080;
  const r = (x: number, y: number, w: number, h: number): [number, number, number, number] => [S.x + S.w * x, S.y + S.h * y, S.w * w, S.h * h];
  switch (scene.type) {
    case "shutter":
      return [
        { key: "head", box: wide ? r(0.05, 0.18, 0.9, 0.46) : r(0.02, 0.2, 0.96, 0.42), maxPx: 190 * big, kind: "display", align: "center" },
        { key: "sub", box: wide ? r(0.12, 0.68, 0.76, 0.18) : r(0.04, 0.68, 0.92, 0.2), maxPx: 64 * big, kind: "body", align: "center" },
      ];
    case "kite": {
      const n = Math.max(1, scenePoints(scene, b).length);
      return Array.from({ length: n }, (_, i) =>
        wide
          ? { key: "p" + i, box: r(0.03 + i * 0.33, 0.38, 0.27, 0.3), maxPx: 58, kind: "body" as const, align: "center" as const }
          : { key: "p" + i, box: r(0.18, 0.06 + i * 0.32, 0.64, 0.17), maxPx: 64 * big, kind: "body" as const, align: "center" as const });
    }
    case "magazine": {
      const n = Math.max(1, scenePoints(scene, b).length);
      return Array.from({ length: n }, (_, i) => ({ key: "p" + i, box: wide ? r(0.32, 0.36, 0.36, 0.34) : r(0.14, 0.4, 0.72, 0.3), maxPx: 78 * big, kind: "display" as const, align: "center" as const }));
    }
    case "meter": case "ladoo": {
      const n = Math.max(1, sceneNumbers(scene, b).length);
      if (scene.type === "meter" && n >= 3) {
        return Array.from({ length: n }, (_, i) => {
          const cx = i % 2, cy = Math.floor(i / 2);
          return { key: "lab" + i, box: r(0.03 + cx * 0.5, 0.33 + cy * 0.42, 0.44, 0.08), maxPx: 46 * big, kind: "body" as const, align: "center" as const };
        });
      }
      if (scene.type === "ladoo") {
        return Array.from({ length: n }, (_, i) => ({ key: "lab" + i, box: r(i / n + 0.01, 0.9, 1 / n - 0.02, 0.08), maxPx: 40 * big, kind: "body" as const, align: "center" as const }));
      }
      return Array.from({ length: n }, (_, i) => ({ key: "lab" + i, box: r(0.05, 0.36 + i * 0.4, 0.9, 0.08), maxPx: 56 * big, kind: "body" as const, align: "center" as const }));
    }
    case "phone":
      return [
        { key: "title", box: wide ? r(0.05, 0.2, 0.42, 0.3) : r(0.05, 0.0, 0.9, 0.14), maxPx: 110 * big, kind: "display", align: wide ? "left" : "center" },
        { key: "line", box: wide ? r(0.05, 0.54, 0.42, 0.26) : r(0.05, 0.86, 0.9, 0.12), maxPx: 54 * big, kind: "body", align: wide ? "left" : "center" },
      ];
    case "seal":
      return [{ key: "name", box: r(0.06, 0.74, 0.88, 0.16), maxPx: 110 * big, kind: "display", align: "center" }];
    case "price":
      return [
        { key: "head", box: r(0.05, 0.0, 0.9, 0.16), maxPx: 90 * big, kind: "display", align: "center" },
        { key: "tag", box: r(0.2, 0.5, 0.6, 0.08), maxPx: 54 * big, kind: "body", align: "center" },
      ];
    case "countdown":
      return [
        { key: "head", box: r(0.05, 0.04, 0.9, 0.2), maxPx: 96 * big, kind: "display", align: "center" },
        { key: "label", box: r(0.1, 0.74, 0.8, 0.1), maxPx: 70 * big, kind: "body", align: "center" },
      ];
    case "end":
      return [
        { key: "name", box: wide ? r(0.04, 0.08, 0.56, 0.2) : r(0.04, 0.02, 0.92, 0.13), maxPx: 96 * big, kind: "display", align: wide ? "left" : "center" },
        { key: "cta", box: wide ? r(0.04, 0.32, 0.56, 0.3) : r(0.04, 0.18, 0.92, 0.2), maxPx: 120 * big, kind: "display", align: wide ? "left" : "center" },
        { key: "phone", box: wide ? r(0.04, 0.68, 0.56, 0.1) : r(0.04, 0.42, 0.92, 0.07), maxPx: 64 * big, kind: "body", align: wide ? "left" : "center" },
        { key: "address", box: wide ? r(0.04, 0.8, 0.56, 0.14) : r(0.04, 0.5, 0.92, 0.1), maxPx: 44 * big, kind: "body", align: wide ? "left" : "center" },
      ];
  }
}

export type Measure = (font: string, text: string) => { w: number; asc: number; desc: number };
let mctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
export const defaultMeasure: Measure = (font, text) => {
  if (!mctx) {
    mctx = typeof OffscreenCanvas !== "undefined"
      ? (new OffscreenCanvas(8, 8).getContext("2d") as OffscreenCanvasRenderingContext2D)
      : (document.createElement("canvas").getContext("2d") as CanvasRenderingContext2D);
  }
  mctx!.font = font;
  const m = mctx!.measureText(text);
  return { w: m.width, asc: m.actualBoundingBoxAscent || 0, desc: m.actualBoundingBoxDescent || 0 };
};

export function fontString(px: number, family: string, weight: number) {
  return `${weight} ${Math.round(px)}px '${family}','Baloo 2',sans-serif`;
}
export function blockFont(styleId: StyleId, kind: "display" | "body", text: string) {
  const f = STYLES[styleId].fonts;
  if (kind === "display") return hasDeva(text) ? { family: f.deva, weight: f.devaWeight } : { family: f.display, weight: f.displayWeight };
  return { family: f.body, weight: 700 };
}

type Seg = { s: string; word: boolean };
function segWords(text: string, lang: string): Seg[] {
  const Sg = (Intl as any).Segmenter;
  if (Sg) return Array.from(new Sg(lang, { granularity: "word" }).segment(text) as Iterable<any>).map((x: any) => ({ s: x.segment, word: x.isWordLike !== false || !/^\s+$/.test(x.segment) }));
  return text.split(/(\s+)/).filter(Boolean).map((s) => ({ s, word: !/^\s+$/.test(s) }));
}
export function graphemes(text: string): string[] {
  const Sg = (Intl as any).Segmenter;
  if (Sg) return Array.from(new Sg(undefined, { granularity: "grapheme" }).segment(text) as Iterable<any>).map((x: any) => x.segment);
  return Array.from(text);
}

/** Greedy wrap at Intl.Segmenter word boundaries; a single over-long word breaks at grapheme clusters only. */
export function wrap(text: string, font: string, maxW: number, measure: Measure, lang = "hi"): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const seg of segWords(para, lang)) {
      const cand = line + seg.s;
      if (measure(font, cand.trimEnd()).w <= maxW || !line.trim()) {
        if (!line.trim() && measure(font, seg.s.trim()).w > maxW) {
          let chunk = line;
          for (const g of graphemes(seg.s)) {
            if (measure(font, chunk + g).w > maxW && chunk.trim()) { lines.push(chunk.trimEnd()); chunk = ""; }
            chunk += g;
          }
          line = chunk;
        } else line = cand;
      } else {
        lines.push(line.trimEnd());
        line = seg.s.trimStart();
        if (measure(font, line).w > maxW) {
          let chunk = "";
          for (const g of graphemes(line)) {
            if (measure(font, chunk + g).w > maxW && chunk) { lines.push(chunk); chunk = ""; }
            chunk += g;
          }
          line = chunk;
        }
      }
    }
    lines.push(line.trimEnd());
  }
  return lines.filter((l, i) => l.length || i === 0);
}

export const LINE_H = 1.18;
/** Shrinks from the style size to 60% in 2px steps until lines fit, then wraps. */
export function fitBlock(text: string, spec: BlockSpec, styleId: StyleId, measure: Measure): TextBlock {
  const { family, weight } = blockFont(styleId, spec.kind, text);
  const [, , w, h] = spec.box;
  const min = Math.floor(spec.maxPx * 0.6);
  let px = Math.floor(spec.maxPx), lines: string[] = [text];
  for (; px >= min; px -= 2) {
    const font = fontString(px, family, weight);
    lines = wrap(text, font, w, measure);
    const pad = hasDeva(text) ? 1.08 : 1;
    if (lines.length * px * LINE_H * pad <= h && lines.every((l) => measure(font, l).w <= w)) break;
  }
  if (px < min) { px = min; lines = wrap(text, fontString(px, family, weight), w, measure); }
  return { lines, px, family, weight, box: spec.box, align: spec.align };
}

export function lockSig(scene: Scene, doc: Pick<Doc, "brief" | "aspect" | "style">) {
  const st = scene.style || doc.style;
  const keys = blockSpecs(scene, doc.brief, doc.aspect).map((s) => textFor(scene, doc.brief, s.key));
  return String(fnv1a(canonicalJSON([scene.type, scene.variant, st, doc.aspect, keys, scene.source, doc.brief.offer?.endsOn || "", scene.type === "end" ? qrPayload(doc.brief) : ""])));
}

export function daysLeft(endsOn: string | undefined, nowMs: number) {
  if (!endsOn) return 0;
  const end = Date.parse(endsOn + "T23:59:59");
  return Math.max(0, Math.ceil((end - nowMs) / 86400000));
}

/** Freezes line breaks and font sizes into the scene. Runs in the studio at edit and save time. */
export type QrFn = (text: string) => { n: number; bits: string } | undefined;
let qrImpl: QrFn | undefined;
/** The studio injects a QR encoder; the matrix is frozen into the end card's lock so players need none. */
export function setQrEncoder(fn: QrFn) { qrImpl = fn; }
export function qrPayload(b: Brief) {
  if (b.cta.url && /^https?:\/\//.test(b.cta.url)) return b.cta.url;
  if (b.cta.phone) return "https://wa.me/" + b.cta.phone.replace(/[^0-9]/g, "");
  return "";
}

export function layoutScene(scene: Scene, doc: Pick<Doc, "brief" | "aspect" | "style">, measure: Measure = defaultMeasure, nowMs?: number): LayoutLock {
  const st = scene.style || doc.style;
  const blocks: Record<string, TextBlock> = {};
  for (const spec of blockSpecs(scene, doc.brief, doc.aspect)) {
    const t = textFor(scene, doc.brief, spec.key);
    if (t) blocks[spec.key] = fitBlock(t, spec, st, measure);
  }
  const lock: LayoutLock = { rv: RENDERER_VERSION, aspect: doc.aspect, style: st, blocks, sig: lockSig(scene, doc) };
  if (scene.type === "countdown") {
    const fresh = nowMs ? daysLeft(doc.brief.offer?.endsOn, nowMs) : undefined;
    lock.days = scene.text.days !== undefined ? Number(scene.text.days) : fresh ?? scene.lock?.days ?? 0;
  }
  if (scene.type === "end") {
    const payload = qrPayload(doc.brief);
    lock.qr = payload ? (qrImpl?.(payload) ?? scene.lock?.qr) : undefined;
  }
  return lock;
}

/** Re-lays out only scenes whose lock is stale; untouched scenes keep object identity. */
export function relayout(doc: Doc, measure: Measure = defaultMeasure, nowMs?: number): Doc {
  let changed = false;
  const scenes = doc.scenes.map((s) => {
    const sig = lockSig(s, doc);
    if (s.lock && s.lock.sig === sig && s.lock.rv === RENDERER_VERSION) return s;
    changed = true;
    return { ...s, lock: layoutScene(s, doc, measure, nowMs) };
  });
  return changed ? { ...doc, scenes } : doc;
}
