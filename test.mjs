#!/usr/bin/env node
// Regressionstester för rubrikfiltret.
//
//   node test.mjs
//
// Filtret har släppt igenom fel två gånger, båda gångerna åt samma håll: en
// riktig TV kastades för att ett tillbehör nämndes i rubriken. Det kostade
// oss en LG C4 och nästan en 65-tums OLED med benen kvar. Varje nytt fall
// som dykt upp i verkligheten läggs till här.

import { inteEnTv } from "./modeller.js";
import { bedomKap } from "./vardering.js";

let fel = 0;
const lika = (fick, vantat, vad) => {
  const ok = JSON.stringify(fick) === JSON.stringify(vantat);
  if (!ok) { fel++; console.log(`FEL  ${vad}\n     fick ${JSON.stringify(fick)}, väntade ${JSON.stringify(vantat)}`); }
};

// En TV som nämner ett tillbehör är fortfarande en TV.
for (const t of [
  "LG 65 OLED 120 Hz Smart 4KUHD WiFi Bluetooth fjärrkontroll och ben ingår",
  "LG C4 55'' i nyskick ink väggfäste",
  "Sony 55 tum OLED, fot och fjärrkontroll medföljer",
  "LG OLED55C7V med fot på köpet",
  "Philips OLED 55 tum, stativ och fjärr ingår",
  "Samsung 55 tum QLED inklusive väggfäste",
  "LG OLED65C8PLA",
]) lika(inteEnTv(t), false, `är en TV: "${t}"`);

// Ett tillbehör är inte en TV, och inte heller en trasig eller sökt vara.
for (const t of [
  "Nytt TV-väggfäste Andersson 23-55 tum",
  "Fotstativ till LG OLED55C1",
  "Fjärrkontroll till LG smart TV",
  "Stativ till 65 tums TV",
  "Köpes: 55 tum OLED",
  "Trasig LG OLED 55",
  "LG OLED 55 med sprucken panel",
]) lika(inteEnTv(t), true, `är inte en TV: "${t}"`);

// Under tre jämförbara annonser ska ingen dom avges — en median av två kan
// vara ett paketpris och dömer då ut ett korrekt satt pris.
lika(bedomKap({ begart: 4000, jamforbara: [5000, 6000] }).motMarknad.otillrackligt, true, "två jämförbara = för tunt");
lika(bedomKap({ begart: 5000, jamforbara: [5000, 6000, 7000] }).motMarknad.klass, "kap", "17% under = kap");
lika(bedomKap({ begart: 4000, jamforbara: [5000, 6000, 7000] }).motMarknad.klass, "leta efter haken", "33% under = leta efter haken");
lika(bedomKap({ begart: 9000, jamforbara: [5000, 6000, 7000] }).motMarknad.klass, "över marknad", "dyrare än marknad");

console.log(fel ? `\n${fel} fel` : `Alla tester passerar.`);
process.exit(fel ? 1 : 0);
