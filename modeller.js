// Katalog över TV-modeller värda att köpa begagnat, 2020–2026.
//
// Urvalet är testvinnare och toppmodeller — de som håller värdet och där
// begagnatpriset är klart lägre än vad bilden är värd. Insteg (Q60, DU7000,
// CU7000, AU7000, BU8000) är medvetet utelämnade: kantbelysta paneler utan
// lokal dimning, där du betalar för storleken och inte för bilden.
//
// `p`  — regex mot annonsrubriken, avgör om en träff verkligen är modellen
// `q`  — sökord att skicka till search_blocket (ren nyckelordssökning)

export const TESTVINNARE = [
  // 2026
  { k: "LG C6",        ar: 2026, p: /oled(48|55|65|77)?c6|\bc6\b/i,        q: ["OLED55C6", "LG C6 OLED", "OLED65C6"] },
  { k: "LG G6",        ar: 2026, p: /oled(55|65|77)?g6|\bg6\b/i,           q: ["OLED55G6", "LG G6 OLED"] },
  { k: "Samsung S95G", ar: 2026, p: /s95g|s90g/i,                          q: ["S95G", "Samsung S95G", "S90G"] },

  // 2025
  { k: "LG C5",          ar: 2025, p: /oled(42|48|55|65|77)?c5|\bc5\b/i,   q: ["OLED55C5", "OLED65C5", "LG C5 OLED"] },
  { k: "LG G5",          ar: 2025, p: /oled(55|65|77)?g5|\bg5\b/i,         q: ["OLED55G5", "OLED65G5", "LG G5 OLED"] },
  { k: "Samsung S95F",   ar: 2025, p: /s95f/i,                             q: ["S95F", "QE55S95F", "Samsung S95F"] },
  { k: "Samsung S90F",   ar: 2025, p: /s90f/i,                             q: ["S90F", "QE55S90F", "Samsung S90F"] },
  { k: "Samsung QN90F",  ar: 2025, p: /qn90f/i,                            q: ["QN90F", "QE55QN90F", "Samsung QN90F"] },
  { k: "Sony Bravia 8 II", ar: 2025, p: /bravia 8 ii|xr(55|65)?b8/i,       q: ["Bravia 8 II", "Sony Bravia 8 II QD-OLED"] },
  { k: "Philips OLED810", ar: 2025, p: /oled810|oled910/i,                 q: ["OLED810", "Philips OLED910"] },
  { k: "Panasonic Z95B", ar: 2025, p: /z95b/i,                             q: ["Z95B", "Panasonic Z95B"] },

  // 2024
  { k: "LG C4",          ar: 2024, p: /oled(42|48|55|65|77)?c4|\bc4\b/i,   q: ["OLED55C4", "OLED65C4", "LG C4 OLED"] },
  { k: "LG G4",          ar: 2024, p: /oled(55|65|77)?g4|\bg4\b/i,         q: ["OLED55G4", "OLED65G4", "LG G4 OLED"] },
  { k: "Samsung S95D",   ar: 2024, p: /s95d/i,                             q: ["S95D", "QE55S95D", "Samsung S95D"] },
  { k: "Samsung S90D",   ar: 2024, p: /s90d/i,                             q: ["S90D", "QE55S90D", "Samsung S90D"] },
  { k: "Samsung QN90D",  ar: 2024, p: /qn90d|qn95d/i,                      q: ["QN90D", "QE55QN90D", "Samsung QN95D"] },
  { k: "Sony Bravia 8",  ar: 2024, p: /bravia 8|k-?(55|65)xr80|xr80/i,     q: ["Bravia 8 OLED", "K-55XR80", "Sony Bravia 8"] },
  { k: "Sony Bravia 9",  ar: 2024, p: /bravia 9|xr90|k-?(65|75)xr90/i,     q: ["Bravia 9", "K-65XR90", "Sony Bravia 9 mini LED"] },
  { k: "Philips OLED809", ar: 2024, p: /oled809|oled909/i,                 q: ["OLED809", "Philips OLED909", "55OLED809"] },
  { k: "Panasonic Z95A", ar: 2024, p: /z95a|z93a/i,                        q: ["Z95A", "Panasonic Z95A", "TX-55Z95A"] },
  { k: "Hisense U8N",    ar: 2024, p: /u8n|u8k/i,                          q: ["Hisense U8N", "U8NQ", "Hisense U8K"] },
  { k: "TCL C845",       ar: 2024, p: /c845|c855/i,                        q: ["TCL C845", "TCL C855"] },

  // 2023
  { k: "LG C3",          ar: 2023, p: /oled(42|48|55|65|77)?c3|\bc3\b/i,   q: ["OLED55C3", "OLED65C3", "LG C3 OLED"] },
  { k: "LG G3",          ar: 2023, p: /oled(55|65|77)?g3|\bg3\b/i,         q: ["OLED55G3", "OLED65G3", "LG G3 OLED MLA"] },
  { k: "Samsung S95C",   ar: 2023, p: /s95c/i,                             q: ["S95C", "QE55S95C", "Samsung S95C QD-OLED"] },
  { k: "Samsung S90C",   ar: 2023, p: /s90c/i,                             q: ["S90C", "QE55S90C", "Samsung S90C QD-OLED"] },
  { k: "Samsung QN90C",  ar: 2023, p: /qn90c|qn95c/i,                      q: ["QN90C", "QE55QN90C", "Samsung QN95C"] },
  { k: "Sony A95L",      ar: 2023, p: /a95l/i,                             q: ["A95L", "XR-55A95L", "Sony A95L QD-OLED"] },
  { k: "Sony X90L",      ar: 2023, p: /x90l|x95l/i,                        q: ["X90L", "XR-55X90L", "Sony X95L"] },
  { k: "Philips OLED808", ar: 2023, p: /oled808|oled908/i,                 q: ["OLED808", "55OLED808", "Philips OLED908"] },
  { k: "Panasonic MZ1500", ar: 2023, p: /mz1500|mz2000/i,                  q: ["MZ1500", "MZ2000", "Panasonic MZ"] },

  // 2022
  { k: "LG C2",          ar: 2022, p: /oled(42|48|55|65|77)?c2|\bc2\b/i,   q: ["OLED55C2", "OLED65C2", "LG C2 OLED"] },
  { k: "LG G2",          ar: 2022, p: /oled(55|65|77)?g2|\bg2\b/i,         q: ["OLED55G2", "OLED65G2", "LG G2 OLED"] },
  { k: "Samsung S95B",   ar: 2022, p: /s95b/i,                             q: ["S95B", "QE55S95B", "Samsung S95B QD-OLED"] },
  { k: "Samsung QN90B",  ar: 2022, p: /qn90b/i,                            q: ["QN90B", "QE55QN90B", "Samsung QN90B Neo QLED"] },
  { k: "Sony A95K",      ar: 2022, p: /a95k/i,                             q: ["A95K", "XR-55A95K", "Sony A95K QD-OLED"] },
  { k: "Sony A80K",      ar: 2022, p: /a80k/i,                             q: ["A80K", "XR-55A80K", "Sony A80K OLED"] },
  { k: "Philips OLED807", ar: 2022, p: /oled807/i,                         q: ["OLED807", "55OLED807", "Philips OLED807"] },
  { k: "Panasonic LZ1500", ar: 2022, p: /lz1500|lz2000/i,                  q: ["LZ1500", "TX-55LZ1500", "LZ2000"] },

  // 2021
  { k: "LG C1",          ar: 2021, p: /oled(48|55|65|77)?c1|\bc1\b/i,      q: ["OLED55C1", "OLED65C1", "LG C1 OLED"] },
  { k: "LG G1",          ar: 2021, p: /oled(55|65|77)?g1|\bg1\b/i,         q: ["OLED55G1", "LG G1 OLED"] },
  { k: "Sony A90J",      ar: 2021, p: /a90j/i,                             q: ["A90J", "XR-55A90J", "Sony A90J"] },
  { k: "Sony A80J",      ar: 2021, p: /a80j/i,                             q: ["A80J", "XR-55A80J", "Sony A80J"] },
  { k: "Samsung QN90A",  ar: 2021, p: /qn90a/i,                            q: ["QN90A", "QE55QN90A", "Samsung QN90A Neo QLED"] },
  { k: "Philips OLED806", ar: 2021, p: /oled806|oled856/i,                 q: ["OLED806", "Philips OLED806", "OLED856"] },
  { k: "Panasonic JZ1000", ar: 2021, p: /jz1000|jz2000/i,                  q: ["JZ1000", "JZ2000", "Panasonic JZ"] },

  // 2020 — bortre gränsen. Äldre än så och stoppregel tre biter nästan alltid.
  { k: "LG CX",          ar: 2020, p: /oled(48|55|65|77)?cx|\bcx\b/i,      q: ["OLED55CX", "OLED65CX", "LG CX OLED"] },
  { k: "LG GX",          ar: 2020, p: /oled(55|65)?gx|\bgx\b/i,            q: ["OLED55GX", "LG GX OLED"] },
  { k: "Samsung Q90T",   ar: 2020, p: /q90t|q95t/i,                        q: ["Q90T", "QE55Q90T", "Samsung Q95T"] },
  { k: "Sony XH90",      ar: 2020, p: /xh9005|xh90\b|x900h/i,              q: ["KD-55XH9005", "XH9005", "Sony XH90"] },
  { k: "Philips OLED805", ar: 2020, p: /oled805|oled855/i,                 q: ["OLED805", "Philips OLED805", "OLED855"] },
  { k: "Panasonic HZ1000", ar: 2020, p: /hz1000|hz2000/i,                  q: ["HZ1000", "HZ2000", "Panasonic HZ"] },
];

// Breda sökord för när modellen inte spelar roll — extrarum, källare, garage.
// Här är kravet bara att den är stor, fungerar och är billig.
export const BUDGET_SOKORD = [
  "55 tum tv", '55" tv', "55 tums smart tv", "smart tv 55 tum", "samsung 55 tum",
  "lg 55 tum tv", "sony 55 tum tv", "philips 55 tum tv", "55 tum 4k",
  "tv 55 tum billig", "55 tum led tv", "panasonic 55 tum", "hisense 55 tum",
  "tcl 55 tum", "55 tum tv säljes",
];

// Rubriker som matchar storlek och märke men inte är en TV: väggfästen,
// fötter, fjärrkontroller, reservdelar, köpes-annonser.
const TILLBEHOR = /v[äa]ggf[äa]ste|fotstativ|\bstativ\b|tv-?st[äa]ll|\bfot\b|fj[äa]rrkontroll|\bram\b/;
const DEFEKT_ELLER_KOPES = /reservdel|trasig|spr[äa]ck|startar inte|k[öo]pes|vi k[öo]per|\bs[öo]kes\b/i;

// "LG C4 55'' i nyskick ink väggfäste" är en TV som får ett väggfäste på
// köpet. "Nytt TV-väggfäste Andersson 23–55 tum" är ett väggfäste. Skillnaden
// är om tillbehöret är huvudordet eller bara nämns som medföljande — så plocka
// bort de medföljande omnämnandena innan rubriken bedöms.
const MEDFOLJER = new RegExp(
  `\\b(ink|inkl|inklusive|med|plus|och|\\+)\\s+\\w*\\s*(?:${TILLBEHOR.source})\\b|` +
    `(?:${TILLBEHOR.source})\\s+(ing[åa]r|medf[öo]ljer|p[åa] k[öo]pet)`,
  "gi",
);

export function inteEnTv(rubrik) {
  const kvar = rubrik.replace(MEDFOLJER, " ");
  return new RegExp(TILLBEHOR.source, "i").test(kvar) || DEFEKT_ELLER_KOPES.test(rubrik);
}

// Bakåtkompatibelt alias för den som bara vill ha regexen.
export const INTE_EN_TV = new RegExp(`${TILLBEHOR.source}|${DEFEKT_ELLER_KOPES.source}`, "i");

export const REGIONER = {
  stockholm:
    /(stockholm|solna|sundbyberg|bromma|h[äa]gersten|s[öo]dermalm|vasastan|kungsholmen|[öo]stermalm|[åa]rsta|enskede|johanneshov|liljeholmen|[äa]lvsj[öo]|bandhagen|farsta|sk[äa]rholmen|v[äa]llingby|h[äa]sselby|sp[åa]nga|kista|akalla|t[äa]by|danderyd|sollentuna|j[äa]rf[äa]lla|huddinge|segeltorp|skarpn[äa]ck|nacka|saltsj[öo]|tyres[öo]|haninge|handen|liding[öo]|upplands|v[äa]sby|sk[öo]ndal|bagarmossen|botkyrka|tumba|norsborg|tullinge|skog[åa]s|tr[åa]ngsund|jordbro|v[äa]sterhaninge|nyn[äa]shamn|r[öo]nninge|salem|sigtuna|m[äa]rsta|vallentuna|[åa]kersberga|[öo]ster[åa]ker|eker[öo]|gustavsberg|v[äa]rmd[öo]|rotebro|kungs[äa]ngen|jakobsberg|barkarby|huvudsta|hammarby|midsommarkransen|telefonplan|fru[äa]ngen|[äa]lta|ektorp|orminge|fisks[äa]tra|vaxholm|boo)/i,
  malardalen:
    /(v[äa]ster[åa]s|uppsala|eskilstuna|nyk[öo]ping|s[öo]dert[äa]lje|enk[öo]ping|str[äa]ngn[äa]s|k[öo]ping|mariefred|norrt[äa]lje|gnesta|trosa)/i,
  goteborg: /(g[öo]teborg|m[öo]lndal|partille|fr[öo]lunda|angered|kungsbacka|kung[äa]lv|lerum|h[äa]rryda|askim|hisings)/i,
  skane: /(malm[öo]|lund|helsingborg|landskrona|h[öo]llviken|limhamn|bunkeflo|[äa]ngelholm|trelleborg|eslöv|kristianstad|h[äa]ssleholm)/i,
  alla: /./,
};

// Ankarpunkter för --hem. Koordinaterna är hämtade ur Blocket självt:
// medelvärdet av koordinaterna för annonser på respektive ort, vilket träffar
// ortens tyngdpunkt bättre än en godtycklig centrumpunkt.
export const ORTER = {
  spanga: { lat: 59.3825, lon: 17.9026 },
  stockholm: { lat: 59.3326, lon: 18.0649 },
  goteborg: { lat: 57.7089, lon: 11.9746 },
  malmo: { lat: 55.6050, lon: 13.0038 },
  uppsala: { lat: 59.8586, lon: 17.6389 },
};
