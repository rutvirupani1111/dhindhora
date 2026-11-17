"use client";
// Logo pipeline, all in the browser. SVG is drawn through an <img> from a blob URL, so scripts never run; only the raster is kept.

export async function processLogo(file: File, removeBg: boolean): Promise<{ blob: Blob; w: number; h: number }> {
  if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) throw new Error("PNG, JPG, WebP ya SVG chuno");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const iw = img.naturalWidth || 512, ih = img.naturalHeight || 512;
    const k = Math.min(1, 512 / Math.max(iw, ih));
    const w = Math.max(1, Math.round(iw * k)), h = Math.max(1, Math.round(ih * k));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, w, h);
    if (removeBg) colourKey(ctx, w, h);
    for (let q = 0.9; q >= 0.2; q -= 0.1) {
      const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/webp", q));
      if (blob && blob.type === "image/webp" && blob.size <= 64 * 1024) return { blob, w, h };
    }
    throw new Error("Logo bahut bhaari hai");
  } finally { URL.revokeObjectURL(url); }
}

/** Flood from the four corners, clearing pixels within delta E 12 of the corner colour. */
function colourKey(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const d = ctx.getImageData(0, 0, w, h); const px = d.data;
  const seen = new Uint8Array(w * h);
  const lab = (i: number) => { const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255; return [r * 100, g * 100, b * 100]; };
  for (const [sx, sy] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) {
    const ref = lab((sy * w + sx) * 4);
    const stack = [sy * w + sx];
    while (stack.length) {
      const p = stack.pop()!; if (seen[p]) continue; seen[p] = 1;
      const c = lab(p * 4);
      if (Math.hypot(c[0] - ref[0], c[1] - ref[1], c[2] - ref[2]) > 12) continue;
      px[p * 4 + 3] = 0;
      const x = p % w, y = (p / w) | 0;
      if (x > 0) stack.push(p - 1); if (x < w - 1) stack.push(p + 1); if (y > 0) stack.push(p - w); if (y < h - 1) stack.push(p + w);
    }
  }
  ctx.putImageData(d, 0, 0);
}

/** k-means (k=4, 12 iterations) on a 64x64 downscale; proposes the 3 most distinct non-near-white colours. */
export function logoColours(img: CanvasImageSource): string[] {
  const c = document.createElement("canvas"); c.width = 64; c.height = 64;
  const ctx = c.getContext("2d", { willReadFrequently: true })!; ctx.drawImage(img, 0, 0, 64, 64);
  const d = ctx.getImageData(0, 0, 64, 64).data;
  const pts: number[][] = [];
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128 && !(d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235)) pts.push([d[i], d[i + 1], d[i + 2]]);
  if (!pts.length) return [];
  let cents = [0, 0.33, 0.66, 0.99].map((f) => pts[Math.floor(f * (pts.length - 1))].slice());
  for (let it = 0; it < 12; it++) {
    const sums = cents.map(() => [0, 0, 0, 0]);
    for (const p of pts) {
      let bi = 0, bd = Infinity;
      cents.forEach((c2, i) => { const dd = (p[0] - c2[0]) ** 2 + (p[1] - c2[1]) ** 2 + (p[2] - c2[2]) ** 2; if (dd < bd) { bd = dd; bi = i; } });
      sums[bi][0] += p[0]; sums[bi][1] += p[1]; sums[bi][2] += p[2]; sums[bi][3]++;
    }
    cents = sums.map((s, i) => (s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : cents[i]));
  }
  const hex = (c2: number[]) => "#" + c2.map((x) => Math.round(x).toString(16).padStart(2, "0")).join("");
  const out: number[][] = [];
  for (const c2 of cents.sort((a, b) => b[0] + b[1] + b[2] - (a[0] + a[1] + a[2]))) {
    if (out.every((o) => Math.hypot(o[0] - c2[0], o[1] - c2[1], o[2] - c2[2]) > 40)) out.push(c2);
  }
  return out.slice(0, 3).map(hex);
}
