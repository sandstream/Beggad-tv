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
