import { RENDERER_VERSION, nanoid, type Brief, type Doc } from "@/packages/renderer/core";

export function newProjectId() { return nanoid(10); }
export function blankBrief(): Brief {
  return {
    lang: "hinglish", name: "", oneLiner: "",
    points: [{ id: "p1", text: "" }, { id: "p2", text: "" }, { id: "p3", text: "" }],
    numbers: [], colors: ["#D7261E"], cta: { text: "Aaj hi aaiye", phone: "", address: "", url: "" }, offer: {},
  };
}
export function blankDoc(): Doc {
  return { schema: 1, renderer: RENDERER_VERSION, brief: blankBrief(), seed: 1, style: "truck", aspect: "9:16", lengthSec: 15, scenes: [] };
}
