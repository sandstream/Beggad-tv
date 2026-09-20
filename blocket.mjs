// Två vägar till Blockets sökning: via begagnad-mcp, eller direkt mot samma
// uppströms-API som servern själv anropar.
//
// MCP-vägen är den vi använder interaktivt. Direktläget finns för bevakningen,
// som körs oövervakat i en färsk container varje morgon — där är en lokal
// Cloudflare-worker en onödig felkälla.

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

async function direktSokare() {
  return async function sok(fraga, limit = 40) {
    const res = await fetch(`${UPPSTROMS}?query=${encodeURIComponent(fraga)}`);
    if (!res.ok) throw new Error(`Blocket ${res.status} ${res.statusText}`);
    const data = await res.json();
    if (!Array.isArray(data?.docs)) return [];
    return data.docs.slice(0, limit).map(normalisera);
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
