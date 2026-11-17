export type Lang = "hi-Latn" | "en";
export const STRINGS = {
  hero: { "hi-Latn": "Apni dukaan ka dhindhora peeto", en: "Beat the drum for your shop" },
  newBrief: { "hi-Latn": "Parchi bharo", en: "Fill the chit" },
  newShop: { "hi-Latn": "Naya dhindhora", en: "New promo" },
  make: { "hi-Latn": "Banao", en: "Make it" },
  reshuffle: { "hi-Latn": "Phir se phento", en: "Shuffle again" },
  export: { "hi-Latn": "Status pe daalo", en: "Put it on Status" },
  remix: { "hi-Latn": "Remix karo", en: "Remix this" },
  savedLocal: { "hi-Latn": "Phone pe rakh liya", en: "Saved on phone" },
  savedServer: { "hi-Latn": "Bhej diya", en: "Sent" },
  demoLabel: { "hi-Latn": "Demo: kaalpanik dukaan", en: "Demo: fictional shop" },
  sampleNum: { "hi-Latn": "Sample number", en: "Sample number" },
  endTag: { "hi-Latn": "Ye video Dhindhora pe bana. Apna banao", en: "Made on Dhindhora. Make yours" },
  openShutter: { "hi-Latn": "Shutter uthao", en: "Lift the shutter" },
  yourShops: { "hi-Latn": "Aapki dukaanein", en: "Your shops" },
  demos: { "hi-Latn": "Gali ke aakhir mein: teen demo dukaanein", en: "End of the lane: three demo shops" },
  closed: { "hi-Latn": "Band dukaanein", en: "Closed shops" },
  play: { "hi-Latn": "Chalao", en: "Play" },
  undo: { "hi-Latn": "Wapas", en: "Undo" },
  redo: { "hi-Latn": "Aage", en: "Redo" },
  calm: { "hi-Latn": "Shaant", en: "Calm" },
  signin: { "hi-Latn": "Munim ji ke paas", en: "Sign in" },
  emptyLane: { "hi-Latn": "Abhi koi dukaan nahi. Pehli parchi bharo.", en: "No shops yet. Fill your first chit." },
  terms: { "hi-Latn": "Muft aur bina paise ka auzaar. Sirf apni dukaan ya maalik ki ijaazat se banao. Koi analytics nahi.", en: "A free, non-commercial tool. Make videos only for your own shop or with the owner's permission. No analytics." },
} as const;
export type StrKey = keyof typeof STRINGS;
export function t(k: StrKey, lang: Lang = "hi-Latn") { return STRINGS[k][lang]; }
