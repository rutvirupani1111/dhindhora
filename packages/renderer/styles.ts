import type { Brief, StyleId } from "./core";
import { ensureContrast, isHex } from "./core";

export type Transition = "hinge" | "halftone-burn" | "shutter" | "paper-fold" | "bulb-flicker";
export type Style = {
  id: StyleId; label: string; labelHi: string;
  ground: string; ink: string; accents: string[]; panel: string;
  fonts: { display: string; displayWeight: number; deva: string; devaWeight: number; body: string };
  texture: "enamel" | "halftone" | "chips" | "columns" | "brick";
  border: "lotus" | "drop" | "rule" | "column" | "tube";
  transition: Transition;
};

export const STYLES: Record<StyleId, Style> = {
  truck: {
    id: "truck", label: "Truck Art", labelHi: "Truck art",
    ground: "#0F5E3A", ink: "#F6E9D2", accents: ["#D7261E", "#F07F13", "#F2B705"], panel: "#0A4329",
    fonts: { display: "Yatra One", displayWeight: 400, deva: "Yatra One", devaWeight: 400, body: "Baloo 2" },
    texture: "enamel", border: "lotus", transition: "hinge",
  },
  cinema: {
    id: "cinema", label: "Cinema Poster", labelHi: "Cinema poster",
    ground: "#F2E3C6", ink: "#1B1A17", accents: ["#D7261E", "#00707A", "#1B1A17"], panel: "#E6D2AC",
    fonts: { display: "Teko", displayWeight: 600, deva: "Rozha One", devaWeight: 400, body: "Hind" },
    texture: "halftone", border: "drop", transition: "halftone-burn",
  },
  kirana: {
    id: "kirana", label: "Kirana Board", labelHi: "Kirana board",
    ground: "#1F6B3A", ink: "#FFF3C4", accents: ["#F2B705", "#D7261E", "#FFF3C4"], panel: "#185630",
    fonts: { display: "Rubik Mono One", displayWeight: 400, deva: "Hind", devaWeight: 700, body: "Baloo 2" },
    texture: "chips", border: "rule", transition: "shutter",
  },
  akhbaar: {
    id: "akhbaar", label: "Akhbaar", labelHi: "Akhbaar",
    ground: "#EDE6D6", ink: "#141414", accents: ["#C8102E", "#141414", "#5A5348"], panel: "#E2D9C4",
    fonts: { display: "Alfa Slab One", displayWeight: 400, deva: "Rozha One", devaWeight: 400, body: "Hind" },
    texture: "columns", border: "column", transition: "paper-fold",
  },
  neon: {
    id: "neon", label: "Neon Chowk", labelHi: "Neon chowk",
    ground: "#2B1E2F", ink: "#F6E9D2", accents: ["#FF4FA3", "#3FE0D0", "#F2B705"], panel: "#3A2A3F",
    fonts: { display: "Monoton", displayWeight: 400, deva: "Baloo 2", devaWeight: 700, body: "Baloo 2" },
    texture: "brick", border: "tube", transition: "bulb-flicker",
  },
};

export type Palette = { ground: string; ink: string; panel: string; a: string[]; s: Style };
const pCache = new Map<string, Palette>();
/** Brand pins replace the style's accents in order; ground and secondary palette stay the style's own. */
export function palette(styleId: StyleId, brief: Pick<Brief, "colors">): Palette {
  const key = styleId + (brief.colors || []).join("");
  const hit = pCache.get(key); if (hit) return hit;
  const s = STYLES[styleId];
  const a = s.accents.slice();
  (brief.colors || []).slice(0, 3).forEach((c, i) => { if (isHex(c)) a[i] = c; });
  const p = { ground: s.ground, ink: ensureContrast(s.ink, s.ground), panel: s.panel, a, s };
  pCache.set(key, p);
  return p;
}
/** Text colour for a fill, auto-corrected to WCAG AA (3:1 for 48 px and up). */
export function textOn(fg: string, bg: string, px: number) { return ensureContrast(fg, bg, px >= 48); }

export function fontFiles(styleId: StyleId): string[] {
  const f = STYLES[styleId].fonts;
  return Array.from(new Set([f.display, f.deva, f.body, "Baloo 2", "Rozha One"]));
}
