"use client";
import { useEffect, useRef } from "react";
import type { Doc } from "@/packages/renderer/core";
import { frameAt, totalMs } from "@/packages/renderer/frame";
import { dims } from "@/packages/renderer/layout";
import { loadStyleFonts } from "@/lib/client/fonts";

const logoCache = new Map<string, HTMLImageElement>();
export function logoFor(doc: Doc | null): HTMLImageElement | null {
  const h = doc?.brief.logo?.hash; if (!h) return null;
  let img = logoCache.get(h);
  if (!img) { img = new Image(); img.src = "/api/logos/" + h; logoCache.set(h, img); }
  return img.complete && img.naturalWidth ? img : null;
}

/** A canvas that draws a doc at a fixed time, or plays it on a loop. */
export function DocCanvas({ doc, t = 0, playing = false, className, detail = 1, label, onDraw }: {
  doc: Doc; t?: number; playing?: boolean; className?: string; detail?: 0 | 1 | 2; label?: string; onDraw?: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [W, H] = dims(doc.aspect);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    let raf = 0, alive = true, start = 0;
    const draw = (time: number) => {
      const r = c.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round((r.width * H / W) * dpr));
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      frameAt(c.getContext("2d")!, doc, time, { width: w, height: h, detail, assets: { logo: logoFor(doc) } });
      onDraw?.();
    };
    loadStyleFonts(doc.style).then(() => {
      if (!alive) return;
      if (!playing) { draw(t); return; }
      const total = totalMs(doc) || 1;
      const loop = (now: number) => { if (!alive) return; if (!start) start = now; draw((now - start) % total); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
    });
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [doc, t, playing, W, H, detail, onDraw]);
  return <canvas ref={ref} className={className} style={{ aspectRatio: `${W}/${H}`, width: "100%", display: "block" }} role="img" aria-label={label || doc.brief.name} />;
}
