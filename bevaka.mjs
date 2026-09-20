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

const HAR = dirname(fileURLToPath(import.meta.url));
const HISTORIK = join(HAR, "bevakning", "sedda.json");
const HEM = ORTER.spanga;

const flagg = new Set(process.argv.slice(2));
const torr = flagg.has("--torr");

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
const OLED =
  /^LG [CGEB](X|[1-9])$|^Sony (A[89]|Bravia 8)|^Sam(sung)? S9[05]|^Phil OLED|^Pana /;

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
    for (const i of sedda.values()) {
      if (!m.p.test(i.title) || !b.storlek.test(i.title)) continue;
      if (!i.price || i.price > b.maxpris || inteEnTv(i.title)) continue;
      allaSedda[i.id] = true;
      if (!historik.rapporterade[i.id]) {
        nya.push({ ...berika(i), bevakning: b.namn, modell: m.k, ar: m.ar });
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
      nya.push({ ...berika(i), bevakning: SONOS.namn });
    }
  }
}

if (sok.stang) await sok.stang();

if (nya.length === 0) {
  console.log("INGET NYTT");
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
  process.stderr.write(`\nHistorik: ${Object.keys(allaSedda).length} annonser\n`);
}

process.exit(0);
