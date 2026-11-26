import { SHARE_CSP, escHtml, getShared, inlineJson } from "@/lib/share";
import { RENDERER_VERSION } from "@/packages/renderer/core";

export const dynamic = "force-static";
export const dynamicParams = true;
export async function generateStaticParams() { return []; }

function notFoundPage() {
  return new Response(
    `<!doctype html><html lang="hi-Latn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Yahan kuch nahi | Dhindhora</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#1B1A17;color:#F6E9D2;font:500 17px system-ui;background-image:radial-gradient(#F6E9D2 1px,transparent 1.5px);background-size:16px 16px}
main{background:#1B1A17;padding:28px;text-align:center;border:2px solid #F6E9D2}a{display:inline-block;margin-top:14px;background:#F2B705;color:#1B1A17;padding:12px 18px;min-height:44px;box-sizing:border-box;font-weight:700;text-decoration:none;box-shadow:4px 4px 0 #F6E9D2}</style></head>
<body><main><p>Ye dukaan band hai, ya yahan kabhi thi hi nahi.</p><a href="/">Gali mein wapas jao</a></main></body></html>`,
    { status: 404, headers: { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": SHARE_CSP } },
  );
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getShared(id);
  if (!p) return notFoundPage();
  const doc = p.doc;
  const [aw, ah] = doc.aspect === "9:16" ? [9, 16] : doc.aspect === "1:1" ? [1, 1] : [16, 9];
  const title = escHtml(p.title);
  const desc = escHtml(doc.brief.oneLiner || "Dhindhora pe bana dhindhora");
  const origin = new URL(req.url).origin;
  const og = `${origin}/api/og/${p.id}?v=${p.published_version}`;
  const canRemix = p.visibility === "public";
  const url = doc.brief.cta.url && /^https?:\/\//.test(doc.brief.cta.url) ? doc.brief.cta.url : "";
  const bulbs = Array.from({ length: 14 }, (_, i) => `<i style="--i:${i}"></i>`).join("");
  const maxW = doc.aspect === "16:9" ? "min(92vw, 880px)" : doc.aspect === "1:1" ? "min(92vw, 560px)" : "min(86vw, 400px, calc((100svh - 220px) * 9 / 16))";
  const html = `<!doctype html><html lang="hi-Latn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} | Dhindhora</title><meta name="description" content="${desc}">
<meta property="og:title" content="${title}"><meta property="og:description" content="${desc}"><meta property="og:image" content="${og}"><meta property="og:type" content="video.other">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${og}"><meta name="theme-color" content="#2B1E2F">
<link rel="preload" href="/r/${RENDERER_VERSION}/renderer/frame.js" as="script" crossorigin>
<style>
@font-face{font-family:"Yatra One";src:url(/f/YatraOne-400-latin.woff2) format("woff2");font-display:swap}
@font-face{font-family:"Baloo 2";font-weight:700;src:url(/f/Baloo2-700-latin.woff2) format("woff2");font-display:swap}
:root{--kohl:#1B1A17;--chai:#F6E9D2;--haldi:#F2B705;--genda:#F07F13;--mirchi:#D7261E;--rani:#E0218A;--dusk:#2B1E2F;color-scheme:dark}
*{box-sizing:border-box}body{margin:0;min-height:100svh;background:var(--dusk);color:var(--chai);font:700 16px "Baloo 2",system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;overflow-x:hidden}
.ground{position:fixed;left:0;right:0;bottom:0;height:10vh;z-index:-1;pointer-events:none;background:repeating-linear-gradient(90deg,#3a2a3f 0 46px,#33243a 46px 48px);border-top:3px solid var(--kohl)}
.tank{position:fixed;z-index:-1;right:8vw;top:9vh;width:70px;height:54px;background:#3c2d42;border:2px solid var(--kohl)}
.tank:after{content:"";position:absolute;left:10px;right:10px;top:54px;height:60px;border-left:3px solid #3c2d42;border-right:3px solid #3c2d42}
header{position:relative;width:100%;display:flex;justify-content:space-between;align-items:center;padding:12px 16px}
header a{color:var(--chai);font-family:"Yatra One",serif;font-size:22px;text-decoration:none;min-height:44px;display:flex;align-items:center}
.demo{background:var(--haldi);color:var(--kohl);padding:4px 10px;font-size:14px;box-shadow:3px 3px 0 var(--kohl)}
.hoarding{position:relative;margin-top:8px;width:${maxW};padding:16px;background:#3a2a3f;border:3px solid var(--kohl);box-shadow:6px 6px 0 var(--kohl)}
.bulbs{position:absolute;inset:-9px;display:flex;justify-content:space-between;pointer-events:none}
.bulbs i{position:relative;width:12px;height:12px;border-radius:50%;background:#5b5346;border:2px solid var(--kohl)}
.bulbs i:after{content:"";position:absolute;inset:-2px;border-radius:50%;background:var(--haldi);opacity:0;transition:opacity .18s calc(var(--i) * 55ms)}
body.ready .bulbs i:after{opacity:1}
.face{position:relative;width:100%;aspect-ratio:${aw}/${ah};background:var(--kohl)}
canvas{display:block;width:100%;height:100%;cursor:pointer}
.pole{width:18px;height:28px;background:#3a2a3f;border:3px solid var(--kohl);border-top:0}
.ctrl{display:flex;gap:10px;align-items:center;width:${maxW};margin-top:10px;flex-wrap:wrap}
button,.btn{min-height:44px;min-width:44px;padding:8px 16px;border:2px solid var(--kohl);background:var(--haldi);color:var(--kohl);font:700 16px "Baloo 2",sans-serif;box-shadow:4px 4px 0 var(--kohl);cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}
button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid var(--genda);outline-offset:2px}
input[type=range]{flex:1;min-width:80px;height:44px;accent-color:var(--rani)}
.tc{font:400 14px ui-monospace,monospace;font-variant-numeric:tabular-nums;white-space:nowrap}
.end{width:${maxW};margin-top:12px;background:var(--chai);color:var(--kohl);padding:12px 14px;border:2px solid var(--kohl);box-shadow:4px 4px 0 var(--kohl)}
.end p{margin:0 0 8px}.end a.cta{color:#00707A}
details{width:${maxW};margin:14px 0 30px;font-weight:500}summary{min-height:44px;display:flex;align-items:center;cursor:pointer;color:#cdbfa8}
form{display:grid;gap:8px;margin-top:6px}select,textarea{font:500 16px "Baloo 2",sans-serif;padding:8px;border:2px solid var(--kohl);background:var(--chai);color:var(--kohl);min-height:44px}
.help{width:${maxW};font:500 14px "Baloo 2",sans-serif;color:#cdbfa8;margin:8px 0}
[hidden]{display:none!important}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
</style></head><body>
<div class="ground" aria-hidden="true"></div><div class="tank" aria-hidden="true"></div>
<header><a href="/">ढिंढोरा Dhindhora</a>${p.is_demo ? '<span class="demo">Demo: kaalpanik dukaan</span>' : ""}</header>
<div class="hoarding"><div class="bulbs" aria-hidden="true">${bulbs}</div>
<div class="face"><canvas id="stage" role="img" aria-label="${title}: silent promo video"></canvas></div></div>
<div class="pole" aria-hidden="true"></div>
<div class="ctrl"><button id="pp" type="button" aria-label="Play">Chalao</button>
<input id="scrub" type="range" min="0" step="1" value="0" role="slider" aria-label="Video ka samay"><span id="tc" class="tc">0:00.0</span></div>
<div id="endtag" class="end" hidden><p>Ye video Dhindhora pe bana. Apna banao</p>
<a class="btn" href="/">Apna banao</a> <button id="remix" type="button" hidden>Remix karo${p.remix_count >= 1 ? ` (${p.remix_count} remix)` : ""}</button>
${url ? ` <a class="cta" href="${escHtml(url)}" rel="nofollow ugc noopener noreferrer" target="_blank">Dukaan ka link</a>` : ""}</div>
<p class="help">Ye video seedha JSON se chalti hai. Har phone pe wahi motion aur layout, bas kinaaron ki chikanai ek pixel alag ho sakti hai.</p>
<details><summary>Report karo</summary><form id="report"><select name="reason" aria-label="Wajah"><option value="impersonation">Kisi aur ki dukaan ban ke</option><option value="misleading">Jhootha offer</option><option value="offensive">Gandi baat</option><option value="spam">Spam</option><option value="other">Kuch aur</option></select>
<textarea name="note" maxlength="500" rows="2" aria-label="Note (optional)" placeholder="Note (optional)"></textarea><button type="submit">Bhejo</button><span id="rmsg" role="status"></span></form></details>
<script type="application/json" id="doc">${inlineJson({ id: p.id, doc, canRemix })}</script>
<script type="module" src="/r/${doc.renderer || RENDERER_VERSION}/player.js"></script>
</body></html>`;
  const headers: Record<string, string> = {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": SHARE_CSP,
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
  };
  if (p.visibility === "unlisted") headers["X-Robots-Tag"] = "noindex";
  return new Response(html, { headers });
}
