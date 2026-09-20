// Värderingsmodell för begagnad TV.
//
//   Maxpris = nypris × åldersfaktor × riskfaktor
//
// Nypris betyder REAPRIS IDAG, inte lanseringspris. Säljaren räknar på vad
// hen betalade. Du räknar på vad du annars skulle betala. Det är hela
// förhandlingen.

export const ALDERSFAKTOR = {
  // Insteg och mellanklass — modeller som tappar värde snabbt.
  standard: [
    { maxAlder: 0, faktor: 0.85, not: "oöppnad, innevarande modellår" },
    { maxAlder: 2, faktor: 0.55, not: "1–2 år" },
    { maxAlder: 4, faktor: 0.40, not: "3–4 år" },
    { maxAlder: 99, faktor: 0.25, not: "5+ år" },
  ],
  // Testvinnare och flaggskepp håller värdet ett steg bättre. Utan den här
  // justeringen säger modellen nej till varenda C-serie, vilket är fel svar:
  // en fyra år gammal OLED säljs helt enkelt inte till 0,40 × nypris.
  flaggskepp: [
    { maxAlder: 0, faktor: 0.85, not: "oöppnad, innevarande modellår" },
    { maxAlder: 4, faktor: 0.55, not: "1–4 år (flaggskepp)" },
    { maxAlder: 6, faktor: 0.40, not: "5–6 år (flaggskepp)" },
    { maxAlder: 99, faktor: 0.25, not: "7+ år" },
  ],
};

export const RISKFAKTOR = {
  kvitto: { faktor: 1.0, not: "kvitto med reklamationsrätt kvar" },
  testa: { faktor: 0.85, not: "inget kvitto men du får testa" },
  forseglad: { faktor: 0.6, not: "förseglad kartong utan kvitto — eller skippa helt" },
};

/**
 * @param {object} o
 * @param {number} o.nypris      Reapris idag för modellen, eller för närmaste
 *                               nuvarande motsvarighet om den utgått.
 * @param {number} o.alder       År sedan modellåret.
 * @param {"kvitto"|"testa"|"forseglad"} o.risk
 * @param {boolean} [o.flaggskepp]
 * @param {number} [o.begart]    Säljarens pris, om du vill ha ett utfall.
 */
export function vardera({ nypris, alder, risk, flaggskepp = false, begart = null }) {
  const trappa = flaggskepp ? ALDERSFAKTOR.flaggskepp : ALDERSFAKTOR.standard;
  const steg = trappa.find((s) => alder <= s.maxAlder);
  const r = RISKFAKTOR[risk];
  const maxpris = Math.round(nypris * steg.faktor * r.faktor);

  const stopp = [];
  // Stoppregel 1 hanteras i sökningen: ingen modellkod i annonsen → fråga
  // innan du åker. Utan den kan du inte räkna.
  if (risk === "forseglad" && begart != null && begart < nypris * 0.5) {
    stopp.push("Förseglad vara under 50 % av nypris — kräv kvitto eller gå.");
  }
  if (begart != null && nypris - begart < 1500) {
    stopp.push(
      `Bara ${nypris - begart} kr billigare än nytt — köp nytt. Reklamationsrätt och öppet köp är värt mer än så.`,
    );
  }
  // Över sex år finns sällan ett reapris att räkna mot. Då är jämförelsen
  // billigaste nya likvärdiga TV, inte modellens eget forna pris — annars
  // blir gamla flaggskepp systematiskt övervärderade.
  if (alder > 6) {
    stopp.push("Äldre än sex år: räkna mot billigaste nya likvärdiga TV, inte mot modellen.");
  }

  return {
    maxpris,
    aldersfaktor: steg.faktor,
    riskfaktor: r.faktor,
    forklaring: `${nypris} × ${steg.faktor} (${steg.not}) × ${r.faktor} (${r.not})`,
    utfall: begart == null ? null : begart <= maxpris ? "köp" : "bjud eller gå",
    stopp,
  };
}

// Andel av nypris som är normalt att betala begagnat, per ålder. Siffrorna är
// kalibrerade mot annonserna i det första stora svepet, inte mot känsla.
export const ANDEL_AV_NYPRIS = [
  { maxAlder: 2, normalt: [0.55, 0.65], kap: 0.5 },
  { maxAlder: 4, normalt: [0.4, 0.5], kap: 0.35 },
  { maxAlder: 7, normalt: [0.25, 0.35], kap: 0.25 },
  { maxAlder: 99, normalt: [0.15, 0.25], kap: 0.15 },
];

// Hur långt under jämförbara annonser ett pris ligger, och vad det betyder.
// Gränserna kommer från att varenda annons djupare än 30 % under marknad i
// materialet hade en förklaring: sprucken panel, döda pixlar, trasig skärm,
// eller lång liggtid utan att någon nämnde varför.
const MARKNADSKLASSER = [
  { over: 45, klass: "fel på varan eller annonsen", rad: "Gå inte dit ensam och betala aldrig i förskott." },
  { over: 30, klass: "leta efter haken", rad: "Det finns en orsak. Står den inte i annonsen är det den du ska leta efter på plats." },
  { over: 15, klass: "kap", rad: "Säljaren vill bli av med den. Ring idag." },
  { over: 0, klass: "normalt prutläge", rad: "Rimligt pris. Bjud 10–15 procent under." },
  { over: -Infinity, klass: "över marknad", rad: "Dyrare än jämförbara annonser. Bjud ner till marknad eller gå." },
];

// En median av en eller två annonser är inte en marknad. Ligger den enda
// jämförelsen snett — ett paketpris, en bundlad gamingstol — blir en korrekt
// prissatt annons utdömd. Hellre inget besked än fel besked.
const MINSTA_UNDERLAG = 3;

function median(tal) {
  const s = [...tal].sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/**
 * Bedömer ett begärt pris mot jämförbara annonser, mot nypris, eller båda.
 *
 * En tredjedel av nypriset är målet. En tredjedel av begagnatpriset är en
 * varning. Det är samma bråktal och helt olika besked, så båda nämnarna
 * redovisas var för sig.
 *
 * @param {object} o
 * @param {number} o.begart          Säljarens pris.
 * @param {number[]} [o.jamforbara]  Begärda priser för jämförbara annonser,
 *                                   samma modell och storlek. Prisen behöver
 *                                   inte vara många — två räcker för en median.
 * @param {number} [o.nypris]        Reapris idag för modellen, eller närmaste
 *                                   nuvarande motsvarighet.
 * @param {number} [o.alder]         År sedan modellåret. Krävs med nypris.
 */
export function bedomKap({ begart, jamforbara = [], nypris = null, alder = null }) {
  const ut = { begart, marknad: null, motMarknad: null, motNypris: null };

  const giltiga = jamforbara.filter((p) => p > 0);
  const m = median(giltiga);
  if (m && giltiga.length < MINSTA_UNDERLAG) {
    ut.marknad = m;
    ut.motMarknad = {
      otillrackligt: true,
      underlag: giltiga.length,
      rad: `Bara ${giltiga.length} jämförbar${giltiga.length === 1 ? " annons" : "a annonser"} — för tunt för att säga om priset är ett kap. Jämför själv innan du bjuder.`,
    };
  } else if (m) {
    const under = Math.round((1 - begart / m) * 100);
    const k = MARKNADSKLASSER.find((x) => under > x.over);
    ut.marknad = m;
    ut.motMarknad = {
      procentUnder: under,
      klass: k.klass,
      rad: k.rad,
      underlag: jamforbara.length,
    };
  }

  if (nypris && alder != null) {
    const steg = ANDEL_AV_NYPRIS.find((s) => alder <= s.maxAlder);
    const andel = begart / nypris;
    ut.motNypris = {
      andel: Math.round(andel * 100) / 100,
      normalt: steg.normalt,
      klass:
        andel < steg.kap
          ? "kap"
          : andel <= steg.normalt[1]
            ? "normalt"
            : "över normalspannet",
      rad: `Normalt för ${alder} år är ${Math.round(steg.normalt[0] * 100)}–${Math.round(steg.normalt[1] * 100)} % av nypris; kap under ${Math.round(steg.kap * 100)} %.`,
    };
  }

  return ut;
}
