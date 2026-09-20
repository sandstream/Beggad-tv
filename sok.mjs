#!/usr/bin/env node
// Sök begagnad TV på Blocket via begagnad-mcp.
//
//   node sok.mjs --profil testvinnare --region stockholm --max 12000
//   node sok.mjs --profil budget --radie 10 --max 2000 --storlek 55
//   node sok.mjs --profil testvinnare --hem goteborg --radie 25
//   node sok.mjs --profil testvinnare --ar 2022-2026 --json > traffar.json
//
// Kräver att begagnad-mcp kör lokalt (se README.md). Peka om med
// BEGAGNAD_MCP_URL om servern ligger någon annanstans.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { TESTVINNARE, BUDGET_SOKORD, inteEnTv, REGIONER, ORTER } from "./modeller.js";

const MCP_URL = process.env.BEGAGNAD_MCP_URL || "http://localhost:8788/sse";

function flaggor(argv) {
  const f = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const namn = argv[i].slice(2);
    const varde = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
    f[namn] = varde;
  }
  return f;
}

const f = flaggor(process.argv.slice(2));
const profil = f.profil || "testvinnare";
const maxpris = f.max ? Number(f.max) : Infinity;
const minpris = f.min ? Number(f.min) : 1;
const region = REGIONER[f.region || "alla"] || REGIONER.alla;
const storlekar = (f.storlek || "42,48,50,55,65,75,77,83").split(",").map((s) => s.trim());
const [arFran, arTill] = (f.ar || "2020-2026").split("-").map(Number);
const somJson = f.json === "true";

// --hem tar ett namn ur ORTER eller ett par "lat,lon". --radie är kilometer
// fågelvägen. Ortsnamnsfiltret (--region) är trubbigt — "Stockholm" säger
// inget om huruvida annonsen ligger två eller tjugo kilometer bort.
const hem = (() => {
  const v = f.hem || "spanga";
  if (ORTER[v]) return ORTER[v];
  const [lat, lon] = String(v).split(",").map(Number);
  if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  console.error(`Okänd ort "${v}". Välj bland: ${Object.keys(ORTER).join(", ")} — eller ange lat,lon.`);
  process.exit(1);
})();
const radie = f.radie ? Number(f.radie) : null;

function avstand(a, b) {
  const R = 6371;
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLon = (b.lon - a.lon) * r;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(x)) * 10) / 10;
}

// Siffergränser, inte ordgränser: "55Tum" och '55"' skrivs ihop lika ofta som
// "55 tum", och \b matchar inte mellan en siffra och en bokstav.
const STORLEK = new RegExp(`(?<![0-9])(${storlekar.join("|")})(?![0-9])`, "i");

const client = new Client({ name: "begagnad-tv", version: "1.0.0" }, { capabilities: {} });
await client.connect(new SSEClientTransport(new URL(MCP_URL)));

async function sok(fraga) {
  try {
    const res = await client.callTool({
      name: "search_blocket",
      arguments: { query: fraga, limit: 40 },
    });
    return JSON.parse(res.content[0].text).items ?? [];
  } catch (e) {
    process.stderr.write(`  ${fraga}: ${e.message}\n`);
    return [];
  }
}

const paus = (ms) => new Promise((r) => setTimeout(r, ms));
const traffar = [];

if (profil === "testvinnare") {
  const urval = TESTVINNARE.filter((m) => m.ar >= arFran && m.ar <= arTill);
  process.stderr.write(`${urval.length} modeller, ${urval.reduce((n, m) => n + m.q.length, 0)} sökningar\n\n`);
  for (const m of urval) {
    const sedda = new Map();
    for (const q of m.q) {
      for (const it of await sok(q)) sedda.set(it.id, it);
      await paus(300);
    }
    const passar = [...sedda.values()].filter((i) => m.p.test(i.title) && STORLEK.test(i.title));
    process.stderr.write(`${m.k} (${m.ar}): ${sedda.size} råa → ${passar.length}\n`);
    for (const h of passar) traffar.push({ ...h, modell: m.k, modellar: m.ar });
  }
} else {
  const sedda = new Map();
  for (const q of BUDGET_SOKORD) {
    const items = await sok(q);
    for (const it of items) sedda.set(it.id, it);
    process.stderr.write(`${q}: ${items.length}\n`);
    await paus(300);
  }
  for (const h of sedda.values()) {
    if (STORLEK.test(h.title)) traffar.push({ ...h, modell: null, modellar: null });
  }
}

const nu = Date.now();
const resultat = traffar
  .filter(
    (i) =>
      i.price &&
      i.price >= minpris &&
      i.price <= maxpris &&
      region.test(i.location) &&
      !inteEnTv(i.title),
  )
  .map((i) => ({
    ...i,
    dagar: i.endDate ? Math.floor((nu - Date.parse(i.endDate)) / 86400000) : null,
    avstand: i.coordinates ? avstand(hem, i.coordinates) : null,
    // Stoppregel ett: utan modellkod i annonsen går det inte att räkna.
    // Ring och fråga innan du åker.
    harModellkod: /[a-z]{2,4}\d{2,5}[a-z]{0,4}|\b(c[1-6]|g[1-6]|cx|gx|s9[05][a-g]|qn9[05][a-f])\b/i.test(i.title),
  }));

// search_blocket bär bara med koordinater om servern är patchad (se README).
// Utan dem går det inte att filtrera på radie — säg det rakt ut i stället för
// att tyst returnera fel svar.
const harKoordinater = resultat.some((r) => r.avstand != null);
if (radie && !harKoordinater) {
  console.error(
    "--radie kräver koordinater från servern, men inga kom med. Patcha searchBlocket\n" +
      "i din begagnad-mcp-klon (se README, avsnittet Kända begränsningar). Kör utan radie\n" +
      "så länge, gärna med --region.\n",
  );
}

const visade = (radie && harKoordinater
  ? resultat.filter((r) => r.avstand != null && r.avstand <= radie)
  : resultat
).sort((a, b) => (radie && harKoordinater ? a.avstand - b.avstand : a.price - b.price));

await client.close();

if (somJson) {
  console.log(JSON.stringify(visade, null, 2));
} else {
  const inom = radie && harKoordinater ? ` inom ${radie} km` : "";
  console.log(`\n${visade.length} träffar${inom}\n`);
  for (const r of visade) {
    const kod = r.harModellkod ? "" : "  [ingen modellkod — fråga först]";
    const ar = r.modellar ? ` ${r.modellar}` : "";
    const km = harKoordinater ? `${String(r.avstand ?? "?").padStart(5)} km  ` : "";
    console.log(`${km}${String(r.price).padStart(6)} kr  ${String(r.dagar ?? "?").padStart(3)}d  ${r.location.padEnd(16)}${ar}  ${r.title}${kod}`);
    console.log(`${" ".repeat(km.length)}              ${r.url}`);
  }
}

process.exit(0);
