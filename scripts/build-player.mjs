// Builds the immutable share-page player into public/r/<rendererVersion>/ as plain ES modules.
// Uses the TypeScript compiler only (no bundler): each module is transpiled and relative imports get ".js".
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
const core = fs.readFileSync(path.join(root, "packages/renderer/core.ts"), "utf8");
const version = core.match(/RENDERER_VERSION = "([^"]+)"/)[1];
const out = path.join(root, "public/r", version);
fs.mkdirSync(path.join(out, "renderer"), { recursive: true });
fs.mkdirSync(path.join(out, "player"), { recursive: true });

function build(srcRel, dstRel) {
  const src = fs.readFileSync(path.join(root, srcRel), "utf8");
  let js = ts.transpileModule(src, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020, removeComments: true },
  }).outputText;
  js = js.replace(/(from\s+["'])(\.{1,2}\/[^"']+?)(["'])/g, (_, a, p, b) => a + (p.endsWith(".js") ? p : p + ".js") + b);
  fs.writeFileSync(path.join(out, dstRel), js);
  return js.length;
}
let bytes = 0;
for (const f of fs.readdirSync(path.join(root, "packages/renderer"))) {
  if (f.endsWith(".ts")) bytes += build(`packages/renderer/${f}`, `renderer/${f.replace(/\.ts$/, ".js")}`);
}
bytes += build("packages/player/player.ts", "player/player.js");
fs.writeFileSync(path.join(out, "player.js"), 'import "./player/player.js";\n');
console.log(`player ${version}: ${(bytes / 1024).toFixed(1)} KB raw`);
