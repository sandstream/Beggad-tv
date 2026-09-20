#!/usr/bin/env node
// Vad utfallen hittills säger om hur snabbt annonser försvinner.
//
//   node statistik.mjs
//
// Frågan den ska besvara: säljs underprissatta annonser snabbare, och i så
// fall hur mycket? Svaret kräver utfall, inte ögonblicksbilder — se
// kommentaren i bevaka.mjs om varför.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HAR = dirname(fileURLToPath(import.meta.url));
const UTFALL = join(HAR, "bevakning", "utfall.json");

// Under så här många utfall per grupp är skillnader brus. Två grupper om tio
// räcker för att se en stor effekt; mindre skillnader kräver betydligt fler.
const MINSTA_PER_GRUPP = 10;

let utfall = [];
try {
  utfall = JSON.parse(readFileSync(UTFALL, "utf8"));
} catch {
  console.log("Inga utfall loggade än. Kör bevaka.mjs dagligen — filen fylls på när följda annonser försvinner.");
  process.exit(0);
}

const med = (a) => {
  const s = [...a].sort((x, y) => x - y);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

const franKohort = utfall.filter((u) => u.kohort);
const franKortlistan = utfall.filter((u) => !u.kohort);
console.log(`${utfall.length} utfall loggade — ${franKohort.length} från kohorten, ${franKortlistan.length} från kortlistan\n`);

// Bara kohorten används för jämförelsen. Kortlistan är kuraterad: den
// innehåller annonser vi tyckte var intressanta, och intressant korrelerar
// med billig. Att räkna på den hade gett svar på hur snabbt annonser vi
// gillar försvinner, inte om kap säljs snabbare.
utfall = franKohort;
if (!utfall.length) {
  console.log("Kohorten har inga utfall än. Kortlistans utfall räknas inte — urvalet är snett.");
  process.exit(0);
}

// En annons som försvinner efter mycket lång tid har sannolikt löpt ut i
// stället för sålts. Blocket plockar bort gamla annonser automatiskt, så
// riktigt långa livslängder säger mer om annonstiden än om efterfrågan.
const GRANS_UTGANGEN = 60;
const medAlder = utfall.filter((u) => u.totalAlder != null);
const sannoliktSalda = medAlder.filter((u) => u.totalAlder < GRANS_UTGANGEN);
const sannoliktUtgangna = medAlder.filter((u) => u.totalAlder >= GRANS_UTGANGEN);

if (medAlder.length) {
  console.log(`Med känd total livslängd: ${medAlder.length}`);
  console.log(`  Under ${GRANS_UTGANGEN} dagar (sannolikt sålda): ${sannoliktSalda.length}, median ${med(sannoliktSalda.map((u) => u.totalAlder))} dagar`);
  console.log(`  ${GRANS_UTGANGEN} dagar eller mer (sannolikt utgångna): ${sannoliktUtgangna.length}\n`);
}

const hinkar = [
  ["kap (15%+ under)", (u) => u.underMarknad >= 15],
  ["nära marknad (0–15%)", (u) => u.underMarknad >= 0 && u.underMarknad < 15],
  ["över marknad", (u) => u.underMarknad < 0],
];

const medBedomning = sannoliktSalda.filter((u) => u.underMarknad != null);
if (!medBedomning.length) {
  console.log("Ingen av de försvunna annonserna hade en kap-bedömning vid upptäckt.");
  console.log("Bedömningar sparas först från och med att bevakningen kört ett tag.");
  process.exit(0);
}

console.log("Livslängd per prisläge (bara annonser under " + GRANS_UTGANGEN + " dagar)\n");
console.log("prisläge".padEnd(24), "n".padStart(4), "median dagar".padStart(14));
let jamforbart = 0;
for (const [namn, test] of hinkar) {
  const v = medBedomning.filter(test);
  if (v.length >= MINSTA_PER_GRUPP) jamforbart++;
  console.log(
    namn.padEnd(24),
    String(v.length).padStart(4),
    v.length ? String(med(v.map((u) => u.totalAlder))).padStart(14) : "–".padStart(14),
  );
}

console.log();
if (jamforbart < 2) {
  console.log(
    `För tunt för en slutsats. Minst ${MINSTA_PER_GRUPP} utfall i två grupper krävs innan\n` +
      "skillnaderna betyder något — dessförinnan är de brus.",
  );
} else {
  console.log(
    "Underlaget räcker för en jämförelse. Tolka ändå försiktigt: borttagen är\n" +
      "inte detsamma som såld, och vi ser bara annonser vi råkat följa.",
  );
}
