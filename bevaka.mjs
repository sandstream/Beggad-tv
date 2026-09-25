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
import { kollaKohort, fanga, las, KOHORT } from "./kohort.mjs";

const HAR = dirname(fileURLToPath(import.meta.url));
const HISTORIK = join(HAR, "bevakning", "sedda.json");
const FOLJER = join(HAR, "bevakning", "foljer.json");
const UTFALL = join(HAR, "bevakning", "utfall.json");
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
// Årsgränsen går vid 2016, alltså första OLED-generationerna. Den har flyttats
// två gånger, båda gångerna av samma skäl: det är paneltypen som avgör i ett
// mörklagt rum, inte modellåret. Först 2021 till 2019, sedan 2019 till 2016.
//
// Andra flytten kom av ett konkret missat objekt. En Philips POS9002 från 2017
// låg 38 procent under vad samma modell begär på andra håll, och syntes bara i
// ett fritextsvep som kördes för hand. Den såldes inom två dygn. Modeller som
// inte finns i katalogen kan bevakningen inte hitta.
//
// Bara OLED matchas: mini-LED (QN90-serien, Q90R/Q90T) och Full Array LED
// (X90-serien, Bravia 9) lyser runt ljusa objekt i mörker och hör inte hit,
// även om de ligger i modellkatalogen för den interaktiva sökningen.
const AR_ELDST = 2016;
// LG:s A-serie är insteg — 60 Hz och ingen HDMI 2.1 — men panelen är äkta
// OLED och svärtan densamma. I ett mörklagt rum för film är den fullt
// gångbar, så den bevakas. Den levereras dessutom ofta utan fot, vilket
// rapporten ska fråga om.
const OLED =
  /^LG [CGEBA](X|[1-9])$|^Sony (A[89]|Bravia 8)|^Sam(sung)? S9[05]|^Phil (OLED|POS)|^Pana /;

// 65 tum togs med när bänkens mått räknades efter: en 65:a är 144 cm bred,
// bänken 160, alltså sju centimeter luft på varje sida. Den får plats.
//
// Taket är detsamma för båda storlekarna, och det är avsiktligt. Medianen för
// en 65-tums OLED inom fyra mil ligger på drygt 13 000 kr, så 9 000 är långt
// under marknad — bara riktiga fynd tar sig igenom. För 55 tum ligger samma
// tak nära marknaden och släpper igenom mer.
const STORLEKAR = [55, 65];

// Fyndbevakningen. Taket låg först på 2 000 kr, men svepet den 25 september
// gav fyra träffar i hela landet och samtliga hade uppgiven defekt. Under
// 2 000 kr köper man inte en billig OLED utan en trasig. Golvet för en
// fungerande 55:a låg samma dag på 3 000 kr, så taket är höjt dit: det är
// där fynd faktiskt kan finnas.
//
// Kohorten säger att medianannonsen lever sex dagar. Den hinner man bara på
// om något tittar varje dag.
//
// Fot krävs inte längre — väggfäste gäller — så fotfrågan avgör inget här.
const FYND_TAK = 3000;

const BEVAKNINGAR = [
  {
    namn: `Biorums-TV — OLED ${STORLEKAR.join(" och ")} tum, ${AR_ELDST}+`,
    maxpris: 9000,
    modeller: TESTVINNARE.filter((m) => m.ar >= AR_ELDST && OLED.test(m.k)),
    storlekar: STORLEKAR,
  },
  {
    namn: `Fynd — OLED ${STORLEKAR.join(" och ")} tum under ${FYND_TAK} kr`,
    maxpris: FYND_TAK,
    modeller: TESTVINNARE.filter((m) => m.ar >= AR_ELDST && OLED.test(m.k)),
    storlekar: STORLEKAR,
    granska: true, // hämta hela annonstexten och läs defektorden
  },
];

// Under fyndtaket avgör panelens skick allt, och skicket står sist i texten,
// inte i rubriken. Rubrikfiltret räcker inte där.
const DEFEKT_I_TEXT =
  /inbr[äa]nn|burn.?in|d[öo]da? pixel|ljusskillnad|banding|clouding|spr[äa]ck|sprucken|krossad|defekt|funkar inte|fungerar ej/i;

async function defektord(id) {
  try {
    const d = await (await fetch(`https://blocket-api.se/v1/ad/recommerce?id=${id}`)).json();
    const txt = d?.loaderData?.["item-recommerce"]?.itemData?.description || "";
    return (txt.replace(/<[^>]+>/g, " ").match(DEFEKT_I_TEXT) || [])[0] || null;
  } catch {
    return null;
  }
}

/** Vilken av de bevakade storlekarna rubriken anger, eller null. */
function storlekIRubrik(titel, storlekar) {
  for (const t of storlekar) {
    if (new RegExp(`(?<![0-9])${t}(?![0-9])`).test(titel)) return t;
  }
  return null;
}

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
//
// En annons som markerats såld ligger däremot kvar med fullt innehåll och
// disposed=true (och meta.isInactive=true). Den räknas också som borta.
// Annars står sålda annonser kvar i följlistan och kohorten i veckor.
async function hamtaAnnons(id) {
  try {
    const res = await fetch(`https://blocket-api.se/v1/ad/recommerce?id=${id}`);
    const d = await res.json();
    const it = d?.loaderData?.["item-recommerce"]?.itemData;
    if (!it || it.title == null) return null;
    if (it.disposed === true || it.meta?.isInactive === true) return null;
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

// Varje annons som försvinner loggas med sina egenskaper vid upptäckt. Det
// är råmaterialet till frågan "säljs kap snabbare?", som inte går att besvara
// på en ögonblicksbild: de snabbsålda hinner aldrig synas bland levande
// annonser. Först när tillräckligt många utfall samlats går det att jämföra.
//
// Varning för tolkningen: borttagen betyder inte nödvändigtvis såld. Blocket
// plockar även bort annonser som löper ut, så en annons som försvinner efter
// två månader är sannolikt en utgången annons, inte en affär. Därför sparas
// både hur länge vi följt den och hur gammal annonsen var när vi hittade den.
function loggaUtfall(poster) {
  if (!poster.length) return;
  let utfall = [];
  try {
    utfall = JSON.parse(readFileSync(UTFALL, "utf8"));
  } catch {}
  utfall.push(...poster);
  mkdirSync(dirname(UTFALL), { recursive: true });
  writeFileSync(UTFALL, JSON.stringify(utfall, null, 2) + "\n");
}

// Går igenom annonserna vi följer och rapporterar det bevakningen annars
// missar: att en annons försvinner, eller att priset ändras. En sänkning på
// en annons vi redan bedömt är en starkare köpsignal än en ny träff.
async function kollaFoljda(foljer) {
  const borta = [];
  const andrade = [];
  let misslyckade = 0;
  for (const [id, f] of Object.entries(foljer)) {
    const nu = await hamtaAnnons(id);
    await new Promise((r) => setTimeout(r, 200));
    if (nu === undefined) { misslyckade++; continue; } // nätfel, låt posten ligga kvar
    if (nu === null) {
      const dagarFoljd = f.sedan
        ? Math.round((Date.now() - Date.parse(f.sedan)) / 86400000)
        : null;
      borta.push({
        id,
        ...f,
        dagarFoljd,
        utfall: {
          id,
          titel: f.titel,
          pris: f.pris,
          hittad: f.sedan,
          forsvann: new Date().toISOString().slice(0, 10),
          dagarFoljd,
          annonsdagarVidStart: f.annonsdagar ?? null,
          // Summan är annonsens totala livslängd, när vi vet startåldern.
          totalAlder:
            f.annonsdagar != null && dagarFoljd != null
              ? f.annonsdagar + dagarFoljd
              : null,
          underMarknad: f.underMarknad ?? null,
        },
      });
      delete foljer[id];
      continue;
    }
    if (nu.pris != null && f.pris != null && nu.pris !== f.pris) {
      andrade.push({ id, ...f, nyttPris: nu.pris });
    }
    foljer[id] = { titel: nu.titel, pris: nu.pris, url: nu.url, sedan: f.sedan };
  }
  loggaUtfall(borta.map((b) => b.utfall));
  return { borta, andrade, misslyckade };
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

const { borta, andrade, misslyckade: foljdaMissade } = await kollaFoljda(foljer);
if (foljdaMissade) {
  process.stderr.write(`Följlistan: ${foljdaMissade} av ${borta.length + Object.keys(foljer).length} kunde inte hämtas\n`);
}

// Mätkohorten kollas varje körning men rapporteras aldrig — den finns för att
// räknas, inte för att läsas. Fylls på när den krympt, så att storleken hålls
// uppe medan medlemmar faller ifrån. Varje ny medlem får sina egenskaper
// registrerade vid infångandet, så inträdet får ske löpande.
if (!torr) {
  const k = await kollaKohort(hamtaAnnons);
  const missade = k.misslyckade ? `, ${k.misslyckade} kunde inte hämtas` : "";
  process.stderr.write(`Kohort: ${k.kollade} kollade, ${k.forsvunna} försvunna${missade}\n`);
  if (Object.keys(las(KOHORT, {})).length < 150) {
    await fanga();
  }
}

const sok = await skapaSokare({ direkt: !flagg.has("--mcp") });
const historik = lasHistorik();
const nya = [];
const allaSedda = { ...historik.rapporterade };
const paus = (ms) => new Promise((r) => setTimeout(r, ms));
// Räknas för att kunna skilja "inget nytt" från "kom inte fram". En körning
// där nätet var stängt skrev förut INGET NYTT och en färsk tidsstämpel.
let sokningar = 0;
let sokfel = 0;

for (const b of BEVAKNINGAR) {
  for (const m of b.modeller) {
    const sedda = new Map();
    for (const q of m.q) {
      sokningar++;
      try {
        for (const it of await sok(q)) sedda.set(it.id, it);
      } catch (e) {
        sokfel++;
        process.stderr.write(`${q}: ${e.message}\n`);
      }
      await paus(250);
    }
    // Alla träffar på modellen, inte bara de nya — de utgör jämförelsematerialet
    // som avgör om en ny annons är ett kap eller bara ett pris.
    //
    // Jämförelsen görs per storlek. En 55:a och en 65:a av samma modell är
    // olika varor till olika pris, och en gemensam median hade dömt ut varje
    // 65:a som dyr och varje 55:a som kap.
    const matchande = [...sedda.values()]
      .map((i) => ({ i, tum: storlekIRubrik(i.title, b.storlekar) }))
      .filter(
        ({ i, tum }) => tum && m.p.test(i.title) && i.price && i.price <= b.maxpris && !inteEnTv(i.title),
      );

    for (const { i, tum } of matchande) {
      allaSedda[i.id] = true;
      if (!historik.rapporterade[i.id]) {
        const r = berika(i);
        const jamforbara = matchande
          .filter((x) => x.tum === tum && x.i.id !== i.id)
          .map((x) => x.i.price);
        nya.push({
          ...r,
          bevakning: b.namn,
          modell: m.k,
          ar: m.ar,
          tum,
          defekt: b.granska ? await defektord(i.id) : null,
          kap: jamforbara.length ? bedomKap({ begart: i.price, jamforbara }) : null,
        });
        foljer[i.id] = {
          titel: r.titel,
          pris: r.pris,
          url: r.url,
          sedan: new Date().toISOString().slice(0, 10),
          annonsdagar: r.dagar,
          tum,
          underMarknad: nya[nya.length - 1].kap?.motMarknad?.procentUnder ?? null,
        };
      }
    }
  }
}

{
  const sedda = new Map();
  for (const q of SONOS.fragor) {
    sokningar++;
    try {
      for (const it of await sok(q)) sedda.set(it.id, it);
    } catch (e) {
      sokfel++;
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

// Kom ingen sökning fram vet vi ingenting. Då ska körningen varken se lyckad
// ut eller skriva historik, så att nästa körning inte tror att den här gick.
if (sokningar > 0 && sokfel === sokningar) {
  console.log(`KOM INTE FRAM — alla ${sokningar} sökningar misslyckades. Ingenting kontrollerat, ingen historik skriven.`);
  process.exit(1);
}

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

if (sokfel) {
  console.log(`OBS: ${sokfel} av ${sokningar} sökningar misslyckades — resultatet är ofullständigt.\n`);
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
      // Storleken skrivs ut sedan bevakningen omfattar två: 55 och 65 tum
      // är olika beslut, och priset ensamt säger inte vilket det gäller.
      const tum = n.tum ? `${n.tum}" · ` : "";
      console.log(`${tum}${n.pris} kr · ${km} · ${n.dagar ?? "?"} dgr gammal`);
      if (n.defekt) console.log(`⚠ annonsen nämner "${n.defekt}" — läs hela texten med granska.mjs`);
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
