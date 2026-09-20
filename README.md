# Begagnad TV — sparad sökning

Söker Blocket efter TV-apparater som är värda att köpa begagnat, via MCP-servern
[bjesus/begagnad-mcp](https://github.com/bjesus/begagnad-mcp).

Två profiler:

- **testvinnare** — 52 modeller från 2020–2026. Testvinnare och toppmodeller,
  där begagnatpriset är klart lägre än vad bilden är värd.
- **budget** — breda sökord, ingen modellkod. För extrarum, källare och garage,
  där kravet bara är stor, fungerande och billig.

## Kom igång

Den publika endpointen (`begagnad-mcp.bjesus.workers.dev/sse`) låg nere senast
den testades — Cloudflare 1042. Kör servern lokalt istället:

```bash
git clone https://github.com/bjesus/begagnad-mcp.git
cd begagnad-mcp && npm install
npx wrangler dev --port 8788 --local
```

Sen, i den här mappen:

```bash
npm install
node sok.mjs --profil testvinnare --region stockholm --max 12000
```

## Flaggor

| Flagga | Betyder | Standard |
|---|---|---|
| `--profil` | `testvinnare` eller `budget` | `testvinnare` |
| `--region` | `stockholm`, `malardalen`, `goteborg`, `skane`, `alla` | `alla` |
| `--max` / `--min` | prisspann i kronor | inget tak |
| `--storlek` | tumstorlekar, kommaseparerat | `42,48,50,55,65,75,77,83` |
| `--ar` | modellårsspann, t.ex. `2022-2026` | `2020-2026` |
| `--hem` | ankarpunkt: `spanga`, `stockholm`, `goteborg`, `malmo`, `uppsala` eller `lat,lon` | `spanga` |
| `--radie` | maxavstånd i kilometer fågelvägen från `--hem` | av |
| `--json` | rå JSON istället för tabell | av |

Peka om servern med `BEGAGNAD_MCP_URL` om den inte ligger på
`http://localhost:8788/sse`.

### Avstånd i stället för ortsnamn

`--region` filtrerar på ortsnamn, vilket är trubbigt: "Stockholm" säger inget om
huruvida annonsen ligger två eller tjugo kilometer bort, och en annons i
Vällingby är närmare Spånga än en i Nacka. `--radie` mäter i stället fågelvägen
från `--hem` och sorterar träffarna på avstånd.

```bash
node sok.mjs --profil budget --radie 10 --max 2000 --storlek 55
```

Ankarpunkterna i `ORTER` är hämtade ur Blocket självt — medelkoordinaten för
annonserna på orten träffar tyngdpunkten bättre än en godtycklig centrumpunkt.
Behöver du en ort som inte finns i listan, ange `--hem lat,lon`.

## Daglig bevakning

`bevaka.mjs` kör de sparade kriterierna, jämför mot `bevakning/sedda.json` och
skriver ut bara det som inte rapporterats förut.

```bash
node bevaka.mjs          # direktläge mot uppströms-API:t
node bevaka.mjs --mcp    # via begagnad-mcp i stället
node bevaka.mjs --torr   # rapportera utan att uppdatera historiken
```

Historikfilen **måste committas efter varje körning** — det är den som gör att
en färsk container vet vad gårdagens körning redan rapporterade. Utan push ser
allt nytt ut igen nästa dag.

Direktläget går förbi MCP-servern och anropar samma uppströms-API som den gör.
Det är medvetet: en oövervakad körning i en färsk container ska inte bero på
att en lokal Cloudflare-worker startar som den ska.

### Utfall och livslängd

Varje följd annons som försvinner loggas i `bevakning/utfall.json` med hur
länge den låg ute, vad den kostade och hur den bedömdes när vi hittade den.
`node statistik.mjs` sammanställer materialet.

Frågan är om underprissatta annonser säljs snabbare. Den går **inte** att
besvara på en ögonblicksbild: de snabbsålda hinner aldrig synas bland levande
annonser, så åldersfördelningen är snedvriden per konstruktion. En mätning på
443 levande annonser gav median 10–14 dagar i samtliga prislägen — ingen
signal alls, vilket är precis vad snedvridningen förutsäger.

Två varningar för tolkningen när materialet väl finns:

- **Borttagen är inte detsamma som såld.** Blocket plockar bort annonser som
  löper ut. Livslängder över 60 dagar behandlas därför som sannolikt utgångna
  och räknas inte som affärer.
- **Vi ser bara det vi råkat följa.** Urvalet är inte slumpmässigt.

Under tio utfall per grupp säger `statistik.mjs` ifrån i stället för att
redovisa skillnader som ändå är brus.

### Följlistan

Utöver nya träffar bevakas de annonser vi redan bedömt. `bevakning/foljer.json`
håller senast kända pris per annons, och varje körning rapporterar två saker som
en ren nyhetsbevakning aldrig ser:

- **BORTA** — annonsen är såld eller tillbakadragen. Posten tas bort ur listan.
- **SÄNKT / HÖJT** — säljaren har ändrat priset. En sänkning på något vi redan
  bedömt är en starkare köpsignal än en ny träff, eftersom bedömningen är gjord.

Nya träffar läggs till automatiskt. Vill du följa något manuellt:

```bash
node bevaka.mjs --folj 26730987,26747541
```

Uppströms svarar HTTP 200 även för borttagna annonser, med ett error-fält i
stället för innehåll — därför avgörs "borta" på att `itemData` saknas, inte på
statuskoden.

Kriterierna ligger i `BEVAKNINGAR` och `SONOS` överst i filen. Just nu:
55 tum OLED från 2021 och nyare under 9 000 kr, samt Sonos Beam och Sub i
svart under 8 000 kr.

## Värderingsmodellen

`vardering.js` räknar ut vad en annons får kosta:

```
Maxpris = nypris × åldersfaktor × riskfaktor
```

**Nypris betyder reapris idag**, inte lanseringspris. Säljaren räknar på vad hen
betalade. Du räknar på vad du annars skulle betala. Det är hela förhandlingen.

Åldersfaktorn finns i två trappor. Standardtrappan (0,85 / 0,55 / 0,40 / 0,25)
gäller insteg och mellanklass. Flaggskeppstrappan ligger ett steg högre, för
utan den säger modellen nej till varenda testvinnare — en fyra år gammal OLED
säljs helt enkelt inte till 0,40 × nypris.

### Tre stoppregler

1. **Ingen modellkod i annonsen** → fråga innan du åker. Utan den kan du inte
   räkna. `sok.mjs` flaggar de annonserna med `[ingen modellkod — fråga först]`.
2. **Pris under 50 % av nypris på förseglad vara** → kräv kvitto eller gå.
3. **Skillnaden mot att köpa nytt under 1 500 kr** → köp nytt. Reklamationsrätt
   och öppet köp är värt mer än så.

En fjärde, tillagd efter att modellen prövats mot verkliga annonser: **över sex
år finns sällan ett reapris att räkna mot.** Jämför då med billigaste nya
likvärdiga TV, inte med modellens eget forna pris — annars blir gamla flaggskepp
systematiskt övervärderade.

## Att undvika

Allt som slutar på Q60, DU7000, CU7000, AU7000 eller BU8000. Kantbelysta insteg
utan lokal dimning — du betalar för storleken, inte för bilden. De är medvetet
utelämnade ur modellkatalogen.

Vid OLED: be om foto av en helvit och en helgrå bild, och undvik exemplar som
stått på nyhetskanaler hela dagarna.

## Kända begränsningar

**`get_blocket_item` är trasig i uppströms-repot.** `blocket-api.se/v1/ad/recommerce`
returnerar numera Blockets Remix-loaderdata istället för ett platt objekt, så
verktyget svarar med tomma fält. Rätta i `src/index.ts` i din klon genom att
packa upp `loaderData["item-recommerce"].itemData` innan fälten läses. Sökningen
(`search_blocket`) fungerar som den ska.

**`--radie` kräver en patchad server.** `search_blocket` skickar inte med
annonsernas koordinater, trots att Blockets eget svar innehåller dem. Lägg till
i `searchBlocket` i `src/index.ts`:

```ts
coordinates: item.coordinates
  ? { lat: item.coordinates.lat, lon: item.coordinates.lon }
  : null,
```

och motsvarande fält i `UnifiedItem`. Utan patchen säger `sok.mjs` ifrån och
kör vidare utan radiefilter i stället för att tyst ge fel svar.

**Tradera kräver API-nycklar.** `search_tradera` och `get_tradera_item` behöver
`TRADERA_APP_ID` och `TRADERA_APP_KEY` som variabler i wrangler. Utan dem är det
bara Blocket som söks.

**Ren nyckelordssökning.** Annonser som skriver "LG OLED 55 tum" utan modellkod
syns inte alls, och fotstativ till rätt modell kan råka matcha. Filtret i
`modeller.js` (`INTE_EN_TV`) fångar det mesta men inte allt.
