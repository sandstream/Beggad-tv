#!/usr/bin/env node
// Mätkohort: ett systematiskt urval annonser som följs tills de försvinner,
// för att kunna svara på om underprissatta annonser säljs snabbare.
//
//   node kohort.mjs --fanga     # fånga in nya annonser i kohorten
//   node kohort.mjs --status    # hur stor är den, och hur gammal
//
// Varför en egen lista i stället för att bredda följlistan: följlistan är
// kuraterad — den innehåller annonser vi tyckte var intressanta, och
// intressant korrelerar med billig. Mäter man på den får man svar på hur
// snabbt annonser man gillar försvinner, inte om kap säljs snabbare. Kohorten
// tar in allt som matchar formatet, oavsett om det är köpvärt, prissatt
// rimligt eller ens OLED.
//
// Kohortens medlemmar rapporteras aldrig till användaren. De finns bara för
// att räknas.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { skapaSokare } from "./blocket.mjs";
import { inteEnTv } from "./modeller.js";

const HAR = dirname(fileURLToPath(import.meta.url));
export const KOHORT = join(HAR, "bevakning", "kohort.json");
const UTFALL = join(HAR, "bevakning", "utfall.json");

// Taket håller nere belastningen på ett gratis och inofficiellt API. Blir
// kohorten större än så väljs medlemmarna slumpmässigt, inte efter pris —
// ett urval på pris hade återinfört precis den bias kohorten ska undvika.
const TAK = 200;
const MINSTA_GRUPP = 8; // färre än så och medianen är ingen marknad

const SOKORD = [];
for (const t of ["55"]) SOKORD.push(`${t} tum tv`, `${t} tums smart tv`, `tv ${t} tum`, `${t} tum 4k`);
SOKORD.push(
  "oled tv", "qled tv", "smart tv", "4k tv", "lg oled", "samsung qled",
  "sony bravia", "philips tv", "led tv", "uhd tv", "tv säljes",
);

export function las(fil, standard) {
  try {
    return JSON.parse(readFileSync(fil, "utf8"));
  } catch {
    return standard;
  }
}

function skriv(fil, data) {
  mkdirSync(dirname(fil), { recursive: true });
  writeFileSync(fil, JSON.stringify(data, null, 2) + "\n");
}

const median = (tal) => {
  const s = [...tal].sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

/** Fångar in nya annonser i kohorten. Befintliga medlemmar rörs inte — deras
 *  egenskaper ska vara de som gällde när de fångades. */
export async function fanga() {
  const kohort = las(KOHORT, {});
  const sok = await skapaSokare({ direkt: true });
  const sedda = new Map();
  for (const q of SOKORD) {
    try {
      for (const it of await sok(q)) sedda.set(it.id, it);
    } catch (e) {
      process.stderr.write(`${q}: ${e.message}\n`);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  const kandidater = [];
  for (const i of sedda.values()) {
    const tum = Number((i.title.match(/(?<![0-9])(55)(?![0-9])/) || [])[1]);
    if (!tum || !i.price || i.price < 300 || !i.endDate || inteEnTv(i.title)) continue;
    if (kohort[i.id]) continue;
    kandidater.push({
      id: i.id,
      titel: i.title,
      pris: i.price,
      tum,
      oled: /oled/i.test(i.title),
      annonsdagar: Math.floor((Date.now() - Date.parse(i.endDate)) / 86400000),
    });
  }

  // Prisläget räknas inom storlek och paneltyp, så att "billig" inte bara
  // betyder "mindre skärm" eller "sämre panel".
  const grupper = new Map();
  for (const k of kandidater) {
    const g = `${k.tum}-${k.oled ? "oled" : "led"}`;
    if (!grupper.has(g)) grupper.set(g, []);
    grupper.get(g).push(k);
  }
  for (const [g, lista] of grupper) {
    if (lista.length < MINSTA_GRUPP) continue;
    const m = median(lista.map((x) => x.pris));
    for (const k of lista) {
      k.grupp = g;
      k.marknad = m;
      k.underMarknad = Math.round((1 - k.pris / m) * 100);
    }
  }

  let nya = kandidater.filter((k) => k.underMarknad != null);
  const plats = TAK - Object.keys(kohort).length;
  if (plats <= 0) {
    console.log(`Kohorten är full (${Object.keys(kohort).length} av ${TAK}).`);
    return;
  }
  if (nya.length > plats) {
    // Slumpmässigt urval. Att ta de billigaste eller de närmaste hade gjort
    // kohorten lika sned som följlistan.
    for (let i = nya.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [nya[i], nya[j]] = [nya[j], nya[i]];
    }
    nya = nya.slice(0, plats);
  }

  const idag = new Date().toISOString().slice(0, 10);
  for (const k of nya) {
    kohort[k.id] = { ...k, fangad: idag };
    delete kohort[k.id].id;
  }
  skriv(KOHORT, kohort);
  console.log(
    `${nya.length} nya medlemmar (${kandidater.length} kandidater, ${kandidater.length - nya.length} utanför grupper med minst ${MINSTA_GRUPP}).`,
  );
  console.log(`Kohorten är nu ${Object.keys(kohort).length} annonser.`);
}

/** Kollar kohorten och loggar de som försvunnit. Returnerar antalet, inget
 *  annat — medlemmarna ska aldrig rapporteras till användaren. */
export async function kollaKohort(hamtaAnnons) {
  const kohort = las(KOHORT, {});
  const ids = Object.keys(kohort);
  if (!ids.length) return { kollade: 0, forsvunna: 0 };

  const utfall = las(UTFALL, []);
  let forsvunna = 0;
  const idag = new Date().toISOString().slice(0, 10);

  // Serieanrop tog nio och en halv minut vid 120 medlemmar — uppströms svarar
  // på flera sekunder, så väntan dominerar helt. Fyra parallella anrop är
  // fortfarande skonsamt mot ett gratis-API och tar bort det mesta av tiden.
  const PARALLELLA = 4;
  const ko = [...ids];
  const svar = new Map();
  await Promise.all(
    Array.from({ length: PARALLELLA }, async () => {
      while (ko.length) {
        const id = ko.shift();
        svar.set(id, await hamtaAnnons(id));
        await new Promise((r) => setTimeout(r, 250));
      }
    }),
  );

  for (const id of ids) {
    const f = kohort[id];
    const nu = svar.get(id);
    if (nu === undefined) continue; // nätfel — låt posten ligga kvar
    if (nu === null) {
      const dagarFoljd = Math.round((Date.now() - Date.parse(f.fangad)) / 86400000);
      utfall.push({
        id,
        titel: f.titel,
        pris: f.pris,
        hittad: f.fangad,
        forsvann: idag,
        dagarFoljd,
        annonsdagarVidStart: f.annonsdagar,
        totalAlder: f.annonsdagar + dagarFoljd,
        underMarknad: f.underMarknad,
        kohort: true,
      });
      delete kohort[id];
      forsvunna++;
      continue;
    }
    if (nu.pris != null) kohort[id].pris = nu.pris;
  }

  skriv(KOHORT, kohort);
  if (forsvunna) skriv(UTFALL, utfall);
  // Bara de som faktiskt svarade räknas som kollade. Att räkna alla hade fått
  // en körning utan nät att se ut som "200 kollade, 0 försvunna".
  const misslyckade = ids.filter((id) => svar.get(id) === undefined).length;
  return { kollade: ids.length - misslyckade, misslyckade, forsvunna };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const flagg = new Set(process.argv.slice(2));
  if (flagg.has("--fanga")) {
    await fanga();
  } else {
    const kohort = las(KOHORT, {});
    const poster = Object.values(kohort);
    console.log(`${poster.length} annonser i kohorten (tak ${TAK})`);
    if (poster.length) {
      const hinkar = [
        ["15%+ under", (k) => k.underMarknad >= 15],
        ["0–15% under", (k) => k.underMarknad >= 0 && k.underMarknad < 15],
        ["över marknad", (k) => k.underMarknad < 0],
      ];
      for (const [namn, test] of hinkar) {
        console.log(`  ${namn.padEnd(16)} ${poster.filter(test).length}`);
      }
      const utfall = las(UTFALL, []).filter((u) => u.kohort);
      console.log(`${utfall.length} utfall loggade från kohorten`);
    }
  }
  process.exit(0);
}
