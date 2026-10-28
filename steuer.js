/* Finanzkompass – Steuer-Engine (Einkommensteuer, Soli, Kirchensteuer)
 * Rechtsstand: Veranlagungszeitraum 2026. Folgejahre werden per Inflationsannahme fortgeschrieben.
 * Orientierungsrechnung – ersetzt keine Steuerberatung.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Steuer = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Parameter 2026 (Quellen: § 32a EStG, § 3 SolZG, § 10 EStG, § 9a EStG, § 10c EStG)
  var BASIS_2026 = {
    jahr: 2026,
    grundfreibetrag: 12348,
    zone2Ende: 17799,
    zone3Ende: 69878,
    zone4Ende: 277825,
    soliFreigrenze: 20350,        // Einzelveranlagung; Zusammenveranlagung doppelt
    soliSatz: 0.055,
    soliMilderung: 0.119,
    hoechstbetragAV: 30826,       // Altersvorsorgeaufwendungen § 10 Abs. 3 EStG (Einzel)
    hbSonstigeSelbst: 2800,       // § 10 Abs. 4 S. 1 EStG
    hbSonstigeZuschuss: 1900,     // § 10 Abs. 4 S. 2 EStG
    arbeitnehmerPausch: 1230,     // § 9a EStG
    sonderausgabenPausch: 36      // § 10c EStG (Einzel)
  };

  function rundeAb(x) { return Math.floor(x + 1e-9); }
  function cent(x) { return Math.floor(x * 100 + 1e-6) / 100; }

  // Tarif 2026 nach § 32a Abs. 1 EStG
  function tarif2026(zvE) {
    var x = rundeAb(Math.max(0, zvE));
    var est;
    if (x <= 12348) est = 0;
    else if (x <= 17799) { var y = (x - 12348) / 10000; est = (914.51 * y + 1400) * y; }
    else if (x <= 69878) { var z = (x - 17799) / 10000; est = (173.10 * z + 2397) * z + 1034.87; }
    else if (x <= 277825) est = 0.42 * x - 11135.63;
    else est = 0.45 * x - 19470.38;
    return rundeAb(est);
  }

  // Faktor der Fortschreibung für ein Jahr (2026 = 1)
  function faktor(jahr, inflation) {
    var n = Math.max(0, (jahr || 2026) - 2026);
    return Math.pow(1 + (inflation || 0), n);
  }

  // Tarif für ein Jahr: 2026 exakt, danach alle Eckwerte mit dem Faktor f skaliert
  function tarif(zvE, jahr, inflation) {
    var f = faktor(jahr, inflation);
    if (f === 1) return tarif2026(zvE);
    return rundeAb(f * tarif2026(zvE / f));
  }

  function parameter(jahr, inflation) {
    var f = faktor(jahr, inflation);
    return {
      jahr: jahr,
      faktor: f,
      grundfreibetrag: Math.round(BASIS_2026.grundfreibetrag * f),
      soliFreigrenze: Math.round(BASIS_2026.soliFreigrenze * f),
      hoechstbetragAV: Math.round(BASIS_2026.hoechstbetragAV * f),
      hbSonstigeSelbst: BASIS_2026.hbSonstigeSelbst,
      hbSonstigeZuschuss: BASIS_2026.hbSonstigeZuschuss,
      arbeitnehmerPausch: BASIS_2026.arbeitnehmerPausch,
      sonderausgabenPausch: BASIS_2026.sonderausgabenPausch,
      fortgeschrieben: f !== 1
    };
  }

  function soli(est, zusammen, p) {
    var fg = p.soliFreigrenze * (zusammen ? 2 : 1);
    if (est <= fg) return 0;
    return cent(Math.min(BASIS_2026.soliSatz * est, BASIS_2026.soliMilderung * (est - fg)));
  }

  function n(v) { v = Number(v); return isFinite(v) ? v : 0; }

  // Einkünfte und Vorsorge einer Person
  function person(pe, p) {
    pe = pe || {};
    var lohn = pe.lohn || {};
    var brutto = n(lohn.brutto);
    var wk = brutto > 0 ? Math.min(brutto, Math.max(n(lohn.werbungskosten), p.arbeitnehmerPausch)) : 0;
    var einkuenfte19 = Math.max(0, brutto - wk);
    var einkuenfte18 = n(pe.gewinn);
    var sonstige = n(pe.sonstigeEinkuenfte);

    var v = pe.vorsorge || {};
    // Altersvorsorge (Basisversorgung): PVW, freiwillige DRV, Rürup, GRV AN + AG
    var avGesamt = n(v.pvw) + n(v.rvFreiwillig) + n(v.ruerup) + n(lohn.rvAN) + n(lohn.rvAG);
    var avAG = n(lohn.rvAG);

    // Basis-KV/PV: selbst getragen + AN-Anteil aus Anstellung (ggf. 4 %-Kürzung bei Krankengeldanspruch)
    var kvSelbst = n(v.kvBasis) * (v.kvMitKrankengeld ? 0.96 : 1);
    var kvAN = n(lohn.kvAN) * (lohn.kvMitKrankengeld === false ? 1 : 0.96);
    var basisKVPV = kvSelbst + n(v.pvBasis) + kvAN + n(lohn.pvAN);
    var sonstigeVorsorge = n(v.sonstige) + n(lohn.avAN);

    var zuschuss = (pe.agZuschussKV != null) ? !!pe.agZuschussKV : brutto > 0;
    var hbSonst = zuschuss ? p.hbSonstigeZuschuss : p.hbSonstigeSelbst;

    return {
      einkuenfte18: einkuenfte18,
      einkuenfte19: einkuenfte19,
      werbungskosten: wk,
      sonstigeEinkuenfte: sonstige,
      summe: einkuenfte18 + einkuenfte19 + sonstige,
      avGesamt: avGesamt,
      avAG: avAG,
      basisKVPV: basisKVPV,
      sonstigeVorsorge: sonstigeVorsorge,
      hbSonst: hbSonst,
      kistGezahlt: n(pe.kistGezahlt),
      kistPflicht: !!pe.kistPflicht,
      einbehalten: {
        lohnsteuer: n(lohn.lohnsteuer), soli: n(lohn.soli), kist: n(lohn.kist)
      }
    };
  }

  /*
   * Hauptberechnung.
   * eingabe = { jahr, inflation, zusammen, kistSatz, a: Person, b: Person (nur bei zusammen),
   *             vorauszahlungen: { est, soli, kist } (bereits gezahlt/angerechnet) }
   * Person = { gewinn, sonstigeEinkuenfte, lohn:{brutto,werbungskosten,rvAN,rvAG,kvAN,pvAN,avAN,kvMitKrankengeld,lohnsteuer,soli,kist},
   *            vorsorge:{pvw,rvFreiwillig,ruerup,kvBasis,pvBasis,kvMitKrankengeld,sonstige},
   *            kistPflicht, kistGezahlt, agZuschussKV }
   */
  function berechne(e) {
    var jahr = e.jahr || 2026;
    var p = parameter(jahr, e.inflation);
    var zus = !!e.zusammen;
    var kistSatz = e.kistSatz == null ? 0.09 : n(e.kistSatz);
    var A = person(e.a, p);
    var B = zus ? person(e.b, p) : null;
    var pers = B ? [A, B] : [A];

    var summeEinkuenfte = pers.reduce(function (s, x) { return s + x.summe; }, 0);

    // Altersvorsorge § 10 Abs. 3
    var avGesamt = pers.reduce(function (s, x) { return s + x.avGesamt; }, 0);
    var avAG = pers.reduce(function (s, x) { return s + x.avAG; }, 0);
    var hbAV = p.hoechstbetragAV * (zus ? 2 : 1);
    var avAbzug = Math.max(0, Math.min(avGesamt, hbAV) - avAG);
    var avUeberHB = Math.max(0, avGesamt - hbAV);

    // Sonstige Vorsorge § 10 Abs. 4
    var basis = pers.reduce(function (s, x) { return s + x.basisKVPV; }, 0);
    var sonst = pers.reduce(function (s, x) { return s + x.sonstigeVorsorge; }, 0);
    var hbSonst = pers.reduce(function (s, x) { return s + x.hbSonst; }, 0);
    var vorsorge3 = Math.max(Math.min(basis + sonst, hbSonst), basis);
    var sonstigeWirksam = Math.max(0, vorsorge3 - basis);

    // Kirchensteuer als Sonderausgabe; Sonderausgaben-Pauschbetrag § 10c
    var kistGezahlt = pers.reduce(function (s, x) { return s + x.kistGezahlt; }, 0);
    var saPausch = p.sonderausgabenPausch * (zus ? 2 : 1);
    var saUebrige = Math.max(kistGezahlt, saPausch);

    var zvE = rundeAb(Math.max(0, summeEinkuenfte - avAbzug - vorsorge3 - saUebrige));

    var est = zus ? 2 * tarif(zvE / 2, jahr, e.inflation) : tarif(zvE, jahr, e.inflation);
    var soliBetrag = soli(est, zus, p);

    // Kirchensteuer: bei Zusammenveranlagung und nur einem Pflichtigen anteilig nach Einkünften
    var kistAnteil;
    if (!zus) kistAnteil = A.kistPflicht ? 1 : 0;
    else {
      var pfl = pers.filter(function (x) { return x.kistPflicht; });
      if (pfl.length === 2) kistAnteil = 1;
      else if (pfl.length === 0) kistAnteil = 0;
      else kistAnteil = summeEinkuenfte > 0 ? Math.max(0, pfl[0].summe) / summeEinkuenfte : 0.5;
    }
    var kist = cent(est * kistSatz * kistAnteil);
    var gesamt = est + soliBetrag + kist;

    // Grenzsteuersatz (Soli + KiSt eingeschlossen), über +100 € zvE
    var est2 = zus ? 2 * tarif((zvE + 100) / 2, jahr, e.inflation) : tarif(zvE + 100, jahr, e.inflation);
    var gesamt2 = est2 + soli(est2, zus, p) + est2 * kistSatz * kistAnteil;
    var grenz = (gesamt2 - gesamt) / 100;

    // Anrechnung
    var einb = pers.reduce(function (s, x) {
      return { lohnsteuer: s.lohnsteuer + x.einbehalten.lohnsteuer, soli: s.soli + x.einbehalten.soli, kist: s.kist + x.einbehalten.kist };
    }, { lohnsteuer: 0, soli: 0, kist: 0 });
    var vz = e.vorauszahlungen || {};
    var angerechnet = {
      est: einb.lohnsteuer + n(vz.est),
      soli: einb.soli + n(vz.soli),
      kist: einb.kist + n(vz.kist)
    };
    var offen = {
      est: est - angerechnet.est,
      soli: soliBetrag - angerechnet.soli,
      kist: kist - angerechnet.kist
    };

    return {
      jahr: jahr,
      parameter: p,
      zusammen: zus,
      personen: pers,
      summeEinkuenfte: summeEinkuenfte,
      avGesamt: avGesamt, avAbzug: avAbzug, avUeberHB: avUeberHB, hbAV: hbAV,
      basisKVPV: basis, sonstigeVorsorge: sonst, sonstigeWirksam: sonstigeWirksam, hbSonst: hbSonst, vorsorge3: vorsorge3,
      kistGezahlt: kistGezahlt, saUebrige: saUebrige,
      zvE: zvE,
      est: est, soli: soliBetrag, kist: kist, gesamt: gesamt,
      durchschnitt: summeEinkuenfte > 0 ? gesamt / summeEinkuenfte : 0,
      grenz: grenz,
      angerechnet: angerechnet,
      offen: offen,
      offenGesamt: offen.est + offen.soli + offen.kist
    };
  }

  // Abgeltungsteuer-Gesamtsatz inkl. Soli und KiSt (§ 32d Abs. 1 S. 4 EStG)
  function abgeltungSatz(kistSatz) {
    var k = kistSatz || 0;
    var e = 0.25 / (1 + 0.25 * k);
    return e * (1 + 0.055 + k);
  }

  return {
    BASIS_2026: BASIS_2026,
    tarif2026: tarif2026,
    tarif: tarif,
    parameter: parameter,
    soli: soli,
    berechne: berechne,
    abgeltungSatz: abgeltungSatz
  };
});
