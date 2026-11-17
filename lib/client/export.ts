"use client";
import type { Doc } from "@/packages/renderer/core";
import { frameAt, totalMs } from "@/packages/renderer/frame";

export type Preset = { id: "status" | "reel" | "square" | "wide"; label: string; w: number; h: number; cap?: number; bps: (durS: number) => number };
export const PRESETS: Preset[] = [
  { id: "status", label: "Status", w: 720, h: 1280, cap: 30, bps: (d) => Math.min(2_500_000, ((5_000_000 * 8) / d) * 0.92) },
  { id: "reel", label: "Reel", w: 1080, h: 1920, bps: () => 6_000_000 },
  { id: "square", label: "Square", w: 1080, h: 1080, bps: () => 5_000_000 },
  { id: "wide", label: "Wide", w: 1920, h: 1080, bps: () => 6_000_000 },
];

export type Probe = { kind: "mp4" | "webm" | "none"; mime: string; message: string; webcodecs: boolean };
/** Says which format this browser will produce, before the render starts. */
export async function probeFormat(): Promise<Probe> {
  let webcodecs = false;
  try {
    const VE = (window as any).VideoEncoder;
    if (VE) {
      const a = await VE.isConfigSupported({ codec: "avc1.42E01F", width: 720, height: 1280, bitrate: 2_000_000, framerate: 30 });
      webcodecs = !!a?.supported;
    }
  } catch { /* not supported */ }
  const MR = (window as any).MediaRecorder;
  const mp4 = ["video/mp4;codecs=avc1.42E01F", "video/mp4;codecs=avc1", "video/mp4"].find((m) => MR?.isTypeSupported?.(m));
  if (mp4) return { kind: "mp4", mime: mp4, webcodecs, message: "Is phone pe MP4 banega" };
  const webm = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) => MR?.isTypeSupported?.(m));
  if (webm) return { kind: "webm", mime: webm, webcodecs, message: "Is browser pe WebM banega. WhatsApp Status ke liye Chrome mein kholo" };
  return { kind: "none", mime: "", webcodecs, message: "Is browser pe export nahi hoga. Link bhejo." };
}

/**
 * Renders in real time through canvas.captureStream + MediaRecorder. Silent: the stream has no audio track.
 * Each drawn frame is the pure frameAt(doc, t) for the elapsed time.
 */
export async function renderVideo(doc: Doc, preset: Preset, probe: Probe, opts: {
  signal: AbortSignal; onProgress: (done: number, total: number, etaS: number) => void; assets: { logo?: CanvasImageSource | null }; maxMs?: number;
}): Promise<File> {
  const dur = Math.min(totalMs(doc), opts.maxMs ?? Infinity);
  const [w, h] = doc.aspect === "9:16" ? [preset.w, preset.h] : doc.aspect === "1:1" ? [Math.min(preset.w, preset.h), Math.min(preset.w, preset.h)] : [Math.max(preset.w, preset.h), Math.min(preset.w, preset.h)];
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  frameAt(ctx, doc, 0, { width: w, height: h, assets: opts.assets });
  const stream = canvas.captureStream(30);
  if (stream.getAudioTracks().length !== 0) throw new Error("audio track present");
  const rec = new MediaRecorder(stream, { mimeType: probe.mime, videoBitsPerSecond: Math.round(preset.bps(dur / 1000)) });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const totalFrames = Math.round((dur / 1000) * 30);
  return await new Promise<File>((resolve, reject) => {
    let raf = 0, t0 = 0, aborted = false;
    const stop = () => { cancelAnimationFrame(raf); if (rec.state !== "inactive") rec.stop(); stream.getTracks().forEach((t) => t.stop()); };
    opts.signal.addEventListener("abort", () => { aborted = true; stop(); reject(new DOMException("cancelled", "AbortError")); });
    rec.onstop = () => {
      if (aborted) return;
      const ext = probe.kind === "mp4" ? "mp4" : "webm";
      const name = (doc.brief.name || "dhindhora").replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 30) + "." + ext;
      resolve(new File(chunks, name, { type: probe.kind === "mp4" ? "video/mp4" : "video/webm" }));
    };
    rec.start(500);
    const tick = (now: number) => {
      if (!t0) t0 = now;
      const t = now - t0;
      frameAt(ctx, doc, Math.min(t, dur - 1), { width: w, height: h, assets: opts.assets });
      const done = Math.min(totalFrames, Math.round((t / 1000) * 30));
      opts.onProgress(done, totalFrames, Math.max(0, (dur - t) / 1000));
      if (t >= dur) { stop(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
}

export async function handOff(file: File) {
  const nav = navigator as any;
  if (nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title: file.name }); return "shared"; } catch { /* user closed the sheet */ }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file); a.download = file.name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return "downloaded";
}
