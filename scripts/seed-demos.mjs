// Seeds the three fictional demo shops under a system user. Idempotent.
// Usage: node scripts/build-player.mjs && node --env-file=.env.local scripts/seed-demos.mjs
import { Pool } from "@neondatabase/serverless";
import { director } from "../public/r/1.0.0/renderer/director.js";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const SYSTEM = "u_system_demos";
const inTwoWeeks = new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10);

const demos = [
  {
    id: "demoAchaar", style: "truck", aspect: "1:1", lengthSec: 15,
    brief: {
      lang: "hinglish", name: "Ammi ka Achaar", oneLiner: "Ghar ka swaad, ab har shehar mein",
      points: [{ id: "p1", text: "Sarson ke tel mein dhoop mein pakaya" }, { id: "p2", text: "Koi preservative nahi" }, { id: "p3", text: "Aam, nimbu aur mirchi" }],
      numbers: [], colors: ["#D7261E", "#F2B705"],
      cta: { text: "Aaj hi order karo", phone: "+91 90000 00001", address: "Kaalpanik Gali, Demo Nagar", url: "" },
      offer: { oldPrice: 240, newPrice: 199 },
    },
    force: ["seal", "price", "kite", "end"],
  },
  {
    id: "demoSitara", style: "cinema", aspect: "9:16", lengthSec: 15,
    brief: {
      lang: "hinglish", name: "Sitara Tuition Centre", oneLiner: "Admissions Open: naya batch shuru",
      points: [{ id: "p1", text: "Class 6 se 12" }, { id: "p2", text: "Chhote batch" }, { id: "p3", text: "Weekly test" }],
      numbers: [
        { id: "n1", value: 12, prefix: "", suffix: "", label: "batches", sample: true },
        { id: "n2", value: 9, prefix: "", suffix: " saal", label: "anubhav", sample: true },
        { id: "n3", value: 40, prefix: "", suffix: " seats", label: "seats baaki", sample: true },
        { id: "n4", value: 3, prefix: "", suffix: "", label: "shifts", sample: true },
      ],
      colors: ["#D7261E", "#00707A"],
      cta: { text: "Seat pakki karo", phone: "+91 90000 00002", address: "Demo Chowk, Kaalpanik Pur", url: "" },
      offer: { endsOn: inTwoWeeks },
    },
    force: ["shutter", "meter", "countdown", "end"],
  },
  {
    id: "demoHisaab", style: "akhbaar", aspect: "16:9", lengthSec: 15,
    brief: {
      lang: "hinglish", name: "Hisaab", oneLiner: "Chhoti dukaan ka ledger app, online order bhi",
      points: [{ id: "p1", text: "Udhaar ka hisaab ek tap mein" }, { id: "p2", text: "Roz ka galla" }, { id: "p3", text: "WhatsApp pe bill" }, { id: "p4", text: "Bina internet bhi chale" }],
      numbers: [
        { id: "n1", value: 120, prefix: "", suffix: "+", label: "Jan", sample: true },
        { id: "n2", value: 340, prefix: "", suffix: "+", label: "Feb", sample: true },
        { id: "n3", value: 610, prefix: "", suffix: "+", label: "Mar", sample: true },
      ],
      colors: ["#C8102E"],
      cta: { text: "Muft mein aazmao", phone: "", address: "", url: "https://dhindhora.vercel.app" },
    },
    force: ["shutter", "phone", "ladoo", "magazine", "end"],
  },
];

await pool.query("insert into users (id, kind, name) values ($1, 'system', 'Dhindhora demos') on conflict (id) do nothing", [SYSTEM]);
for (const d of demos) {
  let scenes = director(d.brief, 1, d.lengthSec, new Date().toISOString().slice(0, 10));
  // keep exactly the beats each demo is meant to show, in the documented order
  scenes = d.force.map((type) => scenes.find((s) => s.type === type) || { id: ("s" + type + "0000000").slice(0, 8), type, variant: 0, durMs: 0, inMs: 0, speed: 1, source: type === "seal" ? ["name"] : ["name", "oneLiner"], text: {}, edited: [] });
  const per = Math.floor((d.lengthSec * 10) / scenes.length);
  scenes.forEach((s, i) => { s.durMs = (i === scenes.length - 1 ? d.lengthSec * 10 - per * (scenes.length - 1) : per) * 100; });
  for (const s of scenes) if (s.type === "countdown") s.text.days = "12";
  const doc = { schema: 1, renderer: "1.0.0", brief: d.brief, seed: 1, style: d.style, aspect: d.aspect, lengthSec: d.lengthSec, scenes };
  await pool.query(
    `insert into projects (id, owner_id, title, doc, published_doc, published_version, renderer_version, style, aspect, length_sec, visibility, featured, is_demo, published_at)
     values ($1, $2, $3, $4, $4, 1, '1.0.0', $5, $6, $7, 'public', true, true, now())
     on conflict (id) do update set doc = excluded.doc, published_doc = excluded.published_doc, title = excluded.title, style = excluded.style, aspect = excluded.aspect, featured = true, is_demo = true, visibility = 'public', hidden_at = null, deleted_at = null`,
    [d.id, SYSTEM, d.brief.name, JSON.stringify(doc), d.style, d.aspect, d.lengthSec],
  );
  console.log("seeded", d.id, scenes.map((s) => s.type).join(","));
}
await pool.end();
