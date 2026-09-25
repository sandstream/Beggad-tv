#!/usr/bin/env node
// Läser HELA annonstexten och flaggar det som står långt ner.
//
//   node granska.mjs 26419579 26730987
//
// Varför den finns: en Sony A87 rekommenderades som bästa köp på en
// beskrivning som klipptes vid 420 tecken. Sista stycket löd "den har dock en
// ljusskillnad längst upp och ner som man kan se på bilderna". Samma kapning
// dolde åt andra hållet att Panasonic-annonsen skrev "Originalfot ingår".
//
// Säljare lägger sällan defekten först. Den kommer efter specen.

import "./natverk.mjs";

const FLAGGOR = [
  [/inbr[äa]nn|burn.?in/gi, "inbränning"],
  [/d[öo]da? pixel|dead pixel/gi, "döda pixlar"],
  [/ljusskillnad|oj[äa]mn belys|oj[äa]mn ljus|banding|clouding|vignett/gi, "ojämn ljusstyrka"],
  [/fl[äa]ck|skugga p[åa]|m[äa]rke efter/gi, "fläck eller skugga"],
  [/repa|repor|skrap|bucklig/gi, "repor"],
  [/spricka|sprucken|spr[äa]ck|krossad|trasig/gi, "sprucken panel"],
  [/defekt|fungerar ej|fungerar inte|startar inte|fel p[åa]/gi, "uppgiven defekt"],
  [/lagat|reparerad|bytt panel|serviceat/gi, "reparerad"],
];

// Det som är värt att veta åt andra hållet, och som lika gärna står sist.
const BRA = [
  [/originalfot|fot ing[åa]r|f[öo]tter (finns|ing[åa]r)|ben ing[åa]r|bordsstativ/gi, "fot ingår"],
  [/kvitto/gi, "kvitto"],
  [/testas? (f[öo]re|innan)|f[åa]r testa/gi, "får testas"],
  [/kartong|f[öo]rpackning|originalkartong/gi, "kartong"],
  [/inga (synliga )?inbr[äa]nn/gi, "inga inbränningar (säljarens ord)"],
];

const ids = process.argv.slice(2).filter((a) => /^\d+$/.test(a));
if (!ids.length) {
  console.error("Ange ett eller flera annons-id: node granska.mjs 26419579");
  process.exit(1);
}

for (const id of ids) {
  let it;
  try {
    const d = await (await fetch(`https://blocket-api.se/v1/ad/recommerce?id=${id}`)).json();
    it = d?.loaderData?.["item-recommerce"]?.itemData;
  } catch (e) {
    console.log(`${id}: kunde inte hämtas (${e.message})\n`);
    continue;
  }
  if (!it?.title) { console.log(`${id}: borttagen\n`); continue; }

  // Hela texten, aldrig en förkortning. Det var kapningen som var felet.
  const txt = (it.description || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();

  const pris = it.price?.amount ?? it.price;
  console.log(`# ${it.title}`);
  console.log(`${pris} kr · ${it.location?.postalName || "?"} · ${it.isWebstore ? "FÖRETAG — konsumentköplagen gäller" : "privat"}`);
  console.log((it.extras || []).map((e) => `${e.label}: ${e.value}`).join(" · "));

  const traff = (lista) =>
    lista.flatMap(([re, namn]) => (txt.match(re) ? [namn] : []));
  const varning = traff(FLAGGOR);
  const plus = traff(BRA);
  if (varning.length) console.log(`\n⚠  ${varning.join(", ")}`);
  if (plus.length) console.log(`✓  ${plus.join(", ")}`);
  console.log(`\n${txt}\n`);
  console.log(`https://www.blocket.se/recommerce/forsale/item/${id}`);
  console.log("─".repeat(72));
  await new Promise((r) => setTimeout(r, 250));
}
