#!/usr/bin/env node
// Fritextsvep: 55-tums OLED som modellkatalogen INTE hittar.
//
//   node svep.mjs                 # allt inom radien, 55 och 65 tum
//   node svep.mjs --radie 40      # annan radie
//   node svep.mjs --storlek 65    # bara en storlek
//   node svep.mjs --alla          # även det bevakningen redan rapporterat
//
// Varför den finns: bevaka.mjs söker på modellkod, en kod i taget. Det ger
// precision men missar varje annons där säljaren inte skrev koden — och det
// är precis de annonserna som är felprissatta, eftersom en säljare som inte
// vet vad hen har inte heller vet vad den är värd.
//
// Två konkreta missar ligger bakom: en Philips POS9002 38 procent under
// marknad, och en LG C7. Båda hittades av ett handkört svep, båda låg utanför
// katalogen. Den här filen är det svepet, permanentat.
//
// Svepet ERSÄTTER inte bevakningen. Det kompletterar den, och rapporterar
// därför bara det katalogen inte redan fångar.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { skapaSokare, avstand } from "./blocket.mjs";
import { TESTVINNARE, inteEnTv, ORTER } from "./modeller.js";
import { bedomKap } from "./vardering.js";

const HAR = dirname(fileURLToPath(import.meta.url));
const HEM = ORTER.spanga;

const argv = process.argv.slice(2);
const flagg = new Set(argv);
const radie = Number(argv[argv.indexOf("--radie") + 1]) || 30;
const maxpris = Number(argv[argv.indexOf("--max") + 1]) || 9000;
const visaAlla = flagg.has("--alla");

// Breda frågor utan modellkod. Överlappet mellan dem är stort och avsiktligt:
// Blockets sökning rankar olika beroende på formulering, så samma annons kan
// synas på en fråga och saknas på nästa.
const STORLEKAR = (argv[argv.indexOf("--storlek") + 1] || "").match(/^[\d,]+$/)
  ? argv[argv.indexOf("--storlek") + 1].split(",").map(Number)
  : [55, 65];

const FRAGOR = ["oled smart tv", "oled tv", "lg oled", "sony oled", "philips oled", "panasonic oled"];
for (const t of STORLEKAR) {
  FRAGOR.push(`oled ${t}`, `${t} tum oled`, `oled tv ${t} tum`, `oled-tv ${t}`, `${t}" oled`, `${t} tums oled`, `lg oled ${t}`);
}

const STORLEK = new RegExp(`(?<![0-9])(${STORLEKAR.join("|")})(?![0-9])`, "i");
const storlekAv = (titel) => Number((titel.match(STORLEK) || [])[1]) || null;

// En annons katalogen redan matchar behöver inte svepas fram — bevakningen
// har den. Kvar blir de kodlösa, som är hela poängen.
const KATALOGEN = TESTVINNARE.map((m) => m.p);
const iKatalogen = (titel) => KATALOGEN.some((p) => p.test(titel));

function redanRapporterade() {
  try {
    return new Set(Object.keys(JSON.parse(readFileSync(join(HAR, "bevakning", "sedda.json"), "utf8")).rapporterade || {}));
  } catch {
    return new Set();
  }
}

const sok = await skapaSokare({ direkt: true });
const sedda = new Map();
for (const q of FRAGOR) {
  try {
    for (const it of await sok(q)) sedda.set(it.id, it);
  } catch (e) {
    process.stderr.write(`${q}: ${e.message}\n`);
  }
  await new Promise((r) => setTimeout(r, 200));
}

const kanda = redanRapporterade();
const nu = Date.now();
const traffar = [...sedda.values()]
  .filter((i) => i.price && i.price <= maxpris && STORLEK.test(i.title) && /oled/i.test(i.title) && !inteEnTv(i.title))
  .map((i) => ({
    id: i.id,
    titel: i.title,
    pris: i.price,
    tum: storlekAv(i.title),
    km: i.coordinates ? avstand(HEM, i.coordinates) : null,
    dagar: i.endDate ? Math.floor((nu - Date.parse(i.endDate)) / 86400000) : null,
    url: `https://www.blocket.se/recommerce/forsale/item/${i.id}`,
    katalog: iKatalogen(i.title),
    rapporterad: kanda.has(String(i.id)),
  }))
  .filter((t) => t.km == null || t.km <= radie);

// Medianen räknas på ALLA träffar inom radien, även de katalogen redan har —
// ett kap bedöms mot marknaden, inte mot urvalsresten. Men per storlek: en
// 65:a och en 55:a är olika varor, och en gemensam median hade dömt ut varje
// 65:a som dyr.
const marknad = (tum) => traffar.filter((t) => t.tum === tum).map((t) => t.pris);

const nya = traffar.filter((t) => visaAlla || (!t.katalog && !t.rapporterad)).sort((a, b) => a.pris - b.pris);

console.log(`${traffar.length} OLED ${STORLEKAR.join("/")}" inom ${radie} km under ${maxpris} kr — ${nya.length} utanför katalogen\n`);
for (const t of nya) {
  const d = bedomKap({ begart: t.pris, jamforbara: marknad(t.tum).filter((p) => p !== t.pris) });
  const dom = d.motMarknad?.klass ? `${d.motMarknad.procentUnder}% under — ${d.motMarknad.klass}` : "för tunt underlag";
  console.log(`${t.tum}"  ${String(t.pris).padStart(6)} kr  ${String(t.km ?? "?").padStart(5)} km  ${String(t.dagar ?? "?").padStart(3)}d  ${t.titel}`);
  console.log(`        ${dom}`);
  console.log(`        ${t.url}\n`);
}
if (!nya.length) console.log("Inget som katalogen inte redan ser.");
