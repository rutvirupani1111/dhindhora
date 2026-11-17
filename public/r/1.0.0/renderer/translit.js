const DICT = {
    diwali: "दिवाली", offer: "ऑफ़र", sale: "सेल", mithai: "मिठाई", chhoot: "छूट", choot: "छूट", dukaan: "दुकान", dukan: "दुकान",
    admission: "एडमिशन", admissions: "एडमिशन", batch: "बैच", batches: "बैच", seats: "सीट्स", seat: "सीट", open: "ओपन", khula: "खुला",
    holi: "होली", eid: "ईद", rakhi: "राखी", navratri: "नवरात्रि", dussehra: "दशहरा", christmas: "क्रिसमस", new: "न्यू", year: "ईयर",
    achaar: "अचार", achar: "अचार", ghar: "घर", ka: "का", ki: "की", ke: "के", swaad: "स्वाद", swad: "स्वाद", taaza: "ताज़ा", taza: "ताज़ा",
    sirf: "सिर्फ़", ab: "अब", aaj: "आज", kal: "कल", tak: "तक", se: "से", mein: "में", me: "में", par: "पर", pe: "पे", aur: "और",
    hai: "है", hain: "हैं", free: "फ़्री", delivery: "डिलीवरी", home: "होम", order: "ऑर्डर", online: "ऑनलाइन", call: "कॉल", karo: "करो",
    kariye: "करिए", aaiye: "आइए", aao: "आओ", jaldi: "जल्दी", sasta: "सस्ता", saste: "सस्ते", best: "बेस्ट", quality: "क्वालिटी",
    saree: "साड़ी", sari: "साड़ी", kurti: "कुर्ती", suit: "सूट", mobile: "मोबाइल", repair: "रिपेयर", service: "सर्विस", shop: "शॉप",
    kirana: "किराना", store: "स्टोर", sweets: "स्वीट्स", namkeen: "नमकीन", ladoo: "लड्डू", laddu: "लड्डू", barfi: "बर्फ़ी", jalebi: "जलेबी",
    coaching: "कोचिंग", classes: "क्लासेस", class: "क्लास", tuition: "ट्यूशन", centre: "सेंटर", center: "सेंटर", saal: "साल", din: "दिन",
    baaki: "बाकी", baki: "बाकी", naya: "नया", nayi: "नई", naye: "नए", purana: "पुराना", collection: "कलेक्शन", discount: "डिस्काउंट",
    rupaye: "रुपये", rupees: "रुपये", rs: "रु", gym: "जिम", salon: "सैलून", parlour: "पार्लर", catering: "कैटरिंग", shaadi: "शादी",
    party: "पार्टी", booking: "बुकिंग", whatsapp: "व्हाट्सऐप", app: "ऐप", website: "वेबसाइट", candle: "कैंडल", candles: "कैंडल्स",
    haath: "हाथ", bana: "बना", bane: "बने", banaya: "बनाया", maa: "माँ", ammi: "अम्मी", dadi: "दादी", nani: "नानी", pyaar: "प्यार",
    khush: "ख़ुश", khushi: "ख़ुशी", tyohar: "त्योहार", shubh: "शुभ", labh: "लाभ", deepawali: "दीपावली", dhamaka: "धमाका", mela: "मेला",
    bazaar: "बाज़ार", bazar: "बाज़ार", gali: "गली", sabse: "सबसे", accha: "अच्छा", achha: "अच्छा", bahut: "बहुत", zyada: "ज़्यादा", kam: "कम",
    daam: "दाम", keemat: "क़ीमत", wala: "वाला", wali: "वाली", wale: "वाले", sunday: "संडे", monday: "मंडे", tak_: "तक", ek: "एक", do: "दो",
    teen: "तीन", char: "चार", paanch: "पाँच", das: "दस", sau: "सौ", hazaar: "हज़ार", lakh: "लाख", fresh: "फ़्रेश", special: "स्पेशल",
    pure: "प्योर", desi: "देसी", ghee: "घी", chai: "चाय", paan: "पान", thali: "थाली", menu: "मेन्यू", today: "टुडे", only: "ओनली",
};
const VOW = [
    ["aa", "आ", "ा"], ["ai", "ऐ", "ै"], ["au", "औ", "ौ"], ["ee", "ई", "ी"], ["ii", "ई", "ी"], ["oo", "ऊ", "ू"], ["uu", "ऊ", "ू"],
    ["a", "अ", ""], ["i", "इ", "ि"], ["u", "उ", "ु"], ["e", "ए", "े"], ["o", "ओ", "ो"], ["ri", "ऋ", "ृ"],
];
const CONS = [
    ["ksh", "क्ष"], ["gya", "ज्ञ"], ["chh", "छ"], ["kh", "ख"], ["gh", "घ"], ["ch", "च"], ["jh", "झ"], ["th", "थ"], ["dh", "ध"],
    ["ph", "फ"], ["bh", "भ"], ["sh", "श"], ["ng", "ङ"], ["k", "क"], ["g", "ग"], ["c", "क"], ["j", "ज"], ["t", "त"], ["d", "द"],
    ["n", "न"], ["p", "प"], ["b", "ब"], ["m", "म"], ["y", "य"], ["r", "र"], ["l", "ल"], ["v", "व"], ["w", "व"], ["s", "स"],
    ["h", "ह"], ["f", "फ़"], ["z", "ज़"], ["q", "क़"], ["x", "क्स"],
];
function rules(w) {
    let out = "", i = 0, prevCons = false;
    const s = w.toLowerCase();
    while (i < s.length) {
        if (s[i] === "n" && prevCons === false && out && i + 1 < s.length && CONS.some(([r]) => s.startsWith(r, i + 1)) && !VOW.some(([r]) => s.startsWith(r, i + 1))) {
            out += "ं";
            i++;
            continue;
        }
        const c = CONS.find(([r]) => s.startsWith(r, i));
        if (c) {
            if (prevCons)
                out += "्";
            out += c[1];
            i += c[0].length;
            prevCons = true;
            const v = VOW.find(([r]) => s.startsWith(r, i));
            if (v) {
                if (v[0] === "a" && i + 1 === s.length) {
                    i++;
                    prevCons = false;
                    continue;
                }
                out += v[2];
                i += v[0].length;
                prevCons = false;
            }
            continue;
        }
        const v = VOW.find(([r]) => s.startsWith(r, i));
        if (v) {
            out += v[1];
            i += v[0].length;
            prevCons = false;
            continue;
        }
        out += s[i];
        i++;
        prevCons = false;
    }
    return out;
}
export function translitWord(word) {
    const m = word.match(/^([^A-Za-z]*)([A-Za-z]+)([^A-Za-z]*)$/);
    if (!m)
        return word;
    const [, pre, core, post] = m;
    const hit = DICT[core.toLowerCase()];
    return pre + (hit ?? rules(core)) + post;
}
export function translit(text) {
    const roman = {};
    const outText = text.split(/(\s+)/).map((part) => {
        if (!part.trim() || /[ऀ-ॿ]/.test(part))
            return part;
        const d = translitWord(part);
        if (d !== part)
            roman[d] = part;
        return d;
    }).join("");
    return { text: outText, roman };
}
export const DICTIONARY_SIZE = Object.keys(DICT).length;
