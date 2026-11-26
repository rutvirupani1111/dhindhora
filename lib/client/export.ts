"use client";
import type { Doc } from "@/packages/renderer/core";
import { frameAt, totalMs } from "@/packages/renderer/frame";

export type Preset = { id: "status" | "reel" | "square" | "wide"; label: string; use: string; useEn: string; w: number; h: number; cap?: number; bps: (durS: number) => number };
export const PRESETS: Preset[] = [
  { id: "status", label: "Status", use: "WhatsApp, 720p", useEn: "WhatsApp, 720p", w: 720, h: 1280, cap: 30, bps: (d) => Math.min(2_500_000, ((5_000_000 * 8) / d) * 0.92) },
  { id: "reel", label: "Reel", use: "Insta, Shorts", useEn: "Insta, Shorts", w: 1080, h: 1920, bps: () => 6_000_000 },
  { id: "square", label: "Square", use: "Post", useEn: "Feed post", w: 1080, h: 1080, bps: () => 5_000_000 },
  { id: "wide", label: "Wide", use: "YouTube", useEn: "YouTube", w: 1920, h: 1080, bps: () => 6_000_000 },
];

/** webcodecs: the codec the fast frame-exact path will use; mime: the MediaRecorder fallback's type. */
export type Probe = { kind: "mp4" | "webm" | "none"; mime: string; message: string; webcodecs: "avc" | "vp9" | null };

async function supports(codec: string, width: number, height: number) {
  try {
    const VE = (window as any).VideoEncoder;
    if (!VE?.isConfigSupported) return false;
    // a probe that never answers must not leave the press waiting: give up after 3 s and try the next path
    const r = await Promise.race([VE.isConfigSupported({ codec, width, height, bitrate: 2_000_000, framerate: 30 }), new Promise((ok) => setTimeout(() => ok(null), 3000))]) as { supported?: boolean } | null;
    return !!r?.supported;
  } catch { return false; }
}

/** Says which format this browser will produce, before the render starts. Asked once per page and kept:
 *  the studio starts asking while the person edits, so the press already knows when they arrive. */
let probed: Promise<Probe> | null = null;
export function probeFormat(): Promise<Probe> { return (probed ||= askFormat()); }
async function askFormat(): Promise<Probe> {
  const avc = (await supports("avc1.42E01F", 720, 1280)) || (await supports("avc1.640028", 1080, 1920));
  const vp9 = !avc && (await supports("vp09.00.10.08", 720, 1280));
  const MR = (window as any).MediaRecorder;
  const mp4 = ["video/mp4;codecs=avc1.42E01F", "video/mp4;codecs=avc1", "video/mp4"].find((m) => MR?.isTypeSupported?.(m)) || "";
  const webm = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) => MR?.isTypeSupported?.(m)) || "";
  const webcodecs = avc ? "avc" : vp9 ? "vp9" : null;
  if (avc || mp4) return { kind: "mp4", mime: mp4 || webm, webcodecs, message: "Is phone pe MP4 banega" };
  if (vp9 || webm) return { kind: "webm", mime: webm, webcodecs, message: "Is browser pe WebM banega. WhatsApp Status ke liye Chrome mein kholo" };
  return { kind: "none", mime: "", webcodecs: null, message: "Is browser pe export nahi hoga. Link bhejo." };
}

type Opts = { signal: AbortSignal; onProgress: (done: number, total: number, etaS: number) => void; assets: { logo?: CanvasImageSource | null }; maxMs?: number };

function outSize(doc: Doc, preset: Preset) {
  return doc.aspect === "9:16" ? [preset.w, preset.h] : doc.aspect === "1:1" ? [Math.min(preset.w, preset.h), Math.min(preset.w, preset.h)] : [Math.max(preset.w, preset.h), Math.min(preset.w, preset.h)];
}
function fileName(doc: Doc, ext: string) {
  return (doc.brief.name || "dhindhora").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 30) + "." + ext;
}
const abortErr = () => new DOMException("cancelled", "AbortError");

/**
 * Renders the video. Fast path: WebCodecs encodes frame i at exactly t = i / 30 and Mediabunny muxes MP4 (or WebM),
 * faster than real time. Fallback: canvas.captureStream + MediaRecorder in real time. Silent either way: no audio track.
 */
export async function renderVideo(doc: Doc, preset: Preset, probe: Probe, opts: Opts): Promise<File> {
  if (probe.webcodecs) {
    try { return await renderFast(doc, preset, probe.webcodecs, opts); } catch (e) {
      if ((e as Error).name === "AbortError" || !probe.mime) throw e;
      // encoder refused this size or codec: fall through to the real-time recorder
    }
  }
  return renderRealtime(doc, preset, probe, opts);
}

async function renderFast(doc: Doc, preset: Preset, codec: "avc" | "vp9", opts: Opts): Promise<File> {
  const mb = await import("mediabunny");
  const dur = Math.min(totalMs(doc), opts.maxMs ?? Infinity);
  const [w, h] = outSize(doc, preset);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const format = codec === "avc" ? new mb.Mp4OutputFormat({ fastStart: "in-memory" }) : new mb.WebMOutputFormat();
  const target = new mb.BufferTarget();
  const output = new mb.Output({ format, target });
  const source = new mb.CanvasSource(canvas, { codec, bitrate: Math.round(preset.bps(dur / 1000)), keyFrameInterval: 2 });
  output.addVideoTrack(source, { frameRate: 30 });
  await output.start();
  const totalFrames = Math.max(1, Math.round((dur / 1000) * 30));
  const t0 = performance.now();
  try {
    for (let i = 0; i < totalFrames; i++) {
      if (opts.signal.aborted) throw abortErr();
      frameAt(ctx, doc, Math.min((i * 1000) / 30, dur - 1), { width: w, height: h, assets: opts.assets });
      await source.add(i / 30, 1 / 30);
      if (i % 4 === 3 || i === totalFrames - 1) {
        const per = (performance.now() - t0) / (i + 1);
        opts.onProgress(i + 1, totalFrames, ((totalFrames - i - 1) * per) / 1000);
        await new Promise((r) => setTimeout(r, 0)); // yield every 4 frames so the page stays responsive
      }
    }
    await output.finalize();
  } catch (e) {
    await output.cancel().catch(() => undefined);
    throw e;
  }
  if (!target.buffer) throw new Error("empty output");
  return new File([target.buffer], fileName(doc, codec === "avc" ? "mp4" : "webm"), { type: codec === "avc" ? "video/mp4" : "video/webm" });
}

/** Real-time fallback: each drawn frame is the pure frameAt(doc, t) for the elapsed time. */
function renderRealtime(doc: Doc, preset: Preset, probe: Probe, opts: Opts): Promise<File> {
  const dur = Math.min(totalMs(doc), opts.maxMs ?? Infinity);
  const [w, h] = outSize(doc, preset);
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
  const isMp4 = probe.mime.startsWith("video/mp4");
  return new Promise<File>((resolve, reject) => {
    let raf = 0, t0 = 0, aborted = false;
    const stop = () => { cancelAnimationFrame(raf); if (rec.state !== "inactive") rec.stop(); stream.getTracks().forEach((t) => t.stop()); };
    opts.signal.addEventListener("abort", () => { aborted = true; stop(); reject(abortErr()); });
    rec.onstop = () => {
      if (aborted) return;
      resolve(new File(chunks, fileName(doc, isMp4 ? "mp4" : "webm"), { type: isMp4 ? "video/mp4" : "video/webm" }));
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
