import { easeInOut, fnv1a, mulberry32, clamp } from "./core.js";
import { dims, layoutScene, safeArea } from "./layout.js";
import { SCENES, background, border } from "./scenes.js";
import { palette, STYLES } from "./styles.js";
import { RENDERER_VERSION } from "./core.js";
export const TRANSITION_MS = 400;
export function totalMs(doc) { return doc.scenes.reduce((a, s) => a + s.durMs, 0); }
export function starts(doc) {
    const out = [];
    let acc = 0;
    for (const s of doc.scenes) {
        out.push(acc);
        acc += s.durMs;
    }
    return out;
}
export function sceneIndexAt(doc, t) {
    const st = starts(doc);
    for (let i = st.length - 1; i >= 0; i--)
        if (t >= st[i])
            return i;
    return 0;
}
export function drawSceneLocal(ctx, doc, scene, localMs, o) {
    const [W, H] = dims(doc.aspect);
    const st = o.styleOverride || scene.style || doc.style;
    let lock = scene.lock;
    if (!lock || lock.rv !== RENDERER_VERSION || lock.style !== st || lock.aspect !== doc.aspect) {
        lock = layoutScene({ ...scene, style: st }, doc, o.measure, 0);
    }
    const R = {
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
export function frameAt(ctx, doc, t, o) {
    const [W, H] = dims(doc.aspect);
    const detail = o.detail ?? 2;
    const assets = o.assets || {};
    ctx.save();
    ctx.setTransform(o.width / W, 0, 0, o.height / H, 0, 0);
    if (!doc.scenes.length) {
        ctx.fillStyle = STYLES[doc.style].ground;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
        return;
    }
    const total = totalMs(doc);
    t = clamp(t, 0, Math.max(0, total - 1));
    const st = starts(doc);
    const i = sceneIndexAt(doc, t);
    const s = doc.scenes[i];
    const local = (k) => t - st[k] + (k > 0 ? TRANSITION_MS : 0);
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
                ctx.transform(Math.max(0.001, p), 0, 0, 1, 0, 0);
                drawNext();
                break;
            case "halftone-burn": {
                ctx.beginPath();
                const step = 90, r = p * step * 0.75;
                for (let y = 0; y < H + step; y += step)
                    for (let x = 0; x < W + step; x += step) {
                        ctx.moveTo(x + r, y);
                        ctx.arc(x, y, r, 0, Math.PI * 2);
                    }
                ctx.clip();
                drawNext();
                break;
            }
            case "shutter":
                ctx.beginPath();
                ctx.rect(0, 0, W, H * p);
                ctx.clip();
                drawNext();
                ctx.restore();
                ctx.save();
                ctx.fillStyle = "#8C8A85";
                ctx.fillRect(0, H * p - 30, W, 30);
                ctx.fillStyle = "#77756f";
                ctx.fillRect(0, H * p - 8, W, 8);
                break;
            case "paper-fold":
                ctx.beginPath();
                ctx.rect(W * (1 - p), 0, W * p, H);
                ctx.clip();
                drawNext();
                ctx.restore();
                ctx.save();
                ctx.fillStyle = "rgba(20,20,20,.25)";
                ctx.fillRect(W * (1 - p) - 14, 0, 14, H);
                break;
            case "bulb-flicker":
                if (p >= 0.5)
                    drawNext();
                if (p > 0.42 && p < 0.58) {
                    ctx.fillStyle = "rgba(242,183,5,.55)";
                    ctx.fillRect(0, 0, W, H);
                }
                break;
        }
        ctx.restore();
    }
    ctx.restore();
}
export function coverTime(doc) {
    const s = doc.scenes[0];
    if (!s)
        return 0;
    return Math.min(s.durMs - 50, 1500);
}
export function boxesAt(doc, t) {
    const i = sceneIndexAt(doc, t);
    const s = doc.scenes[i];
    const out = [];
    if (!s?.lock)
        return out;
    for (const [key, b] of Object.entries(s.lock.blocks))
        out.push({ key, box: b.box, sceneIndex: i });
    return out;
}
