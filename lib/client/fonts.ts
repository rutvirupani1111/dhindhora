"use client";
import type { StyleId } from "@/packages/renderer/core";
import { fontFiles } from "@/packages/renderer/styles";

let manifest: Promise<Record<string, { file: string; weight: string; unicodeRange: string }[]>> | null = null;
const loaded = new Map<string, Promise<void>>();

/** Loads a style's video fonts (self-hosted OFL woff2) before any frame is drawn. */
export function loadStyleFonts(style: StyleId): Promise<void> {
  const hit = loaded.get(style); if (hit) return hit;
  manifest ??= fetch("/f/fonts.json").then((r) => r.json()).catch(() => ({}));
  const p = manifest.then(async (m) => {
    const loads: Promise<unknown>[] = [];
    for (const fam of fontFiles(style)) {
      for (const f of m[fam] || []) {
        const key = fam + f.file;
        if (loaded.has(key)) continue;
        const ff = new FontFace(fam, `url(/f/${f.file})`, { weight: f.weight, unicodeRange: f.unicodeRange });
        document.fonts.add(ff);
        const lp = ff.load().then(() => undefined).catch(() => undefined);
        loaded.set(key, lp); loads.push(lp);
      }
    }
    await Promise.all(loads);
  });
  loaded.set(style, p);
  return p;
}
export async function loadAllFonts() {
  await Promise.all((["truck", "cinema", "kirana", "akhbaar", "neon"] as StyleId[]).map(loadStyleFonts));
}
