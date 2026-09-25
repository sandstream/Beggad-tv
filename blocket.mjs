// Två vägar till Blockets sökning: via begagnad-mcp, eller direkt mot samma
// uppströms-API som servern själv anropar.
//
// MCP-vägen är den vi använder interaktivt. Direktläget finns för bevakningen,
// som körs oövervakat i en färsk container varje morgon — där är en lokal
// Cloudflare-worker en onödig felkälla.

import "./natverk.mjs";

const UPPSTROMS = "https://blocket-api.se/v1/search";

function normalisera(item) {
  return {
    id: String(item.id || item.ad_id || ""),
    title: item.heading || item.subject || "",
    price: item.price?.amount ?? null,
    currency: item.price?.currency_code || "SEK",
    location: item.location || "",
    url: item.canonical_url || "",
    images: item.image_urls || [],
    endDate: item.timestamp ? new Date(item.timestamp).toISOString() : null,
    coordinates: item.coordinates
      ? { lat: item.coordinates.lat, lon: item.coordinates.lon }
      : null,
    source: "blocket",
  };
}

// Uppströms sidindelar. En sida är ungefär 53 träffar och svaret bär
// metadata.paging.last — "oled tv" ger 281 träffar på sex sidor. Att bara
// läsa sida ett var att se en sjundedel av marknaden och tro att det var
// hela. Nu hämtas sidorna tills träffarna tar slut eller taket nås.
const PER_SIDA_TAK = 12; // spärr mot en fråga som råkar matcha halva Blocket

async function hamtaSida(fraga, sida) {
  const res = await fetch(`${UPPSTROMS}?query=${encodeURIComponent(fraga)}&page=${sida}`);
  if (!res.ok) throw new Error(`Blocket ${res.status} ${res.statusText}`);
  return res.json();
}

async function direktSokare() {
  return async function sok(fraga, limit = Infinity) {
    const forsta = await hamtaSida(fraga, 1);
    if (!Array.isArray(forsta?.docs)) return [];
    const ut = [...forsta.docs];
    const sista = Math.min(forsta.metadata?.paging?.last ?? 1, PER_SIDA_TAK);

    for (let sida = 2; sida <= sista && ut.length < limit; sida++) {
      await new Promise((r) => setTimeout(r, 150));
      try {
        const d = await hamtaSida(fraga, sida);
        if (!Array.isArray(d?.docs) || !d.docs.length) break;
        ut.push(...d.docs);
      } catch {
        break; // en trasig sida ska inte kasta bort de vi redan har
      }
    }
    return ut.slice(0, limit).map(normalisera);
  };
}

async function mcpSokare(url) {
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { SSEClientTransport } = await import(
    "@modelcontextprotocol/sdk/client/sse.js"
  );
  const client = new Client(
    { name: "begagnad-tv", version: "1.0.0" },
    { capabilities: {} },
  );
  await client.connect(new SSEClientTransport(new URL(url)));

  const sok = async (fraga, limit = 40) => {
    const res = await client.callTool({
      name: "search_blocket",
      arguments: { query: fraga, limit },
    });
    return JSON.parse(res.content[0].text).items ?? [];
  };
  sok.stang = () => client.close();
  return sok;
}

/**
 * @param {{direkt?: boolean, mcpUrl?: string}} val
 * @returns {Promise<(fraga: string, limit?: number) => Promise<object[]>>}
 *   Funktionen har en valfri .stang() att anropa när du är klar.
 */
export async function skapaSokare({ direkt = false, mcpUrl } = {}) {
  if (direkt) return direktSokare();
  return mcpSokare(mcpUrl || process.env.BEGAGNAD_MCP_URL || "http://localhost:8788/sse");
}

export function avstand(a, b) {
  const R = 6371;
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLon = (b.lon - a.lon) * r;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(x)) * 10) / 10;
}
