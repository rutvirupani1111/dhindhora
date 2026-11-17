import { RENDERER_VERSION, canonicalJSON, fnv1a, hasDeva } from "./core.js";
import { STYLES } from "./styles.js";
export function dims(a) {
    return a === "9:16" ? [1080, 1920] : a === "1:1" ? [1080, 1080] : [1920, 1080];
}
export function safeArea(a) {
    const [W, H] = dims(a);
    if (a === "9:16")
        return { x: W * 0.07, y: H * 0.12, w: W * 0.86, h: H * 0.7 };
    return { x: W * 0.06, y: H * 0.06, w: W * 0.88, h: H * 0.88 };
}
export function pointById(b, ref) {
    const id = ref.split(".")[1];
    return b.points.find((p) => p.id === id)?.text ?? "";
}
export function numberById(b, ref) {
    const id = ref.split(".")[1];
    return b.numbers.find((n) => n.id === id);
}
export function sceneNumbers(scene, b) {
    return scene.source.filter((s) => s.startsWith("numbers.")).map((s) => numberById(b, s)).filter(Boolean);
}
export function scenePoints(scene, b) {
    return scene.source.filter((s) => s.startsWith("points.")).map((s) => pointById(b, s));
}
export function textFor(scene, b, key) {
    if (scene.text[key] !== undefined)
        return scene.text[key];
    const pts = scenePoints(scene, b);
    const nums = sceneNumbers(scene, b);
    switch (scene.type) {
        case "shutter": {
            const first = scene.source[0] || "name";
            if (key === "head")
                return first === "name" ? b.name : first === "oneLiner" ? b.oneLiner : pts[0] || b.name;
            if (key === "sub")
                return first === "name" ? b.oneLiner : b.name;
            return "";
        }
        case "kite":
        case "magazine": {
            const i = Number(key.slice(1));
            return pts[i] ?? "";
        }
        case "meter":
        case "ladoo": {
            const i = Number(key.slice(3));
            return nums[i]?.label ?? "";
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
export function blockSpecs(scene, b, aspect) {
    const S = safeArea(aspect);
    const [W] = dims(aspect);
    const wide = aspect === "16:9";
    const big = W / 1080;
    const r = (x, y, w, h) => [S.x + S.w * x, S.y + S.h * y, S.w * w, S.h * h];
    switch (scene.type) {
        case "shutter":
            return [
                { key: "head", box: wide ? r(0.05, 0.18, 0.9, 0.46) : r(0.02, 0.2, 0.96, 0.42), maxPx: 190 * big, kind: "display", align: "center" },
                { key: "sub", box: wide ? r(0.12, 0.68, 0.76, 0.18) : r(0.04, 0.68, 0.92, 0.2), maxPx: 64 * big, kind: "body", align: "center" },
            ];
        case "kite": {
            const n = Math.max(1, scenePoints(scene, b).length);
            return Array.from({ length: n }, (_, i) => wide
                ? { key: "p" + i, box: r(0.03 + i * 0.33, 0.38, 0.27, 0.3), maxPx: 58, kind: "body", align: "center" }
                : { key: "p" + i, box: r(0.18, 0.06 + i * 0.32, 0.64, 0.17), maxPx: 64 * big, kind: "body", align: "center" });
        }
        case "magazine": {
            const n = Math.max(1, scenePoints(scene, b).length);
            return Array.from({ length: n }, (_, i) => ({ key: "p" + i, box: wide ? r(0.32, 0.36, 0.36, 0.34) : r(0.14, 0.4, 0.72, 0.3), maxPx: 78 * big, kind: "display", align: "center" }));
        }
        case "meter":
        case "ladoo": {
            const n = Math.max(1, sceneNumbers(scene, b).length);
            if (scene.type === "meter" && n >= 3) {
                return Array.from({ length: n }, (_, i) => {
                    const cx = i % 2, cy = Math.floor(i / 2);
                    return { key: "lab" + i, box: r(0.03 + cx * 0.5, 0.33 + cy * 0.42, 0.44, 0.08), maxPx: 46 * big, kind: "body", align: "center" };
                });
            }
            if (scene.type === "ladoo") {
                return Array.from({ length: n }, (_, i) => ({ key: "lab" + i, box: r(i / n + 0.01, 0.9, 1 / n - 0.02, 0.08), maxPx: 40 * big, kind: "body", align: "center" }));
            }
            return Array.from({ length: n }, (_, i) => ({ key: "lab" + i, box: r(0.05, 0.36 + i * 0.4, 0.9, 0.08), maxPx: 56 * big, kind: "body", align: "center" }));
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
let mctx = null;
export const defaultMeasure = (font, text) => {
    if (!mctx) {
        mctx = typeof OffscreenCanvas !== "undefined"
            ? new OffscreenCanvas(8, 8).getContext("2d")
            : document.createElement("canvas").getContext("2d");
    }
    mctx.font = font;
    const m = mctx.measureText(text);
    return { w: m.width, asc: m.actualBoundingBoxAscent || 0, desc: m.actualBoundingBoxDescent || 0 };
};
export function fontString(px, family, weight) {
    return `${weight} ${Math.round(px)}px '${family}','Baloo 2',sans-serif`;
}
export function blockFont(styleId, kind, text) {
    const f = STYLES[styleId].fonts;
    if (kind === "display")
        return hasDeva(text) ? { family: f.deva, weight: f.devaWeight } : { family: f.display, weight: f.displayWeight };
    return { family: f.body, weight: 700 };
}
function segWords(text, lang) {
    const Sg = Intl.Segmenter;
    if (Sg)
        return Array.from(new Sg(lang, { granularity: "word" }).segment(text)).map((x) => ({ s: x.segment, word: x.isWordLike !== false || !/^\s+$/.test(x.segment) }));
    return text.split(/(\s+)/).filter(Boolean).map((s) => ({ s, word: !/^\s+$/.test(s) }));
}
export function graphemes(text) {
    const Sg = Intl.Segmenter;
    if (Sg)
        return Array.from(new Sg(undefined, { granularity: "grapheme" }).segment(text)).map((x) => x.segment);
    return Array.from(text);
}
export function wrap(text, font, maxW, measure, lang = "hi") {
    const lines = [];
    for (const para of text.split("\n")) {
        let line = "";
        for (const seg of segWords(para, lang)) {
            const cand = line + seg.s;
            if (measure(font, cand.trimEnd()).w <= maxW || !line.trim()) {
                if (!line.trim() && measure(font, seg.s.trim()).w > maxW) {
                    let chunk = line;
                    for (const g of graphemes(seg.s)) {
                        if (measure(font, chunk + g).w > maxW && chunk.trim()) {
                            lines.push(chunk.trimEnd());
                            chunk = "";
                        }
                        chunk += g;
                    }
                    line = chunk;
                }
                else
                    line = cand;
            }
            else {
                lines.push(line.trimEnd());
                line = seg.s.trimStart();
                if (measure(font, line).w > maxW) {
                    let chunk = "";
                    for (const g of graphemes(line)) {
                        if (measure(font, chunk + g).w > maxW && chunk) {
                            lines.push(chunk);
                            chunk = "";
                        }
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
export function fitBlock(text, spec, styleId, measure) {
    const { family, weight } = blockFont(styleId, spec.kind, text);
    const [, , w, h] = spec.box;
    const min = Math.floor(spec.maxPx * 0.6);
    let px = Math.floor(spec.maxPx), lines = [text];
    for (; px >= min; px -= 2) {
        const font = fontString(px, family, weight);
        lines = wrap(text, font, w, measure);
        const pad = hasDeva(text) ? 1.08 : 1;
        if (lines.length * px * LINE_H * pad <= h && lines.every((l) => measure(font, l).w <= w))
            break;
    }
    if (px < min) {
        px = min;
        lines = wrap(text, fontString(px, family, weight), w, measure);
    }
    return { lines, px, family, weight, box: spec.box, align: spec.align };
}
export function lockSig(scene, doc) {
    const st = scene.style || doc.style;
    const keys = blockSpecs(scene, doc.brief, doc.aspect).map((s) => textFor(scene, doc.brief, s.key));
    return String(fnv1a(canonicalJSON([scene.type, scene.variant, st, doc.aspect, keys, scene.source, doc.brief.offer?.endsOn || "", scene.type === "end" ? qrPayload(doc.brief) : ""])));
}
export function daysLeft(endsOn, nowMs) {
    if (!endsOn)
        return 0;
    const end = Date.parse(endsOn + "T23:59:59");
    return Math.max(0, Math.ceil((end - nowMs) / 86400000));
}
let qrImpl;
export function setQrEncoder(fn) { qrImpl = fn; }
export function qrPayload(b) {
    if (b.cta.url && /^https?:\/\//.test(b.cta.url))
        return b.cta.url;
    if (b.cta.phone)
        return "https://wa.me/" + b.cta.phone.replace(/[^0-9]/g, "");
    return "";
}
export function layoutScene(scene, doc, measure = defaultMeasure, nowMs) {
    const st = scene.style || doc.style;
    const blocks = {};
    for (const spec of blockSpecs(scene, doc.brief, doc.aspect)) {
        const t = textFor(scene, doc.brief, spec.key);
        if (t)
            blocks[spec.key] = fitBlock(t, spec, st, measure);
    }
    const lock = { rv: RENDERER_VERSION, aspect: doc.aspect, style: st, blocks, sig: lockSig(scene, doc) };
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
export function relayout(doc, measure = defaultMeasure, nowMs) {
    let changed = false;
    const scenes = doc.scenes.map((s) => {
        const sig = lockSig(s, doc);
        if (s.lock && s.lock.sig === sig && s.lock.rv === RENDERER_VERSION)
            return s;
        changed = true;
        return { ...s, lock: layoutScene(s, doc, measure, nowMs) };
    });
    return changed ? { ...doc, scenes } : doc;
}
