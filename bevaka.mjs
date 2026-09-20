#!/usr/bin/env node
// Daglig bevakning. Kör de sparade sökningarna, jämför mot vad som redan
// rapporterats, och skriver ut bara det som är nytt.
//
//   node bevaka.mjs                 # direktläge, skriver rapport till stdout
//   node bevaka.mjs --mcp           # via begagnad-mcp i stället
//   node bevaka.mjs --torr          # rapportera utan att uppdatera historiken
//
// Historiken ligger i bevakning/sedda.json och ska committas — det är den som
// gör att en färsk container vet vad som redan rapporterats igår.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { skapaSokare, avstand } from "./blocket.mjs";
import { TESTVINNARE, inteEnTv, ORTER } from "./modeller.js";
import { bedomKap } from "./vardering.js";

const HAR = dirname(fileURLToPath(import.meta.url));
const HISTORIK = join(HAR, "bevakning", "sedda.json");
const FOLJER = join(HAR, "bevakning", "foljer.json");
const HEM = ORTER.spanga;

const argv = process.argv.slice(2);
const flagg = new Set(argv);
const torr = flagg.has("--torr");
// --folj 26730987,26747541 lägger till annonser i följlistan utan att söka.
const foljArg = argv[argv.indexOf("--folj") + 1];
const attFolja = flagg.has("--folj") && foljArg ? foljArg.split(",").map((s) => s.trim()) : [];

// Vad vi letar efter. Kriterierna är destillatet av hela researchen:
// 55 tum för att 65 inte får plats, och OLED för att rummet är mörklagt.
//
// Årsgränsen går vid 2019, inte 2021. Det ursprungliga kravet "2021 och nyare"
// var en förenkling — det som ska vara ett steg upp från Ambilight-LED:en som
// redan sitter uppe är paneltekniken, inte årtalet. En C9 från 2019 har både
// HDMI 2.1 och 120 Hz och slår flera senare insteg.
//
// Bara OLED matchas: mini-LED (QN90-serien, Q90R/Q90T) och Full Array LED
// (X90-serien, Bravia 9) lyser runt ljusa objekt i mörker och hör inte hit,
// även om de ligger i modellkatalogen för den interaktiva sökningen.
const AR_ELDST = 2019;
// LG:s A-serie är insteg — 60 Hz och ingen HDMI 2.1 — men panelen är äkta
// OLED och svärtan densamma. I ett mörklagt rum för film är den fullt
// gångbar, så den bevakas. Den levereras dessutom ofta utan fot, vilket
// rapporten ska fråga om.
const OLED =
  /^LG [CGEBA](X|[1-9])$|^Sony (A[89]|Bravia 8)|^Sam(sung)? S9[05]|^Phil OLED|^Pana /;

const BEVAKNINGAR = [
  {
    namn: `Biorums-TV — 55" OLED, ${AR_ELDST}+`,
    maxpris: 9000,
    modeller: TESTVINNARE.filter((m) => m.ar >= AR_ELDST && OLED.test(m.k)),
    storlek: /(?<![0-9])55(?![0-9])/,
  },
];

// Sonos söks på fritext — det finns ingen modellkatalog för högtalare.
const SONOS = {
  namn: "Sonos — Beam Gen 2 och Sub, svart",
  maxpris: 8000,
  fragor: [
    "sonos beam gen 2 svart",
    "sonos beam svart",
    "sonos sub svart",
    "sonos sub gen 3 svart",
    "sonos sub gen 2 svart",
  ],
  passar: (t) =>
    /sonos/i.test(t) &&
    /beam|\bsub\b|subwoofer/i.test(t) &&
    // Vit utesluts på krav, mini för att den är underdimensionerad, och
    // tillbehör för att ett väggfäste till en Beam inte är en Beam.
    !/\bvit\b|vitt|white|mini/i.test(t) &&
    !/f[äa]ste|h[åa]llare|stativ|mount|bracket/i.test(t),
};

function lasHistorik() {
  try {
    return JSON.parse(readFileSync(HISTORIK, "utf8"));
  } catch {
    return { rapporterade: {}, senastKord: null };
  }
}

function lasFoljer() {
  try {
    return JSON.parse(readFileSync(FOLJER, "utf8"));
  } catch {
    return {};
  }
}

// Hämtar en enskild annons. Uppströms svarar 200 även för borttagna annonser,
// med ett error-fält i stället för innehåll — så frånvaron av itemData är det
// som betyder "borta", inte HTTP-statusen.
async function hamtaAnnons(id) {
  try {
    const res = await fetch(`https://blocket-api.se/v1/ad/recommerce?id=${id}`);
    const d = await res.json();
    const it = d?.loaderData?.["item-recommerce"]?.itemData;
    if (!it || it.title == null) return null;
    return {
      titel: it.title,
      pris: typeof it.price === "number" ? it.price : (it.price?.amount ?? null),
      plats: it.location?.postalName || "",
      url: `https://www.blocket.se/recommerce/forsale/item/${id}`,
    };
  } catch {
    return undefined; // nätfel — skilj från bekräftat borttagen
  }
}

// Går igenom annonserna vi följer och rapporterar det bevakningen annars
// missar: att en annons försvinner, eller att priset ändras. En sänkning på
// en annons vi redan bedömt är en starkare köpsignal än en ny träff.
async function kollaFoljda(foljer) {
  const borta = [];
  const andrade = [];
  for (const [id, f] of Object.entries(foljer)) {
    const nu = await hamtaAnnons(id);
    await new Promise((r) => setTimeout(r, 200));
    if (nu === undefined) continue; // nätfel, låt posten ligga kvar
    if (nu === null) {
      borta.push({ id, ...f });
      delete foljer[id];
      continue;
    }
    if (nu.pris != null && f.pris != null && nu.pris !== f.pris) {
      andrade.push({ id, ...f, nyttPris: nu.pris });
    }
    foljer[id] = { titel: nu.titel, pris: nu.pris, url: nu.url, sedan: f.sedan };
  }
  return { borta, andrade };
}

function berika(i) {
  return {
    id: i.id,
    pris: i.price,
    titel: i.title,
    plats: i.location,
    url: i.url,
    avstand: i.coordinates ? avstand(HEM, i.coordinates) : null,
    dagar: i.endDate
      ? Math.floor((Date.now() - Date.parse(i.endDate)) / 86400000)
      : null,
  };
}

const foljer = lasFoljer();

// --folj: lägg till annonser i följlistan och sluta där.
if (attFolja.length) {
  for (const id of attFolja) {
    const a = await hamtaAnnons(id);
    if (!a) { console.log(`${id}: kunde inte hämtas`); continue; }
    foljer[id] = { ...a, sedan: new Date().toISOString().slice(0, 10) };
    console.log(`följer ${id} — ${a.pris} kr — ${a.titel}`);
    await new Promise((r) => setTimeout(r, 200));
  }
  mkdirSync(dirname(FOLJER), { recursive: true });
  writeFileSync(FOLJER, JSON.stringify(foljer, null, 2) + "\n");
  process.exit(0);
}

const { borta, andrade } = await kollaFoljda(foljer);

const sok = await skapaSokare({ direkt: !flagg.has("--mcp") });
const historik = lasHistorik();
const nya = [];
const allaSedda = { ...historik.rapporterade };
const paus = (ms) => new Promise((r) => setTimeout(r, ms));

for (const b of BEVAKNINGAR) {
  for (const m of b.modeller) {
    const sedda = new Map();
    for (const q of m.q) {
      try {
        for (const it of await sok(q)) sedda.set(it.id, it);
      } catch (e) {
        process.stderr.write(`${q}: ${e.message}\n`);
      }
      await paus(250);
    }
    // Alla träffar på modellen, inte bara de nya — de utgör jämförelsematerialet
    // som avgör om en ny annons är ett kap eller bara ett pris.
    const matchande = [...sedda.values()].filter(
      (i) =>
        m.p.test(i.title) &&
        b.storlek.test(i.title) &&
        i.price &&
        i.price <= b.maxpris &&
        !inteEnTv(i.title),
    );
    const priser = matchande.map((i) => i.price);

    for (const i of matchande) {
      allaSedda[i.id] = true;
      if (!historik.rapporterade[i.id]) {
        const r = berika(i);
        const jamforbara = priser.filter((_, n) => matchande[n].id !== i.id);
        nya.push({
          ...r,
          bevakning: b.namn,
          modell: m.k,
          ar: m.ar,
          kap: jamforbara.length ? bedomKap({ begart: i.price, jamforbara }) : null,
        });
        foljer[i.id] = { titel: r.titel, pris: r.pris, url: r.url, sedan: new Date().toISOString().slice(0, 10) };
      }
    }
  }
}

{
  const sedda = new Map();
  for (const q of SONOS.fragor) {
    try {
      for (const it of await sok(q)) sedda.set(it.id, it);
    } catch (e) {
      process.stderr.write(`${q}: ${e.message}\n`);
    }
    await paus(250);
  }
  for (const i of sedda.values()) {
    if (!SONOS.passar(i.title) || !i.price || i.price > SONOS.maxpris) continue;
    allaSedda[i.id] = true;
    if (!historik.rapporterade[i.id]) {
      const r = berika(i);
      nya.push({ ...r, bevakning: SONOS.namn });
      foljer[i.id] = { titel: r.titel, pris: r.pris, url: r.url, sedan: new Date().toISOString().slice(0, 10) };
    }
  }
}

if (sok.stang) await sok.stang();

for (const b of borta) {
  console.log(`## BORTA — ${b.titel}\n`);
  console.log(`Såld eller tillbakadragen. Låg på ${b.pris} kr.`);
  console.log(`${b.url}\n`);
}
for (const a of andrade) {
  const riktning = a.nyttPris < a.pris ? "SÄNKT" : "HÖJT";
  console.log(`## ${riktning} — ${a.titel}\n`);
  console.log(`${a.pris} → ${a.nyttPris} kr`);
  console.log(`${a.url}\n`);
}

if (nya.length === 0 && borta.length === 0 && andrade.length === 0) {
  console.log("INGET NYTT");
} else if (nya.length === 0) {
  // borta/ändrade är redan utskrivna
} else {
  console.log(`${nya.length} nya träffar\n`);
  const grupper = new Map();
  for (const n of nya) {
    if (!grupper.has(n.bevakning)) grupper.set(n.bevakning, []);
    grupper.get(n.bevakning).push(n);
  }
  for (const [rubrik, rader] of grupper) {
    console.log(`## ${rubrik}\n`);
    for (const n of rader.sort((a, b) => a.pris - b.pris)) {
      const km = n.avstand != null ? `${n.avstand} km` : n.plats;
      const modell = n.modell ? `${n.modell} (${n.ar}) — ` : "";
      console.log(`${n.pris} kr · ${km} · ${n.dagar ?? "?"} dgr gammal`);
      console.log(`${modell}${n.titel}`);
      if (n.kap?.motMarknad?.otillrackligt) {
        console.log(n.kap.motMarknad.rad);
      } else if (n.kap?.motMarknad) {
        const k = n.kap.motMarknad;
        console.log(
          `${k.procentUnder}% mot ${n.kap.marknad} kr (${k.underlag} jämförbara) → ${k.klass.toUpperCase()}. ${k.rad}`,
        );
      }
      console.log(`${n.url}\n`);
    }
  }
}

if (!torr) {
  mkdirSync(dirname(HISTORIK), { recursive: true });
  writeFileSync(
    HISTORIK,
    JSON.stringify(
      { senastKord: new Date().toISOString(), rapporterade: allaSedda },
      null,
      2,
    ) + "\n",
  );
  writeFileSync(FOLJER, JSON.stringify(foljer, null, 2) + "\n");
  process.stderr.write(
    `\nHistorik: ${Object.keys(allaSedda).length} annonser | följer: ${Object.keys(foljer).length}\n`,
  );
}

process.exit(0);
