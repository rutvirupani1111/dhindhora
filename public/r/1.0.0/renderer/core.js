export const RENDERER_VERSION = "1.0.0";
export const FPS = 30;
export const FRAME_MS = 1000 / FPS;
export const STYLE_ORDER = ["truck", "cinema", "kirana", "akhbaar", "neon"];
export const SCENE_LABEL = {
    shutter: { hi: "Shutter pe likha", en: "Shutter Type" },
    meter: { hi: "Meter", en: "Meter Counter" },
    kite: { hi: "Patang", en: "Kite Cards" },
    magazine: { hi: "Patrika", en: "Magazine Stack" },
    phone: { hi: "Phone", en: "Phone in Hand" },
    ladoo: { hi: "Ladoo chart", en: "Ladoo Chart" },
    seal: { hi: "Mohar", en: "Seal Reveal" },
    price: { hi: "Daam kata", en: "Price Slash" },
    countdown: { hi: "Bas itne din", en: "Countdown" },
    end: { hi: "Aakhri board", en: "Hoarding End Card" },
};
export const VARIANTS = {
    shutter: ["rib-roll", "slam", "stencil-wipe"],
    meter: ["odometer", "taxi-meter", "board"],
    kite: ["swoop", "tug", "line-up"],
    magazine: ["deal", "fan", "flip"],
    phone: ["tilt", "scroll-feed", "tap"],
    ladoo: ["bars", "row", "stacked"],
    seal: ["stamp", "unfold", "bulbs"],
    price: ["brush", "stamp", "tag-flip"],
    countdown: ["flip-board", "calendar", "ticket"],
    end: ["lit", "painted", "enamel"],
};
export function fnv1a(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}
export function mulberry32(a) {
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
export function canonicalJSON(v) {
    if (Array.isArray(v))
        return "[" + v.map(canonicalJSON).join(",") + "]";
    if (v && typeof v === "object") {
        const o = v;
        return "{" + Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => JSON.stringify(k) + ":" + canonicalJSON(o[k])).join(",") + "}";
    }
    return JSON.stringify(v);
}
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const backOut = (t) => { t = clamp(t); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
export const springOut = (t) => { t = clamp(t); return 1 - Math.exp(-6 * t) * Math.cos(9 * t); };
export const prog = (t, start, dur) => clamp((t - start) / dur);
export function hexToRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map((x) => Math.round(clamp(x, 0, 255)).toString(16).padStart(2, "0")).join("");
}
function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function delin(c) { return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055); }
export function luminance(h) { const [r, g, b] = hexToRgb(h); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); }
export function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
function toOklch(h) {
    const [r, g, b] = hexToRgb(h).map(lin);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    return [L, Math.hypot(A, B), Math.atan2(B, A)];
}
function fromOklch(L, C, H) {
    const A = C * Math.cos(H), B = C * Math.sin(H);
    const l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * B, 3);
    const m = Math.pow(L - 0.1055613458 * A - 0.0638541728 * B, 3);
    const s = Math.pow(L - 0.0894841775 * A - 1.291485548 * B, 3);
    return rgbToHex(delin(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), delin(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), delin(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s));
}
const cCache = new Map();
export function ensureContrast(fg, bg, largeText = false) {
    const key = fg + bg + (largeText ? 1 : 0);
    const hit = cCache.get(key);
    if (hit)
        return hit;
    const need = largeText ? 3 : 4.5;
    let out = fg;
    if (contrast(fg, bg) < need) {
        const [L0, C, H] = toOklch(fg);
        const dir = luminance(bg) > 0.18 ? -1 : 1;
        let L = L0, c = C;
        for (let i = 0; i < 30 && contrast(out, bg) < need; i++) {
            L = clamp(L + dir * 0.04, 0, 1);
            c *= 0.92;
            out = fromOklch(L, c, H);
        }
        if (contrast(out, bg) < need)
            out = dir < 0 ? "#000000" : "#ffffff";
    }
    cCache.set(key, out);
    return out;
}
export const isHex = (s) => /^#[0-9a-fA-F]{6}$/.test(s);
export const hasDeva = (s) => /[ऀ-ॿ]/.test(s);
const migrations = {};
export function migrate(raw) {
    let d = raw;
    while (d && d.schema !== 1 && migrations[d.schema])
        d = migrations[d.schema](d);
    if (!d || d.schema !== 1)
        throw new Error("Unknown doc schema");
    return d;
}
export function nanoid(n = 8) {
    const a = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const b = new Uint8Array(n);
    crypto.getRandomValues(b);
    let s = "";
    for (let i = 0; i < n; i++)
        s += a[b[i] % 62];
    return s;
}
export function formatNumber(n, v = n.value) {
    const pre = n.prefix === "Rs" ? "Rs " : n.prefix;
    const shown = n.value % 1 ? v.toFixed(1) : Math.round(v).toLocaleString("en-IN");
    return pre + shown + n.suffix;
}
export function graphemesSafe(text) {
    const Sg = Intl.Segmenter;
    if (Sg)
        return Array.from(new Sg(undefined, { granularity: "grapheme" }).segment(text)).map((x) => x.segment);
    return Array.from(text);
}
