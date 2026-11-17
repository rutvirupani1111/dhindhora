import { backOut, clamp, easeInOut, easeOut, fnv1a, formatNumber, graphemesSafe, lerp, mulberry32, prog, springOut } from "./core.js";
import { LINE_H, dims, safeArea, sceneNumbers, scenePoints } from "./layout.js";
import { textOn } from "./styles.js";
function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}
function hardShadowRect(R, x, y, w, h, fill, rad = 0, off = 12) {
    const { ctx } = R;
    ctx.fillStyle = "#1B1A17";
    rr(ctx, x + off, y + off, w, h, rad);
    ctx.fill();
    ctx.fillStyle = fill;
    rr(ctx, x, y, w, h, rad);
    ctx.fill();
}
export function background(R) {
    const { ctx, W, H, p, detail } = R;
    ctx.fillStyle = p.ground;
    ctx.fillRect(0, 0, W, H);
    if (detail < 1)
        return;
    const rng = mulberry32(fnv1a(p.s.id) ^ 77);
    switch (p.s.texture) {
        case "enamel": {
            ctx.fillStyle = p.panel;
            for (let i = 0; i < 60; i++) {
                const edge = rng() < 0.5;
                const x = edge ? rng() * W : (rng() < 0.5 ? rng() * 60 : W - rng() * 60);
                const y = edge ? (rng() < 0.5 ? rng() * 70 : H - rng() * 70) : rng() * H;
                const r = 4 + rng() * 14;
                ctx.beginPath();
                for (let k = 0; k < 6; k++) {
                    const a = (k / 6) * Math.PI * 2;
                    const rr2 = r * (0.6 + rng() * 0.6);
                    ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2);
                }
                ctx.fill();
            }
            break;
        }
        case "halftone": {
            ctx.fillStyle = p.a[0];
            ctx.globalAlpha = 0.16;
            const step = 26;
            for (let y = 0; y < H; y += step)
                for (let x = 0; x < W; x += step) {
                    const d = Math.hypot(x - W, y - H) / Math.hypot(W, H);
                    const r = Math.max(0, (0.55 - d) * 22);
                    if (r > 0.5) {
                        ctx.beginPath();
                        ctx.arc(x, y, r, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            ctx.globalAlpha = 1;
            break;
        }
        case "chips": {
            ctx.fillStyle = "#c9c4b0";
            for (const [x, y] of [[40, 40], [W - 40, 40], [40, H - 40], [W - 40, H - 40]]) {
                ctx.beginPath();
                ctx.arc(x, y, 14, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = "#6e6a5c";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(x - 9, y);
                ctx.lineTo(x + 9, y);
                ctx.stroke();
            }
            break;
        }
        case "columns": {
            ctx.strokeStyle = "rgba(20,20,20,.14)";
            ctx.lineWidth = 2;
            const n = W > H ? 6 : 3;
            for (let i = 1; i < n; i++) {
                ctx.beginPath();
                ctx.moveTo((W / n) * i, 0);
                ctx.lineTo((W / n) * i, H);
                ctx.stroke();
            }
            break;
        }
        case "brick": {
            ctx.strokeStyle = "rgba(246,233,210,.08)";
            ctx.lineWidth = 3;
            const bh = 54, bw = 120;
            for (let y = 0, row = 0; y < H; y += bh, row++) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(W, y);
                ctx.stroke();
                for (let x = row % 2 ? bw / 2 : 0; x < W; x += bw) {
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(x, y + bh);
                    ctx.stroke();
                }
            }
            break;
        }
    }
}
export function border(R) {
    const { ctx, W, H, p, detail } = R;
    if (detail < 1)
        return;
    switch (p.s.border) {
        case "lotus": {
            const m = 26, step = 54;
            ctx.fillStyle = p.a[2];
            const petal = (x, y, ang, col) => {
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(ang);
                ctx.fillStyle = col;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.quadraticCurveTo(-16, -14, 0, -30);
                ctx.quadraticCurveTo(16, -14, 0, 0);
                ctx.fill();
                ctx.restore();
            };
            let i = 0;
            for (let x = step / 2; x < W; x += step, i++) {
                petal(x, m + 14, 0, p.a[i % 3]);
                petal(x, H - m - 14, Math.PI, p.a[(i + 1) % 3]);
            }
            i = 0;
            for (let y = step * 1.5; y < H - step; y += step, i++) {
                petal(m + 14, y, -Math.PI / 2, p.a[i % 3]);
                petal(W - m - 14, y, Math.PI / 2, p.a[(i + 2) % 3]);
            }
            ctx.strokeStyle = p.ink;
            ctx.lineWidth = 4;
            ctx.strokeRect(m + 40, m + 40, W - 2 * m - 80, H - 2 * m - 80);
            break;
        }
        case "rule": {
            ctx.strokeStyle = p.ink;
            ctx.lineWidth = 4;
            ctx.strokeRect(30, 30, W - 60, H - 60);
            ctx.lineWidth = 2;
            ctx.strokeRect(44, 44, W - 88, H - 88);
            break;
        }
        case "column": {
            ctx.fillStyle = p.ink;
            ctx.fillRect(40, 36, W - 80, 8);
            ctx.fillRect(40, 52, W - 80, 3);
            ctx.fillRect(40, H - 55, W - 80, 3);
            ctx.fillRect(40, H - 44, W - 80, 8);
            break;
        }
        case "tube": {
            ctx.lineWidth = 6;
            ctx.strokeStyle = p.a[1];
            rr(ctx, 30, 30, W - 60, H - 60, 40);
            ctx.stroke();
            ctx.lineWidth = 2;
            ctx.strokeStyle = p.ink;
            rr(ctx, 40, 40, W - 80, H - 80, 32);
            ctx.stroke();
            break;
        }
        case "drop": break;
    }
}
export function drawBlock(R, key, o = {}) {
    const b = R.lock.blocks[key];
    if (!b)
        return;
    const { ctx, p } = R;
    const bg = o.bg ?? p.ground;
    const color = textOn(o.color ?? p.ink, bg, b.px);
    const [bx, by, bw, bh] = b.box;
    const lh = b.px * LINE_H;
    const total = b.lines.length * lh;
    let y0 = by + (bh - total) / 2 + b.px * 0.92;
    ctx.save();
    ctx.globalAlpha *= o.alpha ?? 1;
    if (o.scale && o.scale !== 1) {
        const cx = bx + bw / 2, cy = by + bh / 2;
        ctx.translate(cx, cy);
        ctx.scale(o.scale, o.scale);
        ctx.translate(-cx, -cy);
    }
    ctx.translate(o.dx ?? 0, o.dy ?? 0);
    ctx.font = `${b.weight} ${b.px}px '${b.family}','Baloo 2',sans-serif`;
    ctx.textBaseline = "alphabetic";
    const em = (o.emphasis || "").trim().toLowerCase();
    const words = [];
    for (const line of b.lines) {
        const lw = ctx.measureText(line).width;
        let x = b.align === "center" ? bx + (bw - lw) / 2 : bx;
        for (const part of line.split(/(\s+)/)) {
            if (part.trim())
                words.push({ s: part, x, y: y0 });
            x += ctx.measureText(part).width;
        }
        y0 += lh;
    }
    const n = words.length;
    words.forEach((w, i) => {
        const fx = o.wordFx ? o.wordFx(i, n) : { a: 1, dy: 0, s: 1 };
        if (fx.a <= 0)
            return;
        ctx.save();
        ctx.globalAlpha *= fx.a;
        const ww = ctx.measureText(w.s).width;
        if (fx.s !== 1) {
            ctx.translate(w.x + ww / 2, w.y - b.px * 0.35);
            ctx.scale(fx.s, fx.s);
            ctx.translate(-(w.x + ww / 2), -(w.y - b.px * 0.35));
        }
        const isEm = em && w.s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "") === em.replace(/[^\p{L}\p{N}]/gu, "");
        const fill = isEm ? textOn(p.a[0], bg, b.px) : color;
        const y = w.y + fx.dy;
        if (p.s.border === "drop" && b.px >= 48) {
            ctx.fillStyle = p.a[0] === fill ? "#1B1A17" : p.a[0];
            ctx.fillText(w.s, w.x + b.px * 0.05, y + b.px * 0.05);
        }
        if (p.s.border === "tube" && b.px >= 48) {
            ctx.lineJoin = "round";
            ctx.strokeStyle = p.a[0];
            ctx.lineWidth = Math.max(3, b.px * 0.07);
            ctx.strokeText(w.s, w.x, y);
            ctx.strokeStyle = p.a[1];
            ctx.lineWidth = Math.max(1.5, b.px * 0.025);
            ctx.strokeText(w.s, w.x + b.px * 0.04, y + b.px * 0.04);
        }
        ctx.fillStyle = fill;
        ctx.fillText(w.s, w.x, y);
        ctx.restore();
    });
    ctx.restore();
}
function sampleTag(R, nums) {
    if (!nums.some((n) => n.sample))
        return;
    const { ctx, S } = R;
    ctx.save();
    ctx.font = "700 30px 'Baloo 2',sans-serif";
    const w = ctx.measureText("sample").width + 28;
    const x = S.x + S.w - w, y = S.y - 10;
    ctx.fillStyle = "#F6E9D2";
    rr(ctx, x, y, w, 44, 6);
    ctx.fill();
    ctx.strokeStyle = "#1B1A17";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#1B1A17";
    ctx.fillText("sample", x + 14, y + 32);
    ctx.restore();
}
function shutter(R) {
    const { ctx, W, H, p, t, scene } = R;
    const v = scene.variant;
    const ribH = 34;
    const roll = v === 0 ? easeInOut(prog(t, 0, 700)) : 1;
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (let y = -ribH; y < H; y += ribH) {
        const yy = y - roll * 0;
        ctx.fillStyle = p.panel;
        ctx.fillRect(0, yy, W, ribH - 6);
        ctx.fillStyle = "rgba(0,0,0,.18)";
        ctx.fillRect(0, yy + ribH - 6, W, 3);
    }
    ctx.restore();
    if (v === 0 && roll < 1) {
        const top = -H * roll;
        for (let y = 0; y < H; y += ribH) {
            ctx.fillStyle = "#8C8A85";
            ctx.fillRect(0, top + y, W, ribH - 4);
            ctx.fillStyle = "#77756f";
            ctx.fillRect(0, top + y + ribH - 4, W, 2);
            ctx.fillStyle = "#a5a39d";
            ctx.fillRect(0, top + y + ribH - 2, W, 2);
        }
    }
    const em = scene.text.em || "";
    const start = v === 0 ? 450 : 120;
    const per = 170;
    drawBlock(R, "head", {
        emphasis: em,
        wordFx: (i) => {
            const q = prog(t, start + i * per, v === 1 ? 260 : 380);
            if (v === 1)
                return { a: q > 0 ? 1 : 0, dy: 0, s: lerp(2.4, 1, backOut(q)) };
            if (v === 2)
                return { a: q, dy: 0, s: 1 };
            return { a: q > 0 ? 1 : 0, dy: (1 - easeOut(q)) * 80, s: 1 };
        },
    });
    if (v === 2) {
        const q = easeInOut(prog(t, start, 900));
        if (q < 1) {
            ctx.fillStyle = p.a[0];
            ctx.fillRect(lerp(-W * 0.1, W, q), 0, 18, H);
        }
    }
    const nWords = (R.lock.blocks.head?.lines.join(" ").split(/\s+/).length) || 1;
    const subStart = start + nWords * per + 200;
    const sq = easeOut(prog(t, subStart, 420));
    drawBlock(R, "sub", { alpha: sq, dy: (1 - sq) * 40 });
}
function meter(R) {
    const { ctx, p, t, scene, brief, S } = R;
    const nums = sceneNumbers(scene, brief);
    const board = nums.length >= 3 || scene.variant === 2;
    nums.forEach((n, i) => {
        const q = easeOut(prog(t, 150 + i * 220, 1300));
        const shown = formatNumber(n, n.value * q);
        let cx, cy, w, h;
        if (board && nums.length >= 2) {
            const col = i % 2, row = Math.floor(i / 2);
            w = S.w * 0.44;
            h = S.h * (nums.length > 2 ? 0.26 : 0.3);
            cx = S.x + S.w * (0.25 + col * 0.5);
            cy = S.y + S.h * (0.18 + row * 0.42);
        }
        else {
            w = S.w * 0.9;
            h = S.h * 0.22;
            cx = S.x + S.w / 2;
            cy = S.y + S.h * (nums.length === 1 ? 0.3 : 0.18 + i * 0.4);
        }
        const pop = backOut(prog(t, i * 220, 420));
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(pop, pop);
        const taxi = scene.variant === 1;
        if (board) {
            ctx.fillStyle = "#1B1A17";
            ctx.beginPath();
            ctx.ellipse(10, 10, w / 2, h / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = p.a[i % 3];
            ctx.beginPath();
            ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        else {
            hardShadowRect(R, -w / 2, -h / 2, w, h, taxi ? "#1B1A17" : p.panel, 18);
            ctx.strokeStyle = p.a[0];
            ctx.lineWidth = 6;
            rr(ctx, -w / 2 + 12, -h / 2 + 12, w - 24, h - 24, 10);
            ctx.stroke();
        }
        const fill = board ? p.a[i % 3] : taxi ? "#1B1A17" : p.panel;
        let px = Math.min(h * 0.62, (w * 0.88) / Math.max(3, shown.length) * 1.7);
        ctx.font = `400 ${px}px 'Rozha One','Baloo 2',serif`;
        while (ctx.measureText(shown).width > w * 0.82 && px > 20) {
            px -= 4;
            ctx.font = `400 ${px}px 'Rozha One','Baloo 2',serif`;
        }
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const frac = (n.value * q) % 1;
        const roll = scene.variant === 0 && q < 1 ? frac * px * 0.6 : 0;
        ctx.save();
        ctx.beginPath();
        ctx.rect(-w / 2, -h / 2 + 10, w, h - 20);
        ctx.clip();
        ctx.fillStyle = textOn(taxi ? "#F2B705" : p.ink, fill, px);
        ctx.fillText(shown, 0, roll * 0.3 + px * 0.04);
        ctx.restore();
        ctx.restore();
        const lq = easeOut(prog(t, 600 + i * 220, 400));
        drawBlock(R, "lab" + i, { alpha: lq });
    });
    sampleTag(R, nums);
}
function kite(R) {
    const { ctx, p, t, scene, H } = R;
    const pts = scenePoints(scene, R.brief);
    const akhbaar = p.s.id === "akhbaar";
    pts.forEach((_, i) => {
        const b = R.lock.blocks["p" + i];
        if (!b)
            return;
        const [bx, by, bw, bh] = b.box;
        const cx = bx + bw / 2, cy = by + bh / 2;
        const q = prog(t, 200 + i * 320, 800);
        const e = scene.variant === 0 ? easeOut(q) : springOut(q);
        if (akhbaar) {
            ctx.fillStyle = p.ink;
            ctx.globalAlpha = e;
            ctx.fillRect(bx, by - 18, bw, 6);
            drawBlock(R, "p" + i, { alpha: e, dy: (1 - e) * 30 });
            ctx.globalAlpha = 1;
            return;
        }
        const fromX = cx + (i % 2 ? 1 : -1) * 900, fromY = cy - 700;
        const tug = scene.variant === 1 ? Math.sin((t - 1000) / 260 + i) * 8 * clamp((t - 1000) / 400) : 0;
        const x = lerp(fromX, cx, e), y = lerp(fromY, cy, e) + tug;
        const rot = (1 - e) * (i % 2 ? 0.6 : -0.6) + tug * 0.004;
        const size = Math.max(bw * 0.62, bh * 1.05);
        ctx.strokeStyle = "#1B1A17";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y + size * 0.7);
        ctx.quadraticCurveTo(x + 60, (y + H) / 2, x - 40, H + 20);
        ctx.stroke();
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        ctx.globalAlpha = 0.82;
        ctx.fillStyle = p.a[i % 3];
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.72);
        ctx.lineTo(size * 0.82, 0);
        ctx.lineTo(0, size * 0.72);
        ctx.lineTo(-size * 0.82, 0);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#1B1A17";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.72);
        ctx.lineTo(0, size * 0.72);
        ctx.moveTo(-size * 0.82, 0);
        ctx.lineTo(size * 0.82, 0);
        ctx.globalAlpha = 0.25;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.restore();
        ctx.save();
        ctx.translate(x - cx, y - cy);
        drawBlock(R, "p" + i, { bg: p.a[i % 3], color: "#1B1A17", alpha: clamp(e * 1.4) });
        ctx.restore();
    });
}
function magazine(R) {
    const { ctx, p, t, scene, dur, brief } = R;
    const pts = scenePoints(scene, brief);
    const n = Math.max(1, pts.length);
    const per = Math.max(500, (dur - 300) / n);
    const b0 = R.lock.blocks.p0;
    if (!b0)
        return;
    const [bx, by, bw, bh] = b0.box;
    const cw = bw * 1.15, ch = bh * 2.1, cx = bx + bw / 2, cy = by + bh / 2;
    const cur = clamp(Math.floor(t / per), 0, n - 1);
    for (let i = 0; i <= cur; i++) {
        const q = prog(t, i * per, 380);
        const e = scene.variant === 2 ? 1 : easeOut(q);
        const fan = scene.variant === 1 ? (i - cur) * 0.06 : ((fnv1a(scene.id + i) % 7) - 3) * 0.012;
        const flip = scene.variant === 2 ? Math.abs(Math.cos(Math.PI * clamp(q))) : 1;
        ctx.save();
        ctx.translate(cx + (1 - e) * 600, cy + (1 - e) * 900 + (cur - i) * -10);
        ctx.rotate(fan + (1 - e) * 0.4);
        ctx.scale(scene.variant === 2 && q < 1 ? Math.max(0.02, q < 0.5 ? 1 - q * 2 : (q - 0.5) * 2) : 1, 1);
        const col = i % 3 === 0 ? "#F6E9D2" : p.a[i % 3];
        hardShadowRect(R, -cw / 2, -ch / 2, cw, ch, col, 6, 14);
        ctx.fillStyle = p.a[0] === col ? "#1B1A17" : p.a[0];
        ctx.fillRect(-cw / 2, -ch / 2, cw, ch * 0.16);
        ctx.fillStyle = textOn("#F6E9D2", p.a[0] === col ? "#1B1A17" : p.a[0], 40);
        ctx.font = "700 40px 'Baloo 2',sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText((brief.name || "").slice(0, 22), -cw / 2 + 24, -ch / 2 + ch * 0.08);
        ctx.fillStyle = "#1B1A17";
        ctx.beginPath();
        ctx.arc(cw / 2 - 70, ch / 2 - 70, 48, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#F2B705";
        ctx.font = "400 52px 'Rozha One',serif";
        ctx.textAlign = "center";
        ctx.fillText("#" + (i + 1), cw / 2 - 70, ch / 2 - 66);
        ctx.restore();
        if (i === cur && flip > -1) {
            ctx.save();
            ctx.translate((1 - e) * 600, (1 - e) * 900);
            drawBlock(R, "p" + i, { bg: col, color: "#1B1A17", alpha: clamp(q * 2) });
            ctx.restore();
        }
    }
}
function phone(R) {
    const { ctx, p, t, scene, brief, W, H, S } = R;
    const wide = W > H;
    const ph = wide ? S.h * 0.95 : S.h * 0.64;
    const pw = ph * 0.5;
    const cx = wide ? S.x + S.w * 0.75 : W / 2, cy = wide ? H / 2 : S.y + S.h * 0.5;
    const enter = easeOut(prog(t, 0, 600));
    const tilt = scene.variant === 0 ? Math.sin(t / 900) * 0.08 : 0.04;
    ctx.save();
    ctx.translate(cx, cy + (1 - enter) * 500);
    ctx.transform(1, tilt * 0.5, -tilt, 1, 0, 0);
    hardShadowRect(R, -pw / 2, -ph / 2, pw, ph, "#1B1A17", pw * 0.12, 16);
    const sx = -pw / 2 + 16, sy = -ph / 2 + 16, sw = pw - 32, sh = ph - 32;
    ctx.fillStyle = "#F6E9D2";
    rr(ctx, sx, sy, sw, sh, pw * 0.09);
    ctx.fill();
    ctx.fillStyle = "#1B1A17";
    ctx.beginPath();
    ctx.arc(0, sy + 22, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    rr(ctx, sx, sy, sw, sh, pw * 0.09);
    ctx.clip();
    const scroll = scene.variant === 1 ? easeInOut(prog(t, 700, 1800)) * sh * 0.3 : 0;
    ctx.translate(0, -scroll);
    ctx.fillStyle = p.a[0];
    ctx.fillRect(sx, sy + 44, sw, 90);
    ctx.fillStyle = textOn("#F6E9D2", p.a[0], 34);
    ctx.font = "700 34px 'Baloo 2',sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText((brief.name || "").slice(0, 16), sx + 22, sy + 89);
    const pts = brief.points.slice(0, 5);
    pts.forEach((pt, i) => {
        const q = easeOut(prog(t, 400 + i * 160, 360));
        const y = sy + 160 + i * 96;
        ctx.globalAlpha = q;
        ctx.fillStyle = i % 2 ? "#EADBC0" : "#F1E3C9";
        rr(ctx, sx + 16, y, sw - 32, 80, 12);
        ctx.fill();
        ctx.fillStyle = p.a[(i + 1) % 3];
        ctx.beginPath();
        ctx.arc(sx + 52, y + 40, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#1B1A17";
        ctx.font = "500 26px 'Baloo 2',sans-serif";
        let s = pt.text;
        while (ctx.measureText(s).width > sw - 120 && s.length > 3)
            s = s.slice(0, -2);
        ctx.fillText(s === pt.text ? s : s + "…", sx + 84, y + 42);
        ctx.globalAlpha = 1;
    });
    const by = sy + sh - 120 + scroll;
    ctx.fillStyle = "#F2B705";
    rr(ctx, sx + 24, by, sw - 48, 80, 40);
    ctx.fill();
    ctx.strokeStyle = "#1B1A17";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = "#1B1A17";
    ctx.font = "700 32px 'Baloo 2',sans-serif";
    ctx.textAlign = "center";
    ctx.fillText((brief.cta.text || "").slice(0, 18), 0, by + 42);
    if (scene.variant === 2) {
        const q = prog(t, 1600, 500);
        if (q > 0 && q < 1) {
            ctx.strokeStyle = "#E0218A";
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(0, by + 40, 20 + q * 60, 0, Math.PI * 2);
            ctx.globalAlpha = 1 - q;
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
    }
    ctx.restore();
    ctx.restore();
    const tq = easeOut(prog(t, 200, 500));
    drawBlock(R, "title", { alpha: tq, dy: (1 - tq) * -30 });
    drawBlock(R, "line", { alpha: easeOut(prog(t, 700, 500)) });
}
function ladoo(R) {
    const { ctx, p, t, scene, brief, S } = R;
    const nums = sceneNumbers(scene, brief);
    const max = Math.max(1, ...nums.map((n) => n.value));
    const n = Math.max(1, nums.length);
    const colW = S.w / n;
    const baseY = S.y + S.h * 0.86;
    ctx.fillStyle = p.ink;
    ctx.fillRect(S.x, baseY + 6, S.w, 6);
    nums.forEach((num, i) => {
        const units = Math.max(1, Math.round((num.value / max) * 9));
        const r = Math.min(colW * 0.2, S.h * 0.04);
        const q = prog(t, 200 + i * 200, 1200);
        const shown = Math.ceil(units * easeOut(q));
        const cx = S.x + colW * (i + 0.5);
        for (let k = 0; k < shown; k++) {
            const row = scene.variant === 2 ? Math.floor(k / 2) : k;
            const off = scene.variant === 2 ? (k % 2 ? r * 1.05 : -r * 1.05) : 0;
            const drop = k === shown - 1 ? (1 - easeOut((q * units) % 1 || 1)) * 60 : 0;
            const y = baseY - r - row * r * 1.9 - drop;
            const x = scene.variant === 1 ? S.x + 20 + k * r * 2.1 : cx + off;
            const yy = scene.variant === 1 ? S.y + S.h * 0.2 + i * S.h * 0.18 : y;
            ctx.fillStyle = "#1B1A17";
            ctx.beginPath();
            ctx.arc(x + 4, yy + 4, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = p.a[i % 3];
            ctx.beginPath();
            ctx.arc(x, yy, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,.35)";
            ctx.beginPath();
            ctx.arc(x - r * 0.3, yy - r * 0.3, r * 0.25, 0, Math.PI * 2);
            ctx.fill();
        }
        const vq = prog(t, 900 + i * 200, 300);
        if (vq > 0 && scene.variant !== 1) {
            const topRow = scene.variant === 2 ? Math.ceil(units / 2) : units;
            ctx.globalAlpha = vq;
            ctx.fillStyle = textOn(p.ink, p.ground, 54);
            ctx.font = "400 54px 'Rozha One',serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "alphabetic";
            ctx.fillText(formatNumber(num), cx, baseY - topRow * r * 1.9 - r * 1.4);
            ctx.globalAlpha = 1;
        }
        drawBlock(R, "lab" + i, { alpha: easeOut(prog(t, 300 + i * 200, 400)) });
    });
    sampleTag(R, nums);
}
function seal(R) {
    const { ctx, p, t, scene, brief, W, S } = R;
    const cx = W / 2, cy = S.y + S.h * 0.38;
    const rad = Math.min(S.w, S.h) * 0.3;
    const v = scene.variant;
    const hit = 420;
    let s = 1, rot = 0, a = 1;
    if (v === 0) {
        const q = prog(t, 0, hit);
        s = lerp(2.6, 1, easeInOut(q));
        a = q > 0 ? 1 : 0;
        if (t > hit && t < hit + 66)
            s = 1.08;
    }
    else if (v === 1) {
        const q = springOut(prog(t, 0, 900));
        s = q;
        rot = (1 - q) * -1.2;
    }
    const squashY = v === 0 && t > hit && t < hit + 66 ? 0.86 : 1;
    if (v === 0 && t > hit) {
        const q = prog(t, hit, 600);
        ctx.strokeStyle = p.ink;
        ctx.globalAlpha = 1 - q;
        ctx.lineWidth = 6;
        for (let k = 0; k < 14; k++) {
            const ang = (k / 14) * Math.PI * 2, r1 = rad * (1.05 + q * 0.5);
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
            ctx.lineTo(cx + Math.cos(ang) * (r1 + 24), cy + Math.sin(ang) * (r1 + 24));
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }
    if (v === 2) {
        for (let k = 0; k < 16; k++) {
            const ang = (k / 16) * Math.PI * 2;
            const lit = t > k * 70;
            ctx.fillStyle = lit ? "#F2B705" : "#5b5346";
            ctx.beginPath();
            ctx.arc(cx + Math.cos(ang) * rad * 1.25, cy + Math.sin(ang) * rad * 1.25, 14, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.scale(s, s * squashY);
    const wax = p.a[0];
    ctx.fillStyle = "#1B1A17";
    ctx.beginPath();
    for (let k = 0; k <= 40; k++) {
        const ang = (k / 40) * Math.PI * 2;
        const rr2 = rad * (1 + (k % 2 ? 0.05 : -0.02));
        ctx.lineTo(Math.cos(ang) * rr2 + 12, Math.sin(ang) * rr2 + 12);
    }
    ctx.fill();
    ctx.fillStyle = wax;
    ctx.beginPath();
    for (let k = 0; k <= 40; k++) {
        const ang = (k / 40) * Math.PI * 2;
        const rr2 = rad * (1 + (k % 2 ? 0.05 : -0.02));
        ctx.lineTo(Math.cos(ang) * rr2, Math.sin(ang) * rr2);
    }
    ctx.fill();
    ctx.strokeStyle = textOn("#F6E9D2", wax, 60);
    ctx.globalAlpha *= 0.6;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, rad * 0.82, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = a;
    if (R.assets.logo) {
        const lw = brief.logo?.w || 1, lh = brief.logo?.h || 1, k = (rad * 1.2) / Math.max(lw, lh);
        ctx.drawImage(R.assets.logo, (-lw * k) / 2, (-lh * k) / 2, lw * k, lh * k);
    }
    else {
        const g = graphemesSafe(brief.name || "D").filter((x) => x.trim());
        const mono = (g[0] || "D") + ((brief.name || "").split(/\s+/)[1] ? graphemesSafe(brief.name.split(/\s+/)[1])[0] : "");
        ctx.fillStyle = textOn("#F6E9D2", wax, 120);
        ctx.font = `400 ${rad * 0.8}px 'Yatra One','Baloo 2',serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(mono.toUpperCase(), 0, rad * 0.06);
    }
    ctx.restore();
    const nq = easeOut(prog(t, hit + 200, 500));
    drawBlock(R, "name", { alpha: nq, dy: (1 - nq) * 40 });
}
function price(R) {
    const { ctx, p, t, scene, brief, W, S } = R;
    const o = brief.offer || {};
    const oldS = o.oldPrice != null ? "₹" + o.oldPrice.toLocaleString("en-IN") : "";
    const newS = o.newPrice != null ? "₹" + o.newPrice.toLocaleString("en-IN") : "";
    drawBlock(R, "head", { alpha: easeOut(prog(t, 0, 400)) });
    const oy = S.y + S.h * 0.3;
    if (oldS) {
        ctx.font = `400 ${S.w * 0.2}px 'Rozha One','Baloo 2',serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = textOn(p.ink, p.ground, 120);
        ctx.globalAlpha = easeOut(prog(t, 100, 300));
        ctx.fillText(oldS, W / 2, oy);
        ctx.globalAlpha = 1;
        const ow = ctx.measureText(oldS).width;
        const q = easeInOut(prog(t, 600, 380));
        if (q > 0) {
            ctx.strokeStyle = p.a[0];
            ctx.lineCap = "round";
            ctx.lineWidth = S.w * 0.035;
            ctx.beginPath();
            const x0 = W / 2 - ow * 0.62, x1 = W / 2 + ow * 0.62;
            ctx.moveTo(x0, oy + 30);
            for (let k = 1; k <= 12; k++) {
                const f = (k / 12) * q;
                ctx.lineTo(lerp(x0, x1, f), lerp(oy + 30, oy - 30, f) + Math.sin(k * 1.7) * 5);
            }
            ctx.stroke();
        }
    }
    if (newS) {
        const q = prog(t, 1000, 700);
        const swing = scene.variant === 2 ? 0 : Math.sin(clamp((t - 1000) / 1500) * 12) * Math.exp(-clamp((t - 1000) / 1500) * 4) * 0.25;
        const ty = lerp(-400, S.y + S.h * 0.62, scene.variant === 1 ? easeInOut(q) : springOut(q));
        const tw = S.w * 0.62, th = S.h * 0.2;
        const s = scene.variant === 1 && q > 0 ? lerp(1.5, 1, easeOut(q)) : 1;
        const flip = scene.variant === 2 ? Math.max(0.05, Math.abs(Math.cos(Math.PI * (1 - clamp(q))))) : 1;
        ctx.strokeStyle = "#1B1A17";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(W / 2, 0);
        ctx.lineTo(W / 2 + Math.sin(swing) * th * 0.5, ty - th / 2);
        ctx.stroke();
        ctx.save();
        ctx.translate(W / 2, ty - th / 2);
        ctx.rotate(swing);
        ctx.scale(s * flip, s);
        hardShadowRect(R, -tw / 2, 0, tw, th, "#F2B705", 18);
        ctx.fillStyle = "#1B1A17";
        ctx.beginPath();
        ctx.arc(-tw / 2 + 40, 40, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = `400 ${th * 0.62}px 'Rozha One','Baloo 2',serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(newS, 0, th * 0.55);
        ctx.restore();
        drawBlock(R, "tag", { alpha: easeOut(prog(t, 1300, 300)), dy: S.h * 0.0 });
        if (o.oldPrice && o.newPrice && o.oldPrice > o.newPrice) {
            const pct = Math.round((1 - o.newPrice / o.oldPrice) * 100) + "% OFF";
            const bq = backOut(prog(t, 1600, 400));
            ctx.save();
            ctx.translate(S.x + S.w * 0.82, S.y + S.h * 0.86);
            ctx.rotate(-0.2);
            ctx.scale(bq, bq);
            ctx.fillStyle = "#1B1A17";
            ctx.beginPath();
            ctx.arc(8, 8, S.w * 0.13, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = p.a[0];
            ctx.beginPath();
            ctx.arc(0, 0, S.w * 0.13, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = textOn("#F6E9D2", p.a[0], 48);
            ctx.font = `700 ${S.w * 0.05}px 'Baloo 2',sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(pct, 0, 4);
            ctx.restore();
        }
    }
}
function countdown(R) {
    const { ctx, p, t, scene, W, S } = R;
    const days = String(R.lock.days ?? 0);
    drawBlock(R, "head", { alpha: easeOut(prog(t, 0, 400)) });
    const cw = Math.min(S.w * 0.36, S.h * 0.3), ch = cw * 1.3;
    const total = days.length * cw + (days.length - 1) * 30;
    const x0 = W / 2 - total / 2, cy = S.y + S.h * 0.46;
    [...days].forEach((d, i) => {
        const x = x0 + i * (cw + 30);
        const q = prog(t, 300 + i * 200, 600);
        if (scene.variant === 2) {
            hardShadowRect(R, x, cy - ch / 2, cw, ch, p.a[1], 4);
            ctx.fillStyle = p.ground;
            for (let k = 0; k < 8; k++) {
                ctx.beginPath();
                ctx.arc(x, cy - ch / 2 + 20 + k * (ch - 40) / 7, 8, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        else {
            hardShadowRect(R, x, cy - ch / 2, cw, ch, "#1B1A17", 16);
            if (scene.variant === 1) {
                ctx.fillStyle = p.a[0];
                ctx.fillRect(x, cy - ch / 2, cw, ch * 0.2);
            }
        }
        const fill = scene.variant === 2 ? p.a[1] : "#1B1A17";
        ctx.font = `400 ${ch * 0.7}px 'Rozha One','Baloo 2',serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = textOn("#F6E9D2", fill, 100);
        ctx.save();
        ctx.translate(x + cw / 2, cy);
        ctx.scale(1, scene.variant === 0 ? Math.max(0.05, easeOut(q)) : 1);
        ctx.globalAlpha = scene.variant === 0 ? 1 : easeOut(q);
        ctx.fillText(d, 0, ch * 0.05);
        ctx.restore();
        if (scene.variant === 0) {
            ctx.fillStyle = "rgba(0,0,0,.35)";
            ctx.fillRect(x, cy - 2, cw, 4);
        }
    });
    drawBlock(R, "label", { alpha: easeOut(prog(t, 700, 400)) });
}
function endCard(R) {
    const { ctx, p, t, scene, W, H, S } = R;
    const wide = W > H;
    const v = scene.variant;
    const board = { x: S.x - 20, y: S.y - 20, w: S.w + 40, h: S.h + 40 };
    const fill = v === 2 ? p.panel : v === 1 ? p.ground : "#1B1A17";
    hardShadowRect(R, board.x, board.y, board.w, board.h, fill, v === 2 ? 30 : 8, 14);
    if (v === 0) {
        const per = 2 * (board.w + board.h), n = Math.floor(per / 70);
        for (let k = 0; k < n; k++) {
            let d = (k / n) * per, x, y;
            if (d < board.w) {
                x = board.x + d;
                y = board.y;
            }
            else if ((d -= board.w) < board.h) {
                x = board.x + board.w;
                y = board.y + d;
            }
            else if ((d -= board.h) < board.w) {
                x = board.x + board.w - d;
                y = board.y + board.h;
            }
            else {
                d -= board.w;
                x = board.x;
                y = board.y + board.h - d;
            }
            const lit = t > 200 + k * 25;
            ctx.fillStyle = lit ? "#F2B705" : "#4a4336";
            ctx.beginPath();
            ctx.arc(x, y, 12, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    const q = (d) => easeOut(prog(t, d, 450));
    drawBlock(R, "name", { bg: fill, alpha: q(150) });
    drawBlock(R, "cta", { bg: fill, color: p.a[2] === fill ? p.ink : "#F2B705", alpha: q(350), dy: (1 - q(350)) * 30 });
    drawBlock(R, "phone", { bg: fill, alpha: q(550) });
    drawBlock(R, "address", { bg: fill, alpha: q(650) });
    const qr = R.lock.qr;
    if (qr) {
        const size = wide ? S.h * 0.5 : S.w * 0.42;
        const x = wide ? S.x + S.w - size - 20 : W / 2 - size / 2, y = wide ? S.y + S.h / 2 - size / 2 : S.y + S.h * 0.62;
        const a = q(800);
        ctx.globalAlpha = a;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x - 16, y - 16, size + 32, size + 32);
        ctx.fillStyle = "#000000";
        const c = size / qr.n;
        for (let r2 = 0; r2 < qr.n; r2++)
            for (let c2 = 0; c2 < qr.n; c2++)
                if (qr.bits[r2 * qr.n + c2] === "1")
                    ctx.fillRect(x + c2 * c, y + r2 * c, Math.ceil(c), Math.ceil(c));
        ctx.globalAlpha = 1;
    }
    if (R.assets.logo && R.brief.logo) {
        const lw = R.brief.logo.w, lh = R.brief.logo.h, k = 120 / Math.max(lw, lh);
        ctx.drawImage(R.assets.logo, board.x + 30, board.y + 30, lw * k, lh * k);
    }
}
export const SCENES = {
    shutter, meter, kite, magazine, phone, ladoo, seal, price, countdown, end: endCard,
};
export { dims, safeArea };
