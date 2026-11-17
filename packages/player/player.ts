// Vanilla share-page player. No React. Plays the video live from the inlined JSON doc.
import { frameAt, totalMs, coverTime } from "../renderer/frame";
import { migrate, type Doc } from "../renderer/core";
import { fontFiles } from "../renderer/styles";
import { dims } from "../renderer/layout";

const $ = (id: string) => document.getElementById(id)!;

async function loadFonts(doc: Doc) {
  const manifest = await fetch("/f/fonts.json").then((r) => r.json()).catch(() => ({}));
  const styles = new Set([doc.style, ...doc.scenes.map((s) => s.style).filter(Boolean)]);
  const fams = new Set<string>();
  styles.forEach((s) => fontFiles(s as Doc["style"]).forEach((f) => fams.add(f)));
  const loads: Promise<unknown>[] = [];
  fams.forEach((fam) => {
    for (const f of manifest[fam] || []) {
      const ff = new FontFace(fam, `url(/f/${f.file})`, { weight: f.weight, unicodeRange: f.unicodeRange });
      document.fonts.add(ff);
      loads.push(ff.load().catch(() => null));
    }
  });
  await Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, 3000))]);
}

function fmt(ms: number) {
  const s = ms / 1000;
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
}

async function main() {
  const raw = JSON.parse(($("doc") as HTMLScriptElement).textContent || "{}");
  const doc = migrate(raw.doc);
  const canRemix = !!raw.canRemix;
  const canvas = $("stage") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const [W, H] = dims(doc.aspect);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = () => {
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round((r.width * H / W) * dpr);
  };
  size();
  const assets: { logo?: HTMLImageElement } = {};
  if (doc.brief.logo?.hash) {
    const img = new Image(); img.src = "/api/logos/" + doc.brief.logo.hash;
    await img.decode().catch(() => null); assets.logo = img;
  }
  await loadFonts(doc);
  const total = totalMs(doc);
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches || (() => { try { return localStorage.getItem("dh.calm") === "1"; } catch { return false; } })();
  let t = coverTime(doc), playing = false, last = 0;
  const btn = $("pp") as HTMLButtonElement;
  const bar = $("scrub") as HTMLInputElement;
  const tc = $("tc");
  const endEl = $("endtag");
  bar.max = String(total);
  const draw = () => {
    frameAt(ctx, doc, t, { width: canvas.width, height: canvas.height, assets });
    bar.value = String(t);
    bar.setAttribute("aria-valuetext", `${fmt(t)} of ${fmt(total)}`);
    tc.textContent = `${fmt(t)} / ${fmt(total)}`;
    const atEnd = t >= total - doc.scenes[doc.scenes.length - 1].durMs * 0.5;
    endEl.toggleAttribute("hidden", !atEnd);
    ($("remix") as HTMLElement).toggleAttribute("hidden", !(atEnd && canRemix));
  };
  const loop = (now: number) => {
    if (!playing) return;
    t += now - last; last = now;
    if (t >= total) { t = total - 1; playing = false; btn.textContent = "Phir se"; btn.setAttribute("aria-label", "Replay"); }
    draw();
    if (playing) requestAnimationFrame(loop);
  };
  const play = () => {
    if (t >= total - 1) t = 0;
    playing = true; last = performance.now(); btn.textContent = "Roko"; btn.setAttribute("aria-label", "Pause");
    requestAnimationFrame(loop);
  };
  const pause = () => { playing = false; btn.textContent = "Chalao"; btn.setAttribute("aria-label", "Play"); };
  btn.onclick = () => (playing ? pause() : play());
  bar.oninput = () => { t = Number(bar.value); pause(); draw(); };
  canvas.onclick = () => (playing ? pause() : play());
  window.addEventListener("resize", () => { size(); draw(); });
  ($("remix") as HTMLButtonElement).onclick = async () => {
    const r = await fetch(`/api/v/${raw.id}/remix`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.id) location.href = `/studio/${j.id}?at=parchi&remix=1`;
    else alert(j.message || "Thoda ruko, phir try karo");
  };
  const form = $("report") as HTMLFormElement;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const r = await fetch(`/api/v/${raw.id}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: fd.get("reason"), note: String(fd.get("note") || "") || undefined }) });
    $("rmsg").textContent = r.ok ? "Shukriya, dekh lenge." : r.status === 429 ? "Thoda ruko, phir try karo" : "Pehle hi report ho chuka hai";
  };
  document.body.classList.add("ready");
  draw();
  if (!calm) { t = 0; play(); }
}
main();
