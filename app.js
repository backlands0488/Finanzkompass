/* Finanzkompass – Ausbaustufe 1: Einnahmen, Ausgaben, Gewinn, Steuer
 * Alle Daten bleiben lokal (Browser-Speicher bzw. verbundene JSON-Datei). Keine persönlichen Daten im Code.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- Grundlagen
  var STORE_KEY = 'finanzkompass.v1';
  var APP_VERSION = '1.2.0';
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var F0 = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  var F2 = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
  function eur(x, d) { return (d ? F2 : F0).format(Math.abs(x) < 0.005 ? 0 : (x || 0)); }
  function pct(x, d) { return ((x || 0) * 100).toLocaleString('de-DE', { maximumFractionDigits: d == null ? 1 : d }) + ' %'; }
  function nz(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function isoHeute() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function datumDE(iso) { if (!iso) return ''; var p = iso.split('-'); return p[2] + '.' + p[1] + '.' + p[0]; }
  function tagImJahr(d) { var s = new Date(d.getFullYear(), 0, 1); return Math.floor((d - s) / 864e5) + 1; }
  function tageImJahr(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365; }
  var MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

  // ---------------------------------------------------------------- Kategorien
  var GRUPPEN = [
    { id: 'praxis_ein', name: 'Praxis – Einnahmen' },
    { id: 'praxis_aus', name: 'Praxis – Betriebsausgaben' },
    { id: 'praxis_inv', name: 'Praxis – Anschaffungen' },
    { id: 'vorsorge', name: 'Privat – Vorsorge' },
    { id: 'steuer', name: 'Steuern' },
    { id: 'privat', name: 'Privat – Sonstiges' },
    { id: 'neutral', name: 'Neutral' }
  ];
  var KAT = [
    ['kvn', 'KVN-Honorar', 'praxis_ein'],
    ['privat', 'Privat-/Selbstzahler', 'praxis_ein'],
    ['ausfall', 'Ausfallhonorar', 'praxis_ein'],
    ['untervermietung', 'Untervermietung (inkl. Strom)', 'praxis_ein'],
    ['lehre', 'Lehre/Supervision/Selbsterfahrung', 'praxis_ein'],
    ['sonst_be', 'Sonstige Betriebseinnahmen', 'praxis_ein'],
    ['miete', 'Miete Praxiswohnung', 'praxis_aus'],
    ['nebenkosten', 'Nebenkosten', 'praxis_aus'],
    ['strom', 'Strom', 'praxis_aus'],
    ['software', 'Praxissoftware', 'praxis_aus'],
    ['telefon', 'Telefon/Internet', 'praxis_aus'],
    ['haftpflicht', 'Berufshaftpflicht', 'praxis_aus'],
    ['kammer', 'Kammer/Berufsverband', 'praxis_aus'],
    ['fortbildung', 'Fortbildung, Supervision, Literatur', 'praxis_aus'],
    ['steuerberatung', 'Steuerberatung', 'praxis_aus'],
    ['bank', 'Kontoführung/Bankgebühren', 'praxis_aus'],
    ['buero', 'Büro-/Praxisbedarf, Porto', 'praxis_aus'],
    ['reinigung', 'Reinigung, Instandhaltung, Ausstattung', 'praxis_aus'],
    ['marketing', 'Marketing', 'praxis_aus'],
    ['sonst_ba', 'Sonstige Betriebsausgaben', 'praxis_aus'],
    ['anschaffung', 'Anschaffung (AfA/GWG)', 'praxis_inv'],
    ['kvpv', 'Kranken-/Pflegeversicherung', 'vorsorge'],
    ['pvw', 'Versorgungswerk', 'vorsorge'],
    ['bu', 'Berufsunfähigkeitsversicherung', 'vorsorge'],
    ['ktg', 'Krankentagegeld', 'vorsorge'],
    ['vers_sonst', 'Weitere Versicherungen', 'vorsorge'],
    ['st_est', 'Einkommensteuer', 'steuer'],
    ['st_soli', 'Solidaritätszuschlag', 'steuer'],
    ['st_kist', 'Kirchensteuer', 'steuer'],
    ['lohn', 'Lohn/Gehalt (netto)', 'privat'],
    ['privat_ein', 'Sonstige private Einnahmen', 'privat'],
    ['entnahme', 'Privatentnahme („Gehalt“)', 'privat'],
    ['privat_aus', 'Private Ausgaben', 'privat'],
    ['sparen', 'Übertrag Spar-/Depotkonto', 'privat'],
    ['umbuchung', 'Umbuchung (neutral)', 'neutral']
  ].map(function (k) { return { id: k[0], name: k[1], gruppe: k[2] }; });
  var KATMAP = {}; KAT.forEach(function (k) { KATMAP[k.id] = k; });
  function gruppe(kat) { return kat && KATMAP[kat] ? KATMAP[kat].gruppe : null; }
  function katName(kat) { return kat && KATMAP[kat] ? KATMAP[kat].name : 'Ohne Kategorie'; }
  function katsIn(g) { return KAT.filter(function (k) { return k.gruppe === g; }); }
  // Kategorie aus Freitext (Import): akzeptiert Kürzel (z. B. "kvn") oder Anzeigename (z. B. "KVN-Honorar")
  function katNorm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9äöüß]/g, ''); }
  var KATTEXT = {}; KAT.forEach(function (k) { KATTEXT[katNorm(k.id)] = k.id; KATTEXT[katNorm(k.name)] = k.id; });
  function katAusText(s) { var n = katNorm(s); return n ? (KATTEXT[n] || null) : ''; }
  function katOptions(sel, mitLeer) {
    var h = mitLeer !== false ? '<option value=""' + (!sel ? ' selected' : '') + '>– ohne Kategorie –</option>' : '';
    GRUPPEN.forEach(function (g) {
      h += '<optgroup label="' + esc(g.name) + '">';
      katsIn(g.id).forEach(function (k) { h += '<option value="' + k.id + '"' + (sel === k.id ? ' selected' : '') + '>' + esc(k.name) + '</option>'; });
      h += '</optgroup>';
    });
    return h;
  }

  // ---------------------------------------------------------------- Daten
  function defaultData() {
    var now = new Date().toISOString();
    return {
      version: 1,
      meta: { erstellt: now, geaendert: now },
      settings: { inflation: 0.02, kistSatz: 0.09 },
      buchungen: [], regeln: [], kvn: {}, anlagen: [], pauschalen: [],
      steuer: {},
      hochrechnung: { methode: 'linear', kvnSitz: 0, kvnHon: 0, privSitz: 0, privHon: 0, urlaubRest: 0, manuell: {} },
      szenarien: [],
      csvMapping: null
    };
  }
  function migrate(d) {
    var base = defaultData();
    Object.keys(base).forEach(function (k) { if (d[k] == null) d[k] = base[k]; });
    d.settings = Object.assign(base.settings, d.settings);
    d.hochrechnung = Object.assign(base.hochrechnung, d.hochrechnung);
    return d;
  }
  function loadLocal() {
    try { var s = localStorage.getItem(STORE_KEY); return s ? migrate(JSON.parse(s)) : null; } catch (e) { return null; }
  }
  var D = loadLocal() || defaultData();

  var LOHN0 = { brutto: 0, werbungskosten: 0, rvAN: 0, rvAG: 0, kvAN: 0, pvAN: 0, avAN: 0, lohnsteuer: 0, soli: 0, kist: 0 };
  function st(y) {
    if (!D.steuer[y]) {
      D.steuer[y] = {
        zusammen: false, kistA: true, kistB: true, kvMitKrankengeld: false, agZuschussKV: 'auto',
        lohn: Object.assign({}, LOHN0),
        partner: { lohn: Object.assign({}, LOHN0), gewinn: 0, sonstigeEinkuenfte: 0, vorsorge: { pvw: 0, kvBasis: 0, pvBasis: 0, sonstige: 0 }, kistGezahlt: 0 },
        vz: { est: 0, soli: 0, kist: 0 },
        extra: { kvpv: 0, pvw: 0, sonstige: 0 }
      };
    }
    return D.steuer[y];
  }

  var speicherTimer = null;
  function save(ohneRender) {
    D.meta.geaendert = new Date().toISOString();
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(D));
    } catch (e) {
      toast('Speichern im Browser fehlgeschlagen: ' + e.message);
    }
    if (navigator.storage && navigator.storage.persist && !save.persistAngefragt) {
      save.persistAngefragt = true;
      navigator.storage.persist().catch(function () {});
    }
    clearTimeout(speicherTimer);
    speicherTimer = setTimeout(dateiSchreiben, 800);
    statusAnzeigen();
    // Erst rendern, wenn der Fokus (z. B. nach Tab) beim nächsten Feld angekommen ist
    if (!ohneRender) { clearTimeout(save.renderT); save.renderT = setTimeout(render, 0); }
  }

  // ---------------------------------------------------------------- Datei (File System Access API)
  var fileHandle = null;
  var dateiStatus = 'keine';   // keine | verbunden | erlaubnis | fehler
  var hatFS = 'showSaveFilePicker' in window;
  function idb() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open('finanzkompass', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function idbSet(k, v) { return idb().then(function (db) { return new Promise(function (res) { var t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; }); }); }
  function idbGet(k) { return idb().then(function (db) { return new Promise(function (res) { var r = db.transaction('kv').objectStore('kv').get(k); r.onsuccess = function () { res(r.result); }; r.onerror = function () { res(null); }; }); }); }
  function idbDel(k) { return idb().then(function (db) { return new Promise(function (res) { var t = db.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = res; }); }); }

  function dateiSchreiben() {
    if (!fileHandle) return Promise.resolve();
    return fileHandle.queryPermission({ mode: 'readwrite' }).then(function (p) {
      if (p !== 'granted') { dateiStatus = 'erlaubnis'; statusAnzeigen(); return; }
      return fileHandle.createWritable().then(function (w) {
        return w.write(JSON.stringify(D, null, 1)).then(function () { return w.close(); });
      }).then(function () { dateiStatus = 'verbunden'; dateiSchreiben.zuletzt = new Date(); statusAnzeigen(); });
    }).catch(function (e) { dateiStatus = 'fehler'; statusAnzeigen(); console.warn(e); });
  }
  function dateiLesen(handle) {
    return handle.getFile().then(function (f) { return f.text(); }).then(function (t) {
      if (!t.trim()) return null;
      return migrate(JSON.parse(t));
    });
  }
  function dateiVerbinden(neu) {
    var typen = [{ description: 'Finanzkompass-Daten', accept: { 'application/json': ['.json'] } }];
    var p = neu
      ? window.showSaveFilePicker({ suggestedName: 'finanzkompass-daten.json', types: typen })
      : window.showOpenFilePicker({ types: typen, multiple: false }).then(function (h) { return h[0]; });
    return p.then(function (h) {
      return h.requestPermission({ mode: 'readwrite' }).then(function (perm) {
        if (perm !== 'granted') throw new Error('Kein Schreibzugriff erteilt');
        fileHandle = h;
        return idbSet('handle', h).then(function () { return neu ? null : dateiLesen(h); });
      });
    }).then(function (inhalt) {
      if (inhalt && inhalt.buchungen) {
        var lokalLeer = !D.buchungen.length;
        if (lokalLeer || confirm('Die Datei enthält Daten vom ' + new Date(inhalt.meta.geaendert).toLocaleString('de-DE') +
          '. Sollen diese die Daten im Browser ersetzen?\n\nAbbrechen = Browser-Daten in die Datei schreiben.')) {
          D = inhalt;
          localStorage.setItem(STORE_KEY, JSON.stringify(D));
        }
      }
      return dateiSchreiben();
    }).then(function () { toast('Mit Datei „' + fileHandle.name + '“ verbunden'); render(); })
      .catch(function (e) { if (e && e.name !== 'AbortError') toast('Datei: ' + e.message); });
  }
  function dateiErneutErlauben() {
    if (!fileHandle) return;
    fileHandle.requestPermission({ mode: 'readwrite' }).then(function (p) {
      if (p !== 'granted') return;
      return dateiLesen(fileHandle).then(function (inhalt) {
        if (inhalt && inhalt.meta && inhalt.meta.geaendert > D.meta.geaendert) {
          if (confirm('Die Datei ist neuer (' + new Date(inhalt.meta.geaendert).toLocaleString('de-DE') + ') als die Browser-Daten. Datei laden?')) {
            D = inhalt; localStorage.setItem(STORE_KEY, JSON.stringify(D));
          }
        }
        dateiStatus = 'verbunden';
        return dateiSchreiben();
      });
    }).then(function () { render(); }).catch(function (e) { toast('Datei: ' + e.message); });
  }
  function dateiTrennen() {
    fileHandle = null; dateiStatus = 'keine';
    idbDel('handle').then(function () { render(); });
  }

  function statusAnzeigen() {
    var el = $('#status'); if (!el) return;
    var t, cls = '';
    if (fileHandle && dateiStatus === 'verbunden') t = 'Gespeichert in ' + fileHandle.name;
    else if (fileHandle && dateiStatus === 'erlaubnis') { t = 'Dateizugriff erneut erlauben (Daten)'; cls = 'warn'; }
    else if (fileHandle && dateiStatus === 'fehler') { t = 'Datei konnte nicht geschrieben werden'; cls = 'warn'; }
    else t = 'Gespeichert im Browser · ' + new Date(D.meta.geaendert).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    el.textContent = t; el.title = t; el.className = 'status ' + cls;
  }

  // ---------------------------------------------------------------- Auswertung
  function jahrVon(b) { return nz(b.steuerjahr) || +b.datum.slice(0, 4); }
  function afaFuer(an, Y) {
    var k = nz(an.kosten); if (!an.datum || !k) return 0;
    var y0 = +an.datum.slice(0, 4), m0 = +an.datum.slice(5, 7) - 1;
    if (an.gwg) return y0 === Y ? k : 0;
    var nd = Math.max(1, nz(an.nd) || 1);
    var start = y0 * 12 + m0, ende = start + nd * 12, ys = Y * 12, ye = ys + 12;
    var monate = Math.max(0, Math.min(ye, ende) - Math.max(ys, start));
    return k / nd * monate / 12;
  }

  function auswertung(Y) {
    var heute = new Date(), curY = heute.getFullYear();
    var ist = {}, mon = [], stichtag = null, unkat = 0, kistKalender = 0;
    for (var i = 0; i < 12; i++) mon.push({ ein: 0, aus: 0 });
    D.buchungen.forEach(function (b) {
      var cy = +b.datum.slice(0, 4);
      var g = gruppe(b.kat);
      if (cy === Y) {
        if (!stichtag || b.datum > stichtag) stichtag = b.datum;
        if (!b.kat) unkat++;
        var m = +b.datum.slice(5, 7) - 1;
        if (g === 'praxis_ein') mon[m].ein += b.betrag;
        else if (g === 'praxis_aus' || g === 'praxis_inv') mon[m].aus -= b.betrag;
        if (b.kat === 'st_kist') kistKalender -= b.betrag;
      }
      if (b.kat && jahrVon(b) === Y) ist[b.kat] = (ist[b.kat] || 0) + b.betrag;
    });

    // Anteil des Jahres, für den Ist-Daten vorliegen
    var t, ref = null;
    if (Y < curY) t = 1;
    else if (Y > curY) t = 0;
    else { ref = stichtag ? new Date(stichtag + 'T12:00:00') : heute; t = tagImJahr(ref) / tageImJahr(Y); }
    var restWochen = Y === curY ? Math.max(0, (tageImJahr(Y) - tagImJahr(ref || heute)) / 7) : (Y > curY ? 52 : 0);

    var H = D.hochrechnung, man = (H.manuell && H.manuell[Y]) || {};
    var vorz = function (k) { var g = gruppe(k); return g === 'praxis_ein' ? 1 : -1; };
    var restSitzung = function (sitz, hon) { return Math.max(0, restWochen - nz(H.urlaubRest)) * nz(sitz) * nz(hon); };
    function jw(k) {
      var v = ist[k] || 0;
      if (t >= 1) return v;
      if (H.methode === 'manuell' && man[k] !== undefined && man[k] !== '' && man[k] !== null) return nz(man[k]) * vorz(k);
      if (H.methode === 'sitzungen' && k === 'kvn') return v + restSitzung(H.kvnSitz, H.kvnHon);
      if (H.methode === 'sitzungen' && k === 'privat') return v + restSitzung(H.privSitz, H.privHon);
      if (t < 0.04) return v;
      return v / t;
    }
    var prog = {};
    KAT.forEach(function (k) { prog[k.id] = jw(k.id); });

    function summe(obj, g) { return katsIn(g).reduce(function (s, k) { return s + (obj[k.id] || 0); }, 0); }
    var afa = D.anlagen.reduce(function (s, a) { return s + afaFuer(a, Y); }, 0);
    var pausch = D.pauschalen.filter(function (p) { return +p.jahr === Y; }).reduce(function (s, p) { return s + nz(p.betrag); }, 0);

    function block(o, anteil) {
      var ein = summe(o, 'praxis_ein'), aus = -summe(o, 'praxis_aus'), inv = -summe(o, 'praxis_inv');
      var afaA = afa * anteil, pauschA = pausch * anteil;
      return {
        ein: ein, aus: aus, inv: inv, afa: afaA, pausch: pauschA,
        gewinn: ein - aus - afaA - pauschA,
        cashflow: ein - aus - inv,
        vorsorge: {
          kvpv: -(o.kvpv || 0), pvw: -(o.pvw || 0), bu: -(o.bu || 0), ktg: -(o.ktg || 0), vers_sonst: -(o.vers_sonst || 0)
        }
      };
    }
    var I = block(ist, Math.min(1, t));
    var P = block(prog, 1);

    var S = st(Y);
    var ex = S.extra || {};
    var vorsorgeJahr = {
      kvpv: P.vorsorge.kvpv + nz(ex.kvpv),
      pvw: P.vorsorge.pvw + nz(ex.pvw),
      sonstige: P.vorsorge.bu + P.vorsorge.ktg + P.vorsorge.vers_sonst + nz(ex.sonstige)
    };
    vorsorgeJahr.gesamt = vorsorgeJahr.kvpv + vorsorgeJahr.pvw + vorsorgeJahr.sonstige;

    // Steuerzahlungen für das Steuerjahr Y (Vorzeichen: Zahlung positiv)
    var bezahlt = { est: -(ist.st_est || 0), soli: -(ist.st_soli || 0), kist: -(ist.st_kist || 0) };
    var vzPlan = { est: nz(S.vz.est), soli: nz(S.vz.soli), kist: nz(S.vz.kist) };
    var vzOffen = { est: Math.max(0, vzPlan.est - bezahlt.est), soli: Math.max(0, vzPlan.soli - bezahlt.soli), kist: Math.max(0, vzPlan.kist - bezahlt.kist) };
    if (Y < curY) vzOffen = { est: 0, soli: 0, kist: 0 };

    // Im Kalenderjahr gezahlte Kirchensteuer (Sonderausgabe): Ist + noch fällige Vorauszahlung + Lohnabzug
    var kistGezahlt = kistKalender + (Y >= curY ? vzOffen.kist : 0) + nz(S.lohn.kist);

    var zuschuss = S.agZuschussKV === 'auto' ? null : S.agZuschussKV === 'ja';
    var eingabe = {
      jahr: Y, inflation: D.settings.inflation, zusammen: !!S.zusammen, kistSatz: D.settings.kistSatz,
      a: {
        gewinn: P.gewinn,
        lohn: Object.assign({}, S.lohn),
        vorsorge: { pvw: vorsorgeJahr.pvw, kvBasis: vorsorgeJahr.kvpv, pvBasis: 0, kvMitKrankengeld: !!S.kvMitKrankengeld, sonstige: vorsorgeJahr.sonstige },
        kistPflicht: !!S.kistA, kistGezahlt: kistGezahlt, agZuschussKV: zuschuss
      },
      b: {
        gewinn: nz(S.partner.gewinn), sonstigeEinkuenfte: nz(S.partner.sonstigeEinkuenfte),
        lohn: Object.assign({}, S.partner.lohn),
        vorsorge: S.partner.vorsorge,
        kistPflicht: !!S.kistB, kistGezahlt: nz(S.partner.kistGezahlt) + nz(S.partner.lohn.kist)
      },
      vorauszahlungen: { est: bezahlt.est + vzOffen.est, soli: bezahlt.soli + vzOffen.soli, kist: bezahlt.kist + vzOffen.kist }
    };
    var R = Steuer.berechne(eingabe);

    var L = S.lohn;
    var lohnNetto = nz(L.brutto) - nz(L.rvAN) - nz(L.kvAN) - nz(L.pvAN) - nz(L.avAN);
    var partnerNetto = 0;
    if (S.zusammen) {
      var PL = S.partner.lohn, PV = S.partner.vorsorge;
      partnerNetto = nz(PL.brutto) - nz(PL.rvAN) - nz(PL.kvAN) - nz(PL.pvAN) - nz(PL.avAN) + nz(S.partner.gewinn) + nz(S.partner.sonstigeEinkuenfte)
        - nz(PV.pvw) - nz(PV.kvBasis) - nz(PV.pvBasis) - nz(PV.sonstige);
    }
    var verfuegbar = P.cashflow + lohnNetto + partnerNetto - R.gesamt - vorsorgeJahr.gesamt;

    var nochZuZahlen = vzOffen.est + vzOffen.soli + vzOffen.kist + Math.max(0, R.offenGesamt);
    var monateRest = Y === curY ? Math.max(1, 11 - (ref || heute).getMonth()) : (Y > curY ? 12 : 1);

    return {
      Y: Y, t: t, stichtag: stichtag, unkat: unkat, mon: mon, ist: ist, prog: prog,
      I: I, P: P, afa: afa, pausch: pausch, vorsorgeJahr: vorsorgeJahr,
      bezahlt: bezahlt, vzPlan: vzPlan, vzOffen: vzOffen, kistGezahlt: kistGezahlt,
      R: R, lohnNetto: lohnNetto, partnerNetto: partnerNetto, verfuegbar: verfuegbar,
      nochZuZahlen: nochZuZahlen, monateRest: monateRest,
      ruecklageMonat: nochZuZahlen / monateRest,
      ruecklageQuote: P.gewinn > 0 ? R.gesamt / (P.gewinn + Math.max(0, lohnNetto)) : 0,
      vergangen: Y < curY, zukunft: Y > curY
    };
  }

  // ---------------------------------------------------------------- Szenarien
  var SZ_FELDER = [
    { grp: 'Praxisbetrieb' },
    { k: 'wochen', n: 'Arbeitswochen' },
    { k: 'kvnSitz', n: 'KVN: Sitzungen/Woche' },
    { k: 'kvnHon', n: 'KVN: Honorar je Sitzung (€)', w: 'h' },
    { k: 'kvnBetrag', n: 'KVN: Jahresbetrag (ersetzt Sitzungen)', w: 'h' },
    { k: 'privSitz', n: 'Privat: Sitzungen/Woche' },
    { k: 'privHon', n: 'Privat: Honorar je Sitzung (€)', w: 'h' },
    { k: 'privBetrag', n: 'Privat: Jahresbetrag (ersetzt Sitzungen)', w: 'h' },
    { k: 'ausfall', n: 'Ausfallhonorar (€/Jahr)', w: 'h' },
    { k: 'untervermietung', n: 'Untervermietung (€/Jahr)', w: 'k' },
    { k: 'lehre', n: 'Lehre/Supervision/SE (€/Jahr)', w: 'h' },
    { k: 'sonstEin', n: 'Sonstige Einnahmen (€/Jahr)', w: 'h' },
    { k: 'ausgaben', n: 'Betriebsausgaben (€/Jahr)', w: 'k' },
    { k: 'invest', n: 'Anschaffungen (€/Jahr)', w: 'k' },
    { k: 'afa', n: 'AfA (€/Jahr)', w: 'k' },
    { grp: 'Private Vorsorge' },
    { k: 'kvpv', n: 'Kranken-/Pflegeversicherung (€/Jahr)', w: 'v' },
    { k: 'pvw', n: 'Versorgungswerk (€/Jahr)', w: 'v' },
    { k: 'versich', n: 'BU, KTG, weitere (€/Jahr)', w: 'v' },
    { grp: 'Steuerliche Lage' },
    { k: 'zusammen', n: 'Zusammenveranlagung (1 = ja)' },
    { k: 'partnerEink', n: 'Partnerin: Einkünfte (€/Jahr)' },
    { k: 'partnerVorsorge', n: 'Partnerin: Vorsorgeabzug (€/Jahr)' },
    { k: 'kist', n: 'Kirchensteuer (1 = ja)' }
  ];
  function szJahrLeer() {
    var o = {}; SZ_FELDER.forEach(function (f) { if (f.k) o[f.k] = 0; });
    o.wochen = 42; o.kist = 1; return o;
  }
  function szNeu(name) {
    var cur = new Date().getFullYear(), jahre = {};
    for (var y = cur + 1; y <= cur + 5; y++) jahre[y] = szJahrLeer();
    return { id: uid(), name: name || 'Basis', wachstum: { h: 0.02, k: 0.02, v: 0.03 }, jahre: jahre };
  }
  function szRechne(sz, y) {
    var j = sz.jahre[y], W = nz(j.wochen);
    var kvn = nz(j.kvnBetrag) > 0 ? nz(j.kvnBetrag) : nz(j.kvnSitz) * nz(j.kvnHon) * W;
    var priv = nz(j.privBetrag) > 0 ? nz(j.privBetrag) : nz(j.privSitz) * nz(j.privHon) * W;
    var umsatz = kvn + priv + nz(j.ausfall) + nz(j.untervermietung) + nz(j.lehre) + nz(j.sonstEin);
    var gewinn = umsatz - nz(j.ausgaben) - nz(j.afa);
    var zus = nz(j.zusammen) === 1, kist = nz(j.kist) === 1;
    var eingabe = function (kistGezahlt) {
      return {
        jahr: +y, inflation: D.settings.inflation, zusammen: zus, kistSatz: D.settings.kistSatz,
        a: { gewinn: gewinn, vorsorge: { pvw: nz(j.pvw), kvBasis: nz(j.kvpv), sonstige: nz(j.versich) }, kistPflicht: kist, kistGezahlt: kistGezahlt },
        b: { sonstigeEinkuenfte: nz(j.partnerEink), vorsorge: { kvBasis: nz(j.partnerVorsorge) }, kistPflicht: kist }
      };
    };
    var r = Steuer.berechne(eingabe(0));
    r = Steuer.berechne(eingabe(r.kist));
    var cash = umsatz - nz(j.ausgaben) - nz(j.invest) + (zus ? nz(j.partnerEink) - nz(j.partnerVorsorge) : 0);
    var verf = cash - r.gesamt - nz(j.kvpv) - nz(j.pvw) - nz(j.versich);
    return { umsatz: umsatz, gewinn: gewinn, R: r, verfuegbar: verf };
  }
  function szFortschreiben(sz) {
    var ys = Object.keys(sz.jahre).map(Number).sort();
    if (ys.length < 2) return;
    var basis = sz.jahre[ys[0]];
    ys.slice(1).forEach(function (y, i) {
      var n = i + 1, ziel = {};
      SZ_FELDER.forEach(function (f) {
        if (!f.k) return;
        var v = nz(basis[f.k]);
        if (f.w) v = Math.round(v * Math.pow(1 + nz(sz.wachstum[f.w]), n) * 100) / 100;
        ziel[f.k] = v;
      });
      sz.jahre[y] = ziel;
    });
  }

  // ---------------------------------------------------------------- CSV
  function erkenneTrenner(zeilen) {
    var kand = [';', ',', '\t'], best = ';', bestN = -1;
    kand.forEach(function (c) {
      var n = zeilen.slice(0, 20).reduce(function (s, z) { return s + splitCSV(z, c).length; }, 0);
      if (n > bestN) { bestN = n; best = c; }
    });
    return best;
  }
  function splitCSV(zeile, t) {
    var out = [], cur = '', q = false;
    for (var i = 0; i < zeile.length; i++) {
      var c = zeile[i];
      if (q) {
        if (c === '"') { if (zeile[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === t) { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out.map(function (s) { return s.trim(); });
  }
  function zeilenAus(text) {
    // Zeilenumbrüche innerhalb von Anführungszeichen erhalten
    var zeilen = [], cur = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (c === '"') q = !q;
      if ((c === '\n' || c === '\r') && !q) {
        if (c === '\r' && text[i + 1] === '\n') i++;
        zeilen.push(cur); cur = '';
      } else cur += c;
    }
    if (cur) zeilen.push(cur);
    return zeilen.filter(function (z) { return z.trim() !== ''; });
  }
  function parseBetrag(s) {
    if (s == null) return NaN;
    s = String(s).replace(/\s|€|EUR/gi, '');
    if (!s) return NaN;
    var neg = false;
    if (/[-−]$/.test(s)) { neg = true; s = s.slice(0, -1); }
    if (/S$/i.test(s)) { neg = true; s = s.slice(0, -1); } else if (/H$/i.test(s)) s = s.slice(0, -1);
    if (/^[-−]/.test(s)) { neg = !neg; s = s.slice(1); }
    if (/^\+/.test(s)) s = s.slice(1);
    var lk = s.lastIndexOf(','), lp = s.lastIndexOf('.');
    if (lk > lp) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
    var n = parseFloat(s);
    return isNaN(n) ? NaN : (neg ? -n : n);
  }
  function parseDatum(s) {
    s = String(s || '').trim();
    var m;
    if ((m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/))) {
      var y = +m[3]; if (y < 100) y += 2000;
      return y + '-' + pad(+m[2]) + '-' + pad(+m[1]);
    }
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return m[1] + '-' + m[2] + '-' + m[3];
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return m[3] + '-' + pad(+m[2]) + '-' + pad(+m[1]);
    return null;
  }
  function normIBAN(s) { return String(s || '').replace(/\s/g, '').toUpperCase(); }
  function importSchluessel(b) {
    return b.datum + '|' + b.betrag.toFixed(2) + '|' + (normIBAN(b.iban) || '') + '|' + String(b.text || '').replace(/\s+/g, ' ').slice(0, 60).toLowerCase();
  }
  function regelFuer(b) {
    for (var i = 0; i < D.regeln.length; i++) {
      var r = D.regeln[i], m = String(r.muster || '').toLowerCase().trim();
      if (!m) continue;
      if (r.feld === 'iban' && normIBAN(b.iban) && normIBAN(b.iban) === normIBAN(r.muster)) return r;
      if (r.feld === 'name' && String(b.gegenpartei || '').toLowerCase().indexOf(m) >= 0) return r;
      if (r.feld === 'text' && String(b.text || '').toLowerCase().indexOf(m) >= 0) return r;
      if (r.feld === 'art' && String(b.art || '').toLowerCase().indexOf(m) >= 0) return r;
      if (r.feld === 'alle' && (String(b.gegenpartei || '') + ' ' + String(b.text || '') + ' ' + String(b.art || '')).toLowerCase().indexOf(m) >= 0) return r;
    }
    return null;
  }
  function regelnAnwenden(nurLeere) {
    var n = 0;
    D.buchungen.forEach(function (b) {
      if (nurLeere && b.kat) return;
      var r = regelFuer(b);
      if (r && b.kat !== r.kat) { b.kat = r.kat; n++; }
    });
    return n;
  }

  // ---------------------------------------------------------------- UI-Grundgerüst
  var ICON = {
    uebersicht: '<path d="M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z"/>',
    buchungen: '<path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
    steuer: '<path d="M7 3h10l4 4v14H3V3h4zm2 6h6M9 13h6M9 17h4" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>',
    kvn: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
    planung: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    daten: '<path d="M12 3c4.4 0 8 1.3 8 3v12c0 1.7-3.6 3-8 3s-8-1.3-8-3V6c0-1.7 3.6-3 8-3zm8 3c0 1.7-3.6 3-8 3S4 7.7 4 6m16 6c0 1.7-3.6 3-8 3s-8-1.3-8-3" stroke="currentColor" stroke-width="2" fill="none"/>'
  };
  var TABS = [
    ['uebersicht', 'Übersicht'], ['buchungen', 'Buchungen'], ['steuer', 'Steuer'],
    ['kvn', 'KVN'], ['planung', 'Planung'], ['daten', 'Daten']
  ];
  var ui = {
    tab: (location.hash || '').replace('#', '') || 'uebersicht',
    jahr: new Date().getFullYear(),
    filter: { monat: '', kat: '', suche: '', limit: 200 },
    szId: null
  };
  if (!TABS.some(function (t) { return t[0] === ui.tab; })) ui.tab = 'uebersicht';

  function navRendern() {
    $('#tabs').innerHTML = TABS.map(function (t) {
      return '<button data-tab="' + t[0] + '"' + (ui.tab === t[0] ? ' aria-current="page"' : '') + '><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' + ICON[t[0]] + '</svg>' + t[1] + '</button>';
    }).join('');
  }
  function jahreRendern() {
    var cur = new Date().getFullYear(), set = {};
    set[cur] = 1; set[cur - 1] = 1;
    D.buchungen.forEach(function (b) { set[+b.datum.slice(0, 4)] = 1; });
    Object.keys(D.steuer).forEach(function (y) { set[y] = 1; });
    var ys = Object.keys(set).map(Number).sort(function (a, b) { return b - a; });
    $('#jahr').innerHTML = ys.map(function (y) { return '<option' + (y === ui.jahr ? ' selected' : '') + '>' + y + '</option>'; }).join('');
  }

  function render() {
    var ae = document.activeElement;
    var fokus = ae && ae.dataset ? (ae.dataset.bind || ae.id || null) : null;
    var scroll = window.scrollY;
    navRendern(); jahreRendern(); statusAnzeigen();
    var m = $('#main');
    var f = VIEWS[ui.tab] || VIEWS.uebersicht;
    m.innerHTML = f();
    if (fokus) {
      var el = $('[data-bind="' + fokus + '"]', m) || document.getElementById(fokus);
      if (el && el !== document.body) { try { el.focus({ preventScroll: true }); } catch (e) { /* ignorieren */ } }
    }
    window.scrollTo(0, scroll);
    bindCharts();
  }

  // ---------------------------------------------------------------- Bausteine
  function tile(label, wert, sub, cls) {
    return '<div class="tile ' + (cls || '') + '"><div class="label">' + label + '</div><div class="value">' + wert + '</div>' + (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div>';
  }
  function zahlFeld(pfad, wert, label, hilfe) {
    return '<label class="f"><span>' + label + '</span><input type="number" step="0.01" inputmode="decimal" data-bind="' + pfad + '" value="' + (wert === 0 || wert ? wert : '') + '">' + (hilfe ? '<span class="muted small">' + hilfe + '</span>' : '') + '</label>';
  }
  function getPath(pfad) {
    return pfad.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, D);
  }
  function setPath(pfad, wert) {
    var teile = pfad.split('.'), o = D;
    for (var i = 0; i < teile.length - 1; i++) { if (o[teile[i]] == null) o[teile[i]] = {}; o = o[teile[i]]; }
    o[teile[teile.length - 1]] = wert;
  }

  // Säulendiagramm: Einnahmen vs. Ausgaben je Monat
  function monatsChart(mon) {
    var W = schmal() ? 380 : 640, H = 220, pl = 46, pr = 8, pt = 10, pb = 26;
    var max = Math.max(1, Math.max.apply(null, mon.map(function (m) { return Math.max(m.ein, m.aus); })));
    var step = schoeneSchritte(max);
    var top = Math.ceil(max / step) * step;
    var bw = (W - pl - pr) / 12, barW = Math.min(14, (bw - 10) / 2);
    var y = function (v) { return pt + (H - pt - pb) * (1 - Math.max(0, v) / top); };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Einnahmen und Ausgaben je Monat">';
    for (var v = 0; v <= top + 1e-6; v += step) {
      s += '<line class="gridline" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>';
      s += '<g class="axis"><text x="' + (pl - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + kurz(v) + '</text></g>';
    }
    mon.forEach(function (m, i) {
      var x0 = pl + i * bw + bw / 2;
      s += saeule(x0 - barW - 1, barW, y(m.ein), y(0), 'var(--series-1)');
      s += saeule(x0 + 1, barW, y(m.aus), y(0), 'var(--series-2)');
      s += '<g class="axis"><text x="' + x0 + '" y="' + (H - 8) + '" text-anchor="middle">' + MONATE[i] + '</text></g>';
      s += '<rect x="' + (pl + i * bw) + '" y="' + pt + '" width="' + bw + '" height="' + (H - pt - pb) + '" fill="transparent" data-tip="<b>' + MONATE[i] + '</b><br>Einnahmen ' + esc(eur(m.ein)) + '<br>Ausgaben ' + esc(eur(m.aus)) + '<br>Saldo ' + esc(eur(m.ein - m.aus)) + '"/>';
    });
    s += '</svg>';
    return '<div class="legend"><span><i style="background:var(--series-1)"></i>Einnahmen Praxis</span><span><i style="background:var(--series-2)"></i>Ausgaben Praxis (inkl. Anschaffungen)</span></div><div class="chart">' + s + '<div class="tip"></div></div>';
  }
  function saeule(x, w, yTop, yBase, farbe) {
    var h = Math.max(0, yBase - yTop); if (h < 0.5) return '';
    var r = Math.min(4, h, w / 2);
    return '<path fill="' + farbe + '" d="M' + x + ' ' + yBase + 'V' + (yTop + r) + 'Q' + x + ' ' + yTop + ' ' + (x + r) + ' ' + yTop + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + yTop + ' ' + (x + w) + ' ' + (yTop + r) + 'V' + yBase + 'Z"/>';
  }
  function schmal() { return window.innerWidth < 760; }
  function schoeneSchritte(max) {
    var roh = max / 4, p = Math.pow(10, Math.floor(Math.log10(roh))), n = roh / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }
  function kurz(v) {
    var a = Math.abs(v);
    if (a >= 1e6) return (v / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' Mio';
    if (a >= 1e3) return (v / 1e3).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' T';
    return Math.round(v).toLocaleString('de-DE');
  }
  // Liniendiagramm: verfügbarer Betrag je Monat in den Szenarien
  function linienChart(serien, jahre) {
    var W = schmal() ? 380 : 640, H = 220, pl = 52, pr = 16, pt = 12, pb = 26;
    var alle = []; serien.forEach(function (s) { s.werte.forEach(function (v) { alle.push(v); }); });
    if (!alle.length) return '';
    var min = Math.min(0, Math.min.apply(null, alle)), max = Math.max(1, Math.max.apply(null, alle));
    var step = schoeneSchritte(max - min), lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    var x = function (i) { return jahre.length === 1 ? (pl + W - pr) / 2 : pl + (W - pl - pr) * i / (jahre.length - 1); };
    var y = function (v) { return pt + (H - pt - pb) * (1 - (v - lo) / (hi - lo)); };
    var farben = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)'];
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Verfügbar pro Monat je Szenario">';
    for (var v = lo; v <= hi + 1e-6; v += step) {
      s += '<line class="gridline" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>';
      s += '<g class="axis"><text x="' + (pl - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + kurz(v) + '</text></g>';
    }
    jahre.forEach(function (j, i) { s += '<g class="axis"><text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + j + '</text></g>'; });
    serien.forEach(function (se, si) {
      var d = se.werte.map(function (v, i) { return (i ? 'L' : 'M') + x(i) + ' ' + y(v); }).join('');
      s += '<path d="' + d + '" fill="none" stroke="' + farben[si] + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
      se.werte.forEach(function (v, i) { s += '<circle cx="' + x(i) + '" cy="' + y(v) + '" r="4" fill="' + farben[si] + '" stroke="var(--surface)" stroke-width="2"/>'; });
    });
    jahre.forEach(function (j, i) {
      var w = (W - pl - pr) / Math.max(1, jahre.length - 1);
      var tip = '<b>' + j + '</b>' + serien.map(function (se) { return '<br>' + esc(se.name) + ': ' + esc(eur(se.werte[i])); }).join('');
      s += '<rect x="' + (x(i) - w / 2) + '" y="' + pt + '" width="' + w + '" height="' + (H - pt - pb) + '" fill="transparent" data-tip="' + tip + '"/>';
    });
    s += '</svg>';
    var leg = serien.length > 1 ? '<div class="legend">' + serien.map(function (se, si) { return '<span><i style="background:' + farben[si] + '"></i>' + esc(se.name) + '</span>'; }).join('') + '</div>' : '';
    return leg + '<div class="chart">' + s + '<div class="tip"></div></div>';
  }
  function bindCharts() {
    $$('.chart').forEach(function (c) {
      var tip = $('.tip', c);
      var zeigen = function (e) {
        var t = e.target.closest('[data-tip]');
        if (!t) { tip.style.display = 'none'; return; }
        tip.innerHTML = t.getAttribute('data-tip');
        tip.style.display = 'block';
        var r = c.getBoundingClientRect(), pt = e.touches ? e.touches[0] : e;
        var xx = pt.clientX - r.left + 12, yy = pt.clientY - r.top - 10;
        if (xx + tip.offsetWidth > r.width) xx = pt.clientX - r.left - tip.offsetWidth - 12;
        tip.style.left = Math.max(0, xx) + 'px'; tip.style.top = Math.max(0, yy) + 'px';
      };
      c.addEventListener('mousemove', zeigen);
      c.addEventListener('touchstart', zeigen, { passive: true });
      c.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
    });
  }

  // ---------------------------------------------------------------- Ansicht: Übersicht
  function viewUebersicht() {
    var A = auswertung(ui.jahr), Y = ui.jahr;
    var h = '<h1>Übersicht ' + Y + '</h1>';
    if (!D.buchungen.length) {
      return h + '<p class="lead">Noch keine Buchungen. Starte mit dem CSV-Import der apoBank-Umsätze oder lege Buchungen von Hand an.</p>' +
        '<div class="card"><div class="btns"><button class="btn primary" data-act="csv">Kontoumsätze importieren (Excel/CSV)</button><button class="btn" data-act="neu">Buchung anlegen</button>' +
        (hatFS ? '<button class="btn" data-act="datei-neu">Datendatei anlegen</button><button class="btn" data-act="datei-oeffnen">Vorhandene Datendatei öffnen</button>' : '<button class="btn" data-act="import-json">Datensicherung einlesen</button>') +
        '</div></div>';
    }
    var stand = A.vergangen ? 'Abgeschlossenes Jahr' : A.zukunft ? 'Planjahr ohne Ist-Daten' :
      'Ist-Daten bis ' + datumDE(A.stichtag) + ' (' + pct(A.t, 0) + ' des Jahres) · Hochrechnung: ' + ({ linear: 'linear', sitzungen: 'über Sitzungen', manuell: 'manuelle Planwerte' })[D.hochrechnung.methode];
    h += '<p class="lead">' + stand + '</p>';
    if (A.unkat) h += '<div class="note warn"><b>' + A.unkat + ' Buchungen ohne Kategorie.</b> Sie fehlen in Gewinn und Steuer. <a href="#" data-act="zeige-unkat">Jetzt zuordnen</a></div>';
    if (fileHandle && dateiStatus === 'erlaubnis') h += '<div class="note warn"><b>Dateizugriff erneut erlauben.</b> Der Browser verlangt nach dem Neustart eine Bestätigung. <a href="#" data-act="datei-erlauben">Erlauben</a></div>';
    if (A.R.avUeberHB > 0) h += '<div class="note bad"><b>Altersvorsorge über dem Höchstbetrag:</b> ' + eur(A.R.avUeberHB) + ' wirken steuerlich nicht.</div>';

    h += '<div class="tiles">' +
      tile('Verfügbar pro Monat' + (A.t < 1 ? ' (Prognose)' : ''), eur(A.verfuegbar / 12), 'nach Steuern und privater Vorsorge' + (st(Y).zusammen ? ' · Haushalt' : ''), 'hero') +
      tile('Steuerlicher Gewinn', eur(A.P.gewinn), A.t < 1 ? 'Ist ' + eur(A.I.gewinn) : 'EÜR') +
      tile('Steuern ' + Y, eur(A.R.gesamt), 'ESt, Soli, KiSt · Ø ' + pct(A.R.durchschnitt) + ' · Grenz ' + pct(A.R.grenz, 0)) +
      tile('Noch zu zahlen', eur(A.nochZuZahlen), 'offene Vorauszahlungen + erwartete Nachzahlung') +
      tile('Rücklage pro Monat', eur(A.ruecklageMonat), A.monateRest + ' Monat(e) bis Jahresende') +
      '</div>';

    h += '<div class="card"><h2>Einnahmen und Ausgaben je Monat</h2>' + monatsChart(A.mon) + '</div>';

    // Tabelle Ist / Prognose
    var zeile = function (n, i, p, cls) { return '<tr class="' + (cls || '') + '"><td' + (cls === 'sub' ? ' class="indent"' : '') + '>' + n + '</td><td class="num">' + eur(i) + '</td>' + (A.t < 1 ? '<td class="num">' + eur(p) + '</td>' : '') + '</tr>'; };
    var t = '<div class="tablewrap"><table><thead><tr><th></th><th class="num">Ist</th>' + (A.t < 1 ? '<th class="num">Prognose</th>' : '') + '</tr></thead><tbody>';
    t += zeile('<b>Betriebseinnahmen</b>', A.I.ein, A.P.ein);
    katsIn('praxis_ein').forEach(function (k) { var i = A.ist[k.id] || 0, p = A.prog[k.id] || 0; if (i || p) t += zeile(k.name, i, p, 'sub'); });
    t += zeile('<b>Betriebsausgaben</b>', -A.I.aus, -A.P.aus);
    katsIn('praxis_aus').forEach(function (k) { var i = A.ist[k.id] || 0, p = A.prog[k.id] || 0; if (i || p) t += zeile(k.name, i, p, 'sub'); });
    t += zeile('Abschreibungen (AfA/GWG)', -A.I.afa, -A.P.afa, 'sub');
    if (A.pausch) t += zeile('Pauschalen (nicht kontowirksam)', -A.I.pausch, -A.P.pausch, 'sub');
    t += zeile('<b>Steuerlicher Gewinn</b>', A.I.gewinn, A.P.gewinn, 'sum');
    t += zeile('Anschaffungen (Abfluss)', -A.I.inv, -A.P.inv, 'sub');
    t += zeile('<b>Cashflow-Überschuss Praxis</b>', A.I.cashflow, A.P.cashflow, 'sum');
    t += '</tbody></table></div>';
    h += '<div class="card"><h2>Ergebnis</h2>' + t + '</div>';

    // Vom Cashflow zum verfügbaren Betrag
    var v = '<table><tbody>';
    v += '<tr><td>Cashflow-Überschuss Praxis</td><td class="num">' + eur(A.P.cashflow) + '</td></tr>';
    if (A.lohnNetto) v += '<tr><td>+ Lohn aus Anstellung (nach Sozialabgaben)</td><td class="num">' + eur(A.lohnNetto) + '</td></tr>';
    if (A.partnerNetto) v += '<tr><td>+ Partnerin (nach Abgaben und Vorsorge)</td><td class="num">' + eur(A.partnerNetto) + '</td></tr>';
    v += '<tr><td>− Einkommensteuer, Soli, Kirchensteuer (Jahressteuer)</td><td class="num">' + eur(-A.R.gesamt) + '</td></tr>';
    v += '<tr><td>− Kranken-/Pflegeversicherung</td><td class="num">' + eur(-A.vorsorgeJahr.kvpv) + '</td></tr>';
    v += '<tr><td>− Versorgungswerk</td><td class="num">' + eur(-A.vorsorgeJahr.pvw) + '</td></tr>';
    v += '<tr><td>− BU, Krankentagegeld, weitere Versicherungen</td><td class="num">' + eur(-A.vorsorgeJahr.sonstige) + '</td></tr>';
    v += '<tr class="sum"><td>Verfügbar im Jahr</td><td class="num">' + eur(A.verfuegbar) + '</td></tr>';
    v += '<tr><td>Verfügbar pro Monat</td><td class="num">' + eur(A.verfuegbar / 12) + '</td></tr>';
    v += '</tbody></table>';
    h += '<div class="card"><h2>Vom Cashflow zum verfügbaren Betrag</h2>' + v +
      '<p class="muted small">Steuerrücklage: von jedem Euro Gewinn rund ' + Math.round(A.ruecklageQuote * 100) + ' Cent für Steuern zurücklegen.</p></div>';
    return h;
  }

  // ---------------------------------------------------------------- Ansicht: Buchungen
  function buchungenGefiltert() {
    var f = ui.filter, Y = ui.jahr, q = f.suche.toLowerCase();
    return D.buchungen.filter(function (b) {
      if (+b.datum.slice(0, 4) !== Y) return false;
      if (f.monat && +b.datum.slice(5, 7) !== +f.monat) return false;
      if (f.kat === '_leer' && b.kat) return false;
      if (f.kat && f.kat !== '_leer') {
        if (f.kat.indexOf('g:') === 0) { if (gruppe(b.kat) !== f.kat.slice(2)) return false; }
        else if (b.kat !== f.kat) return false;
      }
      if (q && (String(b.gegenpartei) + ' ' + String(b.text) + ' ' + String(b.art || '') + ' ' + String(b.notiz || '') + ' ' + b.betrag).toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) { return a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0; });
  }
  function viewBuchungen() {
    var f = ui.filter, liste = buchungenGefiltert();
    var summe = liste.reduce(function (s, b) { return s + b.betrag; }, 0);
    var h = '<h1>Buchungen ' + ui.jahr + '</h1><p class="lead">Kategorie direkt in der Liste ändern; Klick auf eine Buchung öffnet alle Felder.</p>';
    h += '<div class="btns" style="margin:0 0 14px"><button class="btn primary" data-act="neu">Buchung anlegen</button><button class="btn" data-act="csv">Excel/CSV importieren</button><button class="btn" data-act="regeln-anwenden">Regeln auf leere anwenden</button></div>';
    h += '<div class="filters">' +
      '<select id="f-monat" data-filter="monat"><option value="">Alle Monate</option>' + MONATE.map(function (m, i) { return '<option value="' + (i + 1) + '"' + (+f.monat === i + 1 ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select>' +
      '<select id="f-kat" data-filter="kat"><option value="">Alle Kategorien</option><option value="_leer"' + (f.kat === '_leer' ? ' selected' : '') + '>Ohne Kategorie</option>' +
      GRUPPEN.map(function (g) { return '<option value="g:' + g.id + '"' + (f.kat === 'g:' + g.id ? ' selected' : '') + '>Gruppe: ' + esc(g.name) + '</option>'; }).join('') +
      KAT.map(function (k) { return '<option value="' + k.id + '"' + (f.kat === k.id ? ' selected' : '') + '>' + esc(k.name) + '</option>'; }).join('') + '</select>' +
      '<input type="text" id="f-suche" data-filter="suche" placeholder="Suche (Name, Text, Betrag)" value="' + esc(f.suche) + '">' +
      '</div>';
    h += '<div class="listkopf"><p class="muted small">' + liste.length + ' Buchungen · Summe ' + eur(summe, 2) + '</p>' +
      (liste.length ? '<button class="btn small danger" data-act="loeschen-angezeigt">Angezeigte löschen (' + liste.length + ')</button>' : '') + '</div>';
    if (!liste.length) return h + '<div class="card empty">Keine Buchungen für diese Auswahl.</div>';
    h += '<div class="card" style="padding:4px 12px"><ul class="blist">';
    liste.slice(0, f.limit).forEach(function (b) {
      var sj = b.steuerjahr && +b.steuerjahr !== +b.datum.slice(0, 4) ? '<span class="tag">Steuerjahr ' + b.steuerjahr + '</span>' : '';
      h += '<li><div class="d">' + datumDE(b.datum) + '</div>' +
        '<div class="t" data-act="bearbeiten" data-id="' + b.id + '"><div class="who">' + esc(b.gegenpartei || '–') + sj + '</div><div class="what">' + esc(b.text || b.notiz || '') + '</div></div>' +
        '<div class="s"><select data-kat="' + b.id + '" class="' + (b.kat ? '' : 'leer') + '" aria-label="Kategorie">' + katOptions(b.kat) + '</select></div>' +
        '<div class="a ' + (b.betrag < 0 ? 'neg' : 'pos') + '">' + eur(b.betrag, 2) + '</div></li>';
    });
    h += '</ul>';
    if (liste.length > f.limit) h += '<div class="btns" style="justify-content:center;margin:10px 0"><button class="btn" data-act="mehr">Weitere ' + Math.min(200, liste.length - f.limit) + ' anzeigen</button></div>';
    h += '</div>';
    return h;
  }

  function buchungsDialog(b) {
    var neu = !b;
    b = b || { id: uid(), datum: isoHeute(), betrag: 0, kat: '', gegenpartei: '', iban: '', text: '', steuerjahr: '', notiz: '' };
    var dlg = $('#dlg'); dlg.className = '';
    dlg.innerHTML = '<form method="dialog" id="bform"><div class="dhead"><h2>' + (neu ? 'Buchung anlegen' : 'Buchung bearbeiten') + '</h2><button class="x" value="abbr" aria-label="Schließen">×</button></div><div class="dbody">' +
      '<div class="row"><label class="f"><span>Datum</span><input type="date" name="datum" required value="' + b.datum + '"></label>' +
      '<label class="f"><span>Betrag (Ausgabe negativ)</span><input type="number" step="0.01" inputmode="decimal" name="betrag" required value="' + b.betrag + '"></label></div>' +
      '<label class="f"><span>Kategorie</span><select name="kat">' + katOptions(b.kat) + '</select></label>' +
      '<div class="row"><label class="f"><span>Gegenpartei</span><input type="text" name="gegenpartei" value="' + esc(b.gegenpartei) + '"></label>' +
      '<label class="f"><span>IBAN</span><input type="text" name="iban" value="' + esc(b.iban) + '"></label></div>' +
      '<label class="f"><span>Verwendungszweck</span><input type="text" name="text" value="' + esc(b.text) + '"></label>' +
      '<div class="row"><label class="f"><span>Steuerjahr (nur wenn abweichend)</span><input type="number" name="steuerjahr" placeholder="' + b.datum.slice(0, 4) + '" value="' + esc(b.steuerjahr || '') + '"></label>' +
      '<label class="f"><span>Notiz</span><input type="text" name="notiz" value="' + esc(b.notiz || '') + '"></label></div>' +
      '<p class="muted small">Steuerjahr: für die 10-Tages-Regel (§ 11 EStG) oder wenn eine Steuerzahlung ein anderes Jahr betrifft, z. B. Nachzahlung 2025 im Jahr 2026.</p>' +
      '</div><div class="dfoot">' + (neu ? '' : '<button class="btn danger" value="loeschen" style="margin-right:auto">Löschen</button>') +
      '<button class="btn" value="abbr">Abbrechen</button><button class="btn primary" value="ok">Speichern</button></div></form>';
    dlg.showModal();
    dlg.onclose = function () {
      var v = dlg.returnValue, fm = $('#bform');
      if (v === 'loeschen') {
        if (confirm('Buchung löschen?')) { D.buchungen = D.buchungen.filter(function (x) { return x.id !== b.id; }); save(); }
        return;
      }
      if (v !== 'ok') return;
      var fd = new FormData(fm);
      var altKat = b.kat;
      b.datum = fd.get('datum') || b.datum;
      b.betrag = nz(fd.get('betrag'));
      b.kat = fd.get('kat') || '';
      b.gegenpartei = fd.get('gegenpartei');
      b.iban = fd.get('iban');
      b.text = fd.get('text');
      b.steuerjahr = nz(fd.get('steuerjahr')) || '';
      b.notiz = fd.get('notiz');
      if (neu) D.buchungen.push(b);
      save();
      if (b.kat && b.kat !== altKat) regelVorschlag(b);
    };
  }

  function regelVorschlag(b) {
    var r = regelFuer(b);
    if (r && r.kat === b.kat) return;
    var feld = normIBAN(b.iban) ? 'iban' : (b.gegenpartei ? 'name' : null);
    if (!feld) return;
    var muster = feld === 'iban' ? normIBAN(b.iban) : String(b.gegenpartei).trim();
    toast('Künftig „' + (feld === 'iban' ? muster : muster) + '“ automatisch als ' + katName(b.kat) + '?', 'Regel anlegen', function () {
      D.regeln.push({ id: uid(), feld: feld, muster: muster, kat: b.kat });
      var n = regelnAnwenden(true);
      save();
      toast('Regel angelegt' + (n ? ' · ' + n + ' weitere Buchungen zugeordnet' : ''));
    });
  }

  // ---------------------------------------------------------------- Import-Dialog (CSV und Excel)
  var csv = null;
  function zellText(v) { return v === null || v === undefined ? '' : String(v).trim(); }
  function csvZeilenNeu() {
    if (csv.typ === 'csv') csv.rows = csv.zeilen.map(function (z) { return splitCSV(z, csv.trenner); });
    else csv.rows = (csv.blaetter[csv.blatt] || { zeilen: [] }).zeilen.map(function (z) { return z.map(zellText); });
    // Kopfzeile: erste Zeile mit maximaler Spaltenzahl, die ein typisches Kopfwort enthält
    var maxSp = 0; csv.rows.slice(0, 40).forEach(function (z) { maxSp = Math.max(maxSp, z.filter(function (x) { return x !== ''; }).length); });
    csv.kopf = 0;
    for (var i = 0; i < Math.min(40, csv.rows.length); i++) {
      var z = csv.rows[i], n = z.filter(function (x) { return x !== ''; }).length;
      if (n === maxSp && /datum|buchung|betrag|umsatz|valuta|verwendung/i.test(z.join(' '))) { csv.kopf = i; break; }
    }
  }
  function csvDialog() {
    var dlg = $('#dlg'); dlg.className = 'wide';
    csv = { typ: 'csv', zeilen: [], rows: [], blaetter: [], blatt: 0, trenner: ';', kopf: 0,
      map: Object.assign({ datum: '', betrag: '', soll: '', haben: '', name: '', iban: '', text: '', art: '', kat: '', sj: '', auf: '', modus: 'betrag' }, D.csvMapping || {}),
      ueberschreiben: false, lernen: true };
    dlg.innerHTML = '<div class="dhead"><h2>Kontoumsätze importieren</h2><button class="x" data-act="dlg-zu" aria-label="Schließen">×</button></div>' +
      '<div class="dbody" id="csvbody"><p>Export der apoBank (oder einer anderen Bank) auswählen: Excel (.xlsx) oder CSV. Die Spalten ordnest du im nächsten Schritt zu; die Zuordnung wird für künftige Importe gespeichert.</p>' +
      '<input type="file" id="csvfile" accept=".csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></div><div class="dfoot" id="csvfoot"><button class="btn" data-act="dlg-zu">Abbrechen</button></div>';
    dlg.showModal();
    $('#csvfile').addEventListener('change', function (e) {
      var f = e.target.files[0]; if (!f) return;
      f.arrayBuffer().then(function (buf) {
        if (XLSX.istXlsx(buf)) {
          return XLSX.lesen(buf).then(function (bl) {
            csv.typ = 'xlsx';
            csv.blaetter = bl;
            csv.blatt = Math.max(0, bl.findIndex(function (b) { return b.zeilen.length > 1; }));
            csvZeilenNeu();
            csvMappingZeigen();
          });
        }
        if (/\.xls$/i.test(f.name)) throw new Error('Das alte Excel-Format .xls wird nicht unterstützt. Bitte als .xlsx oder CSV exportieren.');
        var t = new TextDecoder('utf-8').decode(buf);
        if (t.indexOf('�') >= 0) t = new TextDecoder('windows-1252').decode(buf);
        csv.typ = 'csv';
        csv.zeilen = zeilenAus(t.replace(/^﻿/, ''));
        csv.trenner = erkenneTrenner(csv.zeilen);
        csvZeilenNeu();
        csvMappingZeigen();
      }).catch(function (err) {
        $('#csvbody').insertAdjacentHTML('beforeend', '<div class="note bad">Datei konnte nicht gelesen werden: ' + esc(err.message) + '</div>');
      });
    });
  }
  function csvSpalten() { return (csv.rows[csv.kopf] || []).map(function (s, i) { return s || ('Spalte ' + (i + 1)); }); }
  function csvMappingZeigen() {
    var sp = csvSpalten(), m = csv.map;
    // Vorschläge, wenn keine gespeicherte Zuordnung passt
    var findeSp = function (re) { for (var i = 0; i < sp.length; i++) if (re.test(sp[i])) return sp[i]; return ''; };
    if (!sp.includes(m.datum)) m.datum = findeSp(/buchungstag|buchungsdatum|^datum/i) || findeSp(/valuta|wertstellung/i);
    if (!sp.includes(m.betrag)) m.betrag = findeSp(/^betrag|umsatz|amount/i);
    if (!sp.includes(m.name)) m.name = findeSp(/beg(ü|ue)nstigt|zahlungspflicht|auftraggeber|empf(ä|ae)nger|name|gegen/i);
    if (!sp.includes(m.iban)) m.iban = findeSp(/iban|kontonummer/i);
    if (!sp.includes(m.text)) m.text = findeSp(/verwendung|zweck|buchungstext|beschreibung/i);
    if (!sp.includes(m.art)) m.art = findeSp(/auftragsart|buchungsart|umsatzart|vorgang/i);
    if (!sp.includes(m.kat)) m.kat = findeSp(/^kategorie/i);
    if (!sp.includes(m.sj)) m.sj = findeSp(/^steuerjahr/i);
    if (!sp.includes(m.auf)) m.auf = findeSp(/^aufteilung/i);
    var opt = function (sel) { return '<option value="">– keine –</option>' + sp.map(function (s) { return '<option' + (s === sel ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join(''); };
    var h = '<div class="row">';
    if (csv.typ === 'csv') {
      h += '<label class="f"><span>Trennzeichen</span><select id="csv-tr"><option value=";"' + (csv.trenner === ';' ? ' selected' : '') + '>Semikolon ;</option><option value=","' + (csv.trenner === ',' ? ' selected' : '') + '>Komma ,</option><option value="\t"' + (csv.trenner === '\t' ? ' selected' : '') + '>Tabulator</option></select></label>';
    } else if (csv.blaetter.length > 1) {
      h += '<label class="f"><span>Tabellenblatt</span><select id="csv-blatt">' + csv.blaetter.map(function (b, i) { return '<option value="' + i + '"' + (i === csv.blatt ? ' selected' : '') + '>' + esc(b.name) + ' (' + b.zeilen.length + ' Zeilen)</option>'; }).join('') + '</select></label>';
    } else {
      h += '<label class="f"><span>Datei</span><input type="text" disabled value="Excel · ' + esc(csv.blaetter[0] ? csv.blaetter[0].name : '') + ' · ' + csv.rows.length + ' Zeilen"></label>';
    }
    h += '<label class="f"><span>Kopfzeile ist Zeile</span><input type="number" id="csv-kopf" min="1" value="' + (csv.kopf + 1) + '"></label></div>';
    h += '<details' + (csv.kopf > 0 ? ' open' : '') + '><summary>Dateianfang anzeigen</summary><pre class="small" style="overflow:auto;max-height:160px;background:var(--surface-2);padding:8px;border-radius:8px">' +
      csv.rows.slice(0, 15).map(function (z, i) { return (i + 1) + ': ' + esc(z.join(' | ')); }).join('\n') + '</pre></details>';
    h += '<h3>Spalten zuordnen</h3><div class="row">' +
      '<label class="f"><span>Datum *</span><select data-map="datum">' + opt(m.datum) + '</select></label>' +
      '<label class="f"><span>Betrag</span><div class="seg" style="margin-bottom:4px"><button type="button" data-act="csv-modus" data-v="betrag" aria-pressed="' + (m.modus === 'betrag') + '">Eine Spalte (±)</button><button type="button" data-act="csv-modus" data-v="sollhaben" aria-pressed="' + (m.modus === 'sollhaben') + '">Soll/Haben</button></div>' +
      (m.modus === 'betrag' ? '<select data-map="betrag">' + opt(m.betrag) + '</select>' :
        '<select data-map="soll">' + opt(m.soll) + '</select><select data-map="haben" style="margin-top:4px">' + opt(m.haben) + '</select>') + '</label></div>' +
      '<div class="row"><label class="f"><span>Gegenpartei (Name)</span><select data-map="name">' + opt(m.name) + '</select></label>' +
      '<label class="f"><span>IBAN</span><select data-map="iban">' + opt(m.iban) + '</select></label>' +
      '<label class="f"><span>Verwendungszweck</span><select data-map="text">' + opt(m.text) + '</select></label>' +
      '<label class="f"><span>Buchungsart</span><select data-map="art">' + opt(m.art) + '</select></label></div>' +
      '<div class="row"><label class="f"><span>Kategorie (optional)</span><select data-map="kat">' + opt(m.kat) + '</select></label>' +
      '<label class="f"><span>Steuerjahr (optional)</span><select data-map="sj">' + opt(m.sj) + '</select></label>' +
      '<label class="f"><span>Aufteilung (optional)</span><select data-map="auf">' + opt(m.auf) + '</select></label></div>';
    var vor = csvParse(8);
    if (m.kat) {
      var alle = csvParse(0), mitKat = alle.liste.filter(function (b) { return b.kat; }).length;
      h += '<div class="note">Kategorien aus der Datei: ' + mitKat + ' von ' + alle.liste.length + ' Zeilen zugeordnet' +
        (alle.unbekannt.length ? '. <b>Unbekannte Kategorie:</b> ' + esc(alle.unbekannt.slice(0, 5).join(', ')) : '') + '</div>' +
        '<label class="chk"><input type="checkbox" id="csv-ueber"' + (csv.ueberschreiben ? ' checked' : '') + '> Bereits importierte Buchungen: auch vorhandene Kategorien überschreiben (sonst nur leere ergänzen)</label>' +
        '<label class="chk"><input type="checkbox" id="csv-lernen"' + (csv.lernen ? ' checked' : '') + '> Regeln lernen: Gegenparteien mit eindeutiger Kategorie künftig automatisch zuordnen</label>';
    }
    h += '<h3>Vorschau</h3>';
    if (vor.fehler.length && !vor.liste.length) h += '<div class="note bad">' + esc(vor.fehler[0]) + '</div>';
    h += '<div class="tablewrap"><table><thead><tr><th>Datum</th><th>Gegenpartei</th><th>Verwendungszweck</th><th class="num">Betrag</th><th>Kategorie</th></tr></thead><tbody>' +
      vor.liste.map(function (b) { var r = regelFuer(b), kn = b.kat ? katName(b.kat) : (r ? katName(r.kat) + ' (Regel)' : '–'); return '<tr><td>' + datumDE(b.datum) + '</td><td>' + esc(b.gegenpartei) + '</td><td class="small">' + esc(String(b.text || b.art || '').slice(0, 70)) + '</td><td class="num">' + eur(b.betrag, 2) + '</td><td class="small">' + esc(kn) + '</td></tr>'; }).join('') +
      '</tbody></table></div>';
    $('#csvbody').innerHTML = h;
    $('#csvfoot').innerHTML = '<button class="btn" data-act="dlg-zu">Abbrechen</button><button class="btn primary" data-act="csv-import">Importieren</button>';
    if ($('#csv-tr')) $('#csv-tr').onchange = function (e) { csv.trenner = e.target.value; csvZeilenNeu(); csvMappingZeigen(); };
    if ($('#csv-blatt')) $('#csv-blatt').onchange = function (e) { csv.blatt = +e.target.value; csvZeilenNeu(); csvMappingZeigen(); };
    $('#csv-kopf').onchange = function (e) { csv.kopf = Math.max(0, nz(e.target.value) - 1); csvMappingZeigen(); };
    if ($('#csv-ueber')) $('#csv-ueber').onchange = function (e) { csv.ueberschreiben = e.target.checked; };
    if ($('#csv-lernen')) $('#csv-lernen').onchange = function (e) { csv.lernen = e.target.checked; };
    $$('[data-map]', $('#csvbody')).forEach(function (s) { s.onchange = function () { csv.map[s.dataset.map] = s.value; csvMappingZeigen(); }; });
  }
  function csvParse(limit) {
    var sp = csvSpalten(), m = csv.map, idx = function (n) { return n ? sp.indexOf(n) : -1; };
    var iD = idx(m.datum), iB = idx(m.betrag), iS = idx(m.soll), iH = idx(m.haben), iN = idx(m.name), iI = idx(m.iban), iT = idx(m.text), iA = idx(m.art);
    var iK = idx(m.kat), iJ = idx(m.sj), iU = idx(m.auf);
    var liste = [], fehler = [], unbekannt = [];
    var katLesen = function (s) {
      var k = katAusText(s);
      if (k === null) { if (unbekannt.indexOf(s) < 0) unbekannt.push(s); return ''; }
      return k;
    };
    if (iD < 0) fehler.push('Bitte die Datumsspalte zuordnen.');
    if (m.modus === 'betrag' ? iB < 0 : (iS < 0 && iH < 0)) fehler.push('Bitte die Betragsspalte(n) zuordnen.');
    if (fehler.length) return { liste: liste, fehler: fehler, unbekannt: unbekannt };
    for (var i = csv.kopf + 1; i < csv.rows.length; i++) {
      var z = csv.rows[i], wert = function (j) { return j >= 0 ? zellText(z[j]) : ''; };
      var datum = parseDatum(wert(iD));
      var betrag;
      if (m.modus === 'betrag') betrag = parseBetrag(wert(iB));
      else {
        var s = iS >= 0 ? parseBetrag(wert(iS)) : 0, hb = iH >= 0 ? parseBetrag(wert(iH)) : 0;
        s = isNaN(s) ? 0 : Math.abs(s); hb = isNaN(hb) ? 0 : Math.abs(hb);
        betrag = hb - s;
      }
      if (!datum || isNaN(betrag)) { if (z.join('').trim()) fehler.push('Zeile ' + (i + 1) + ' übersprungen'); continue; }
      var b = { id: uid(), datum: datum, betrag: Math.round(betrag * 100) / 100, gegenpartei: wert(iN), iban: normIBAN(wert(iI)), text: wert(iT), art: wert(iA), kat: '', steuerjahr: '', notiz: '' };
      if (iK >= 0 && wert(iK)) b.kat = katLesen(wert(iK));
      var sj = parseInt(wert(iJ), 10); if (sj >= 1990 && sj <= 2100) b.steuerjahr = sj;
      // Aufteilung, z. B. "Kirchensteuer: 520" oder "Kirchensteuer: 520; Solidaritätszuschlag: 30"
      if (iU >= 0 && wert(iU)) {
        b.teile = [];
        wert(iU).split(/[;\n]/).forEach(function (t) {
          var mm = t.trim().match(/^(.*?)\s*[:=]?\s*(-?[\d.,]+)\s*€?$/);
          if (!mm) { if (t.trim()) fehler.push('Zeile ' + (i + 1) + ': Aufteilung „' + t.trim() + '“ nicht lesbar'); return; }
          var tk = katLesen(mm[1]), tb = Math.abs(parseBetrag(mm[2]));
          if (tk && tb > 0) b.teile.push({ kat: tk, betrag: tb });
        });
        var summeTeile = b.teile.reduce(function (s, t) { return s + t.betrag; }, 0);
        if (summeTeile >= Math.abs(b.betrag) - 0.004) { fehler.push('Zeile ' + (i + 1) + ': Aufteilung ist so groß wie der Betrag – ignoriert'); b.teile = []; }
        if (!b.teile.length) delete b.teile;
      }
      liste.push(b);
      if (limit && liste.length >= limit) break;
    }
    return { liste: liste, fehler: fehler, unbekannt: unbekannt };
  }
  // Teilbuchungen aus einer Aufteilung: Hauptbuchung behält den Rest, jeder Teil wird eigene Buchung mit eigenem Schlüssel
  function teileAnlegen(b, teile) {
    var vz = b.betrag < 0 ? -1 : 1, neu = [];
    teile.forEach(function (t, j) {
      b.betrag = Math.round((b.betrag - vz * t.betrag) * 100) / 100;
      neu.push({ id: uid(), datum: b.datum, betrag: vz * t.betrag, gegenpartei: b.gegenpartei, iban: b.iban, text: b.text, art: b.art,
        kat: t.kat, steuerjahr: b.steuerjahr || '', notiz: 'Aufteilung', importKey: b.importKey + '#' + (j + 1) });
    });
    if (neu.length) b.notiz = b.notiz || 'Aufgeteilt';
    return neu;
  }
  // Regeln lernen je Gegenpartei: eindeutige Kategorie, oder bei mind. 4 Buchungen eine klare Mehrheit (≥ 75 %).
  // Steuerzahlungen werden nicht gelernt, da ESt/KiSt je Bescheid wechseln.
  function regelnLernen(liste) {
    var proName = {};
    liste.forEach(function (b) {
      var n = String(b.gegenpartei || '').trim(); if (n.length < 3) return;
      var key = n.toLowerCase();
      var e = (proName[key] = proName[key] || { name: n, n: 0, kats: {}, probe: b });
      e.n++; e.kats[b.kat || '_leer'] = (e.kats[b.kat || '_leer'] || 0) + 1;
    });
    var kandidaten = [];
    Object.keys(proName).forEach(function (key) {
      var e = proName[key], kats = Object.keys(e.kats).sort(function (x, y) { return e.kats[y] - e.kats[x]; }), top = kats[0];
      if (top === '_leer' || gruppe(top) === 'steuer') return;
      if (kats.length > 1 && !(e.n >= 4 && e.kats[top] / e.n >= 0.75)) return;
      if (regelFuer(e.probe)) return; // bestehende Regel hat Vorrang
      kandidaten.push({ id: uid(), feld: 'name', muster: e.name, kat: top });
    });
    // Längere (spezifischere) Namen zuerst, damit z. B. „Techniker Krankenkasse“ vor „Krankenkasse“ greift
    kandidaten.sort(function (x, y) { return y.muster.length - x.muster.length; });
    D.regeln = D.regeln.concat(kandidaten);
    return kandidaten.length;
  }
  function csvImportieren() {
    var r = csvParse(0);
    if (!r.liste.length) { toast('Keine gültigen Buchungen gefunden'); return; }
    // Duplikate erkennen (gleiche Buchung mehrfach am selben Tag zählt über die Reihenfolge)
    var vorhanden = {}, keys = {};
    D.buchungen.forEach(function (b) { var k = b.importKey || importSchluessel(b); (vorhanden[k] = vorhanden[k] || []).push(b); keys[k] = 1; });
    var gesehen = {}, neu = 0, dup = 0, kat = 0, aktual = 0, geteilt = 0, zusatz = [];
    r.liste.forEach(function (b) {
      var k = importSchluessel(b), teile = b.teile; delete b.teile;
      gesehen[k] = (gesehen[k] || 0) + 1;
      var alt = (vorhanden[k] || [])[gesehen[k] - 1];
      if (alt) {
        // Bereits vorhanden: Kategorie, Steuerjahr und Aufteilung aus der Datei ergänzen
        dup++;
        var geaendert = false;
        if (b.kat && (!alt.kat || (csv.ueberschreiben && alt.kat !== b.kat))) { alt.kat = b.kat; geaendert = true; }
        if (b.steuerjahr && (!alt.steuerjahr || csv.ueberschreiben) && alt.steuerjahr !== b.steuerjahr) { alt.steuerjahr = b.steuerjahr; geaendert = true; }
        if (teile && !keys[k + '#1']) {
          if (!alt.importKey) alt.importKey = k;
          zusatz = zusatz.concat(teileAnlegen(alt, teile)); geteilt++; geaendert = true;
        }
        if (geaendert) aktual++;
        return;
      }
      b.importKey = k;
      if (!b.kat) { var rg = regelFuer(b); if (rg) { b.kat = rg.kat; kat++; } }
      if (teile) { zusatz = zusatz.concat(teileAnlegen(b, teile)); geteilt++; }
      D.buchungen.push(b); neu++;
    });
    D.buchungen = D.buchungen.concat(zusatz);
    var gelernt = csv.map.kat && csv.lernen ? regelnLernen(r.liste) : 0;
    D.csvMapping = Object.assign({}, csv.map);
    $('#dlg').close();
    var jahre = r.liste.map(function (b) { return +b.datum.slice(0, 4); });
    if (jahre.length && jahre.indexOf(ui.jahr) < 0) ui.jahr = Math.max.apply(null, jahre);
    save();
    var msg = [neu + ' neu importiert'];
    if (kat) msg.push(kat + ' per Regel zugeordnet');
    if (aktual) msg.push(aktual + ' vorhandene aktualisiert');
    if (dup - aktual > 0) msg.push((dup - aktual) + ' unverändert vorhanden');
    if (geteilt) msg.push(geteilt + ' aufgeteilt');
    if (gelernt) msg.push(gelernt + ' Regeln gelernt');
    if (r.unbekannt.length) msg.push(r.unbekannt.length + ' unbekannte Kategorien');
    if (r.fehler.length) msg.push(r.fehler.length + ' Hinweise');
    toast(msg.join(' · '));
  }

  // ---------------------------------------------------------------- Ansicht: Steuer
  function viewSteuer() {
    var Y = ui.jahr, A = auswertung(Y), R = A.R, S = st(Y), p = 'steuer.' + Y;
    var h = '<h1>Steuer ' + Y + '</h1><p class="lead">Voraussichtliche Einkommensteuer, Soli und Kirchensteuer auf Basis der Prognose' + (R.parameter.fortgeschrieben ? ' · Tarif 2026 mit ' + pct(D.settings.inflation) + ' p. a. fortgeschrieben' : (Y < 2026 ? ' · Tarif 2026 als Näherung' : ' · Tarif 2026 (§ 32a EStG)')) + '.</p>';

    // Ergebnis
    var r = function (n, w, cls) { return '<tr class="' + (cls || '') + '"><td' + (cls === 'sub' ? ' class="indent"' : '') + '>' + n + '</td><td class="num">' + w + '</td></tr>'; };
    var t = '<table><tbody>';
    var Pa = R.personen[0];
    t += r('Einkünfte selbständige Arbeit (Gewinn)', eur(Pa.einkuenfte18));
    if (Pa.einkuenfte19) t += r('Einkünfte nichtselbständige Arbeit', eur(Pa.einkuenfte19), 'sub');
    if (R.zusammen) t += r('Einkünfte Partnerin', eur(R.personen[1].summe), 'sub');
    t += r('Summe der Einkünfte', eur(R.summeEinkuenfte), 'sum');
    t += r('− Altersvorsorge (abziehbar)', eur(-R.avAbzug), 'sub');
    t += r('− Kranken-/Pflegeversicherung (Basis)', eur(-R.basisKVPV), 'sub');
    if (R.sonstigeWirksam) t += r('− weitere Vorsorge (im Höchstbetrag)', eur(-R.sonstigeWirksam), 'sub');
    t += r('− Kirchensteuer / Sonderausgaben-Pauschbetrag', eur(-R.saUebrige), 'sub');
    t += r('Zu versteuerndes Einkommen', eur(R.zvE), 'sum');
    t += r('Einkommensteuer' + (R.zusammen ? ' (Splitting)' : ''), eur(R.est));
    t += r('Solidaritätszuschlag', eur(R.soli, 2));
    t += r('Kirchensteuer (' + pct(D.settings.kistSatz, 0) + ')', eur(R.kist, 2));
    t += r('Steuern gesamt', eur(R.gesamt), 'sum');
    t += r('Durchschnittssatz / Grenzsteuersatz', pct(R.durchschnitt) + ' / ' + pct(R.grenz));
    t += '</tbody></table>';
    var anr = '<table><tbody>';
    anr += r('Einbehaltene Lohnsteuer, Soli, KiSt', eur(nz(S.lohn.lohnsteuer) + nz(S.lohn.soli) + nz(S.lohn.kist) + (S.zusammen ? nz(S.partner.lohn.lohnsteuer) + nz(S.partner.lohn.soli) + nz(S.partner.lohn.kist) : 0)));
    anr += r('Vorauszahlungen bezahlt', eur(A.bezahlt.est + A.bezahlt.soli + A.bezahlt.kist));
    anr += r('Vorauszahlungen noch fällig (laut Bescheid)', eur(A.vzOffen.est + A.vzOffen.soli + A.vzOffen.kist));
    anr += r(R.offenGesamt >= 0 ? 'Erwartete Nachzahlung' : 'Erwartete Erstattung', eur(Math.abs(R.offenGesamt)), 'sum');
    anr += '</tbody></table>';
    h += '<div class="grid two"><div class="card"><h2>Berechnung</h2>' + t + '</div><div class="card"><h2>Abgleich mit Vorauszahlungen</h2>' + anr +
      '<div class="tiles" style="margin-top:14px">' + tile('Noch zu zahlen', eur(A.nochZuZahlen)) + tile('Rücklage pro Monat', eur(A.ruecklageMonat), A.monateRest + ' Monat(e)') + '</div>' +
      (R.avUeberHB > 0 ? '<div class="note bad"><b>Höchstbetrag Altersvorsorge überschritten:</b> ' + eur(R.avUeberHB) + ' über ' + eur(R.hbAV) + '.</div>' : '<p class="muted small">Altersvorsorge ' + eur(R.avGesamt) + ' von ' + eur(R.hbAV) + ' Höchstbetrag genutzt.</p>') +
      '</div></div>';

    // Einstellungen
    h += '<div class="card"><h2>Veranlagung und Merkmale</h2>' +
      '<div class="seg" style="margin-bottom:10px"><button data-act="set" data-path="' + p + '.zusammen" data-v="false" aria-pressed="' + !S.zusammen + '">Einzelveranlagung</button><button data-act="set" data-path="' + p + '.zusammen" data-v="true" aria-pressed="' + !!S.zusammen + '">Zusammenveranlagung</button></div>' +
      '<label class="check"><input type="checkbox" data-bindcheck="' + p + '.kistA"' + (S.kistA ? ' checked' : '') + '> Kirchensteuerpflichtig (ich)</label>' +
      (S.zusammen ? '<label class="check"><input type="checkbox" data-bindcheck="' + p + '.kistB"' + (S.kistB ? ' checked' : '') + '> Kirchensteuerpflichtig (Partnerin)</label>' : '') +
      '<label class="check"><input type="checkbox" data-bindcheck="' + p + '.kvMitKrankengeld"' + (S.kvMitKrankengeld ? ' checked' : '') + '> Eigene GKV mit Krankengeldanspruch (4 %-Kürzung)</label>' +
      '<label class="f" style="max-width:360px"><span>Höchstbetrag sonstige Vorsorge</span><select data-bind="' + p + '.agZuschussKV"><option value="auto"' + (S.agZuschussKV === 'auto' ? ' selected' : '') + '>automatisch (1.900 € bei Anstellung, sonst 2.800 €)</option><option value="ja"' + (S.agZuschussKV === 'ja' ? ' selected' : '') + '>1.900 € (AG-Zuschuss zur KV im Jahr)</option><option value="nein"' + (S.agZuschussKV === 'nein' ? ' selected' : '') + '>2.800 € (KV vollständig selbst getragen)</option></select></label>' +
      '</div>';

    // Anstellung
    var L = S.lohn;
    var lohnFelder = function (pp, LL) {
      return '<div class="row">' + zahlFeld(pp + '.brutto', LL.brutto, 'Bruttoarbeitslohn') + zahlFeld(pp + '.werbungskosten', LL.werbungskosten, 'Werbungskosten', 'leer = Pauschbetrag 1.230 €') + '</div>' +
        '<div class="row">' + zahlFeld(pp + '.rvAN', LL.rvAN, 'Rentenversicherung AN') + zahlFeld(pp + '.rvAG', LL.rvAG, 'Rentenversicherung AG') + zahlFeld(pp + '.avAN', LL.avAN, 'Arbeitslosenversicherung AN') + '</div>' +
        '<div class="row">' + zahlFeld(pp + '.kvAN', LL.kvAN, 'Krankenversicherung AN') + zahlFeld(pp + '.pvAN', LL.pvAN, 'Pflegeversicherung AN') + '</div>' +
        '<div class="row">' + zahlFeld(pp + '.lohnsteuer', LL.lohnsteuer, 'Einbehaltene Lohnsteuer') + zahlFeld(pp + '.soli', LL.soli, 'Einbehaltener Soli') + zahlFeld(pp + '.kist', LL.kist, 'Einbehaltene Kirchensteuer') + '</div>';
    };
    h += '<div class="card"><h2>Einkünfte aus Anstellung</h2><p class="muted small">Werte aus der Lohnsteuerbescheinigung (z. B. Anstellung Jan–März 2026).</p>' + lohnFelder(p + '.lohn', L) + '</div>';

    if (S.zusammen) {
      var PB = S.partner;
      h += '<div class="card"><h2>Partnerin (Zusammenveranlagung)</h2>' + lohnFelder(p + '.partner.lohn', PB.lohn) +
        '<div class="row">' + zahlFeld(p + '.partner.gewinn', PB.gewinn, 'Gewinn aus selbständiger Arbeit') + zahlFeld(p + '.partner.sonstigeEinkuenfte', PB.sonstigeEinkuenfte, 'Sonstige Einkünfte') + '</div>' +
        '<div class="row">' + zahlFeld(p + '.partner.vorsorge.pvw', PB.vorsorge.pvw, 'Eigene Altersvorsorge (Basis)') + zahlFeld(p + '.partner.vorsorge.kvBasis', PB.vorsorge.kvBasis, 'Eigene KV (Basis, selbst gezahlt)') + zahlFeld(p + '.partner.vorsorge.pvBasis', PB.vorsorge.pvBasis, 'Eigene PV (selbst gezahlt)') + '</div>' +
        '<div class="row">' + zahlFeld(p + '.partner.vorsorge.sonstige', PB.vorsorge.sonstige, 'Weitere Versicherungen') + zahlFeld(p + '.partner.kistGezahlt', PB.kistGezahlt, 'Gezahlte Kirchensteuer (außer Lohnabzug)') + '</div></div>';
    }

    // Vorauszahlungen + Steuerbuchungen
    var stb = D.buchungen.filter(function (b) { return gruppe(b.kat) === 'steuer' && (jahrVon(b) === Y || +b.datum.slice(0, 4) === Y); })
      .sort(function (a, b) { return a.datum < b.datum ? -1 : 1; });
    h += '<div class="card"><h2>Vorauszahlungen</h2><p class="muted small">Jahressummen laut Vorauszahlungsbescheid für ' + Y + '. Bezahlte Beträge kommen aus den Buchungen der Kategorien Einkommensteuer, Soli und Kirchensteuer mit Steuerjahr ' + Y + '.</p>' +
      '<div class="row">' + zahlFeld(p + '.vz.est', S.vz.est, 'Einkommensteuer (Jahr)') + zahlFeld(p + '.vz.soli', S.vz.soli, 'Soli (Jahr)') + zahlFeld(p + '.vz.kist', S.vz.kist, 'Kirchensteuer (Jahr)') + '</div>';
    if (stb.length) {
      h += '<h3>Steuerbuchungen – Steuerjahr prüfen</h3><div class="tablewrap"><table><thead><tr><th>Datum</th><th>Kategorie</th><th class="num">Betrag</th><th>Steuerjahr</th></tr></thead><tbody>' +
        stb.map(function (b) { var sj = jahrVon(b); return '<tr><td>' + datumDE(b.datum) + '</td><td>' + esc(katName(b.kat)) + '</td><td class="num">' + eur(b.betrag, 2) + '</td><td><select data-sj="' + b.id + '">' + [sj - 1, sj, sj + 1].filter(function (x, i, a) { return a.indexOf(x) === i; }).concat([+b.datum.slice(0, 4) - 1, +b.datum.slice(0, 4)]).filter(function (x, i, a) { return a.indexOf(x) === i; }).sort().map(function (y) { return '<option' + (y === sj ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select></td></tr>'; }).join('') +
        '</tbody></table></div>';
    }
    h += '</div>';

    // Vorsorge
    var VK = [['kvpv', 'Kranken-/Pflegeversicherung'], ['pvw', 'Versorgungswerk'], ['bu', 'Berufsunfähigkeitsversicherung'], ['ktg', 'Krankentagegeld'], ['vers_sonst', 'Weitere Versicherungen']];
    h += '<div class="card"><h2>Private Vorsorge</h2><div class="tablewrap"><table><thead><tr><th></th><th class="num">Ist (Konto)</th><th class="num">Jahreswert</th></tr></thead><tbody>' +
      VK.map(function (k) { return '<tr><td>' + k[1] + '</td><td class="num">' + eur(-(A.ist[k[0]] || 0)) + '</td><td class="num">' + eur(A.P.vorsorge[k[0]]) + '</td></tr>'; }).join('') +
      '</tbody></table></div><h3>Zusätzlich, nicht über das Praxiskonto gezahlt (Jahr)</h3><div class="row">' +
      zahlFeld(p + '.extra.kvpv', S.extra.kvpv, 'KV/PV') + zahlFeld(p + '.extra.pvw', S.extra.pvw, 'Versorgungswerk') + zahlFeld(p + '.extra.sonstige', S.extra.sonstige, 'Weitere Versicherungen') + '</div>' +
      '<p class="muted small">Basis-KV/PV ist voll abziehbar und schöpft den Höchstbetrag für sonstige Vorsorge (' + eur(R.hbSonst) + ') meist aus; BU, Krankentagegeld und Haftpflicht wirken dann steuerlich nicht.</p></div>';

    // Anlagen
    h += '<div class="card"><h2>Anlagegüter (AfA/GWG)</h2><p class="muted small">Anschaffungen über 952 € brutto (800 € netto) werden über die Nutzungsdauer abgeschrieben; darunter sofort als GWG. Die Zahlung selbst buchst du in der Kategorie „Anschaffung“.</p>';
    if (D.anlagen.length) {
      h += '<div class="tablewrap"><table><thead><tr><th>Bezeichnung</th><th>Datum</th><th class="num">Kosten</th><th class="num">Nutzungsdauer</th><th class="num">AfA ' + Y + '</th><th></th></tr></thead><tbody>' +
        D.anlagen.map(function (a) { return '<tr><td>' + esc(a.name) + '</td><td>' + datumDE(a.datum) + '</td><td class="num">' + eur(a.kosten, 2) + '</td><td class="num">' + (a.gwg ? 'GWG' : a.nd + ' J.') + '</td><td class="num">' + eur(afaFuer(a, Y), 2) + '</td><td><button class="btn small danger" data-act="anlage-weg" data-id="' + a.id + '">Entfernen</button></td></tr>'; }).join('') +
        '</tbody></table></div>';
    }
    h += '<div class="row" style="margin-top:10px"><label class="f"><span>Bezeichnung</span><input type="text" id="an-name"></label><label class="f"><span>Anschaffungsdatum</span><input type="date" id="an-datum" value="' + isoHeute() + '"></label>' +
      '<label class="f"><span>Kosten brutto</span><input type="number" step="0.01" id="an-kosten"></label><label class="f"><span>Nutzungsdauer (Jahre)</span><input type="number" id="an-nd" value="3"></label></div>' +
      '<div class="btns"><button class="btn" data-act="anlage-neu">Anlagegut hinzufügen</button></div></div>';

    // Pauschalen
    var pl = D.pauschalen.filter(function (x) { return +x.jahr === Y; });
    h += '<div class="card"><h2>Nicht kontowirksame Betriebsausgaben ' + Y + '</h2><p class="muted small">Z. B. km-Pauschale (0,30 €/km), Verpflegungsmehraufwand bei Fortbildungen.</p>';
    if (pl.length) h += '<table><tbody>' + pl.map(function (x) { return '<tr><td>' + esc(x.name) + '</td><td class="num">' + eur(x.betrag, 2) + '</td><td style="width:1%"><button class="btn small danger" data-act="pausch-weg" data-id="' + x.id + '">Entfernen</button></td></tr>'; }).join('') + '</tbody></table>';
    h += '<div class="row" style="margin-top:10px"><label class="f"><span>Bezeichnung</span><input type="text" id="pa-name"></label><label class="f"><span>Betrag</span><input type="number" step="0.01" id="pa-betrag"></label></div>' +
      '<div class="btns"><button class="btn" data-act="pausch-neu">Hinzufügen</button></div></div>';

    h += '<p class="muted small">Orientierungsrechnung nach § 32a EStG (2026), SolZG und § 10 EStG; ersetzt keine Steuerberatung. Kapitalerträge (Abgeltungsteuer) sind hier nicht enthalten.</p>';
    return h;
  }

  // ---------------------------------------------------------------- Ansicht: KVN
  function viewKVN() {
    var Y = ui.jahr;
    var zufluss = [0, 0, 0, 0];
    D.buchungen.forEach(function (b) { if (b.kat === 'kvn' && +b.datum.slice(0, 4) === Y) zufluss[Math.floor((+b.datum.slice(5, 7) - 1) / 3)] += b.betrag; });
    var h = '<h1>KVN-Honorar ' + Y + '</h1><p class="lead">Zwei Sichten: Leistungsquartal (Honorarbescheid, brutto) und Zahlungseingang (Konto, netto). Für die Steuer zählt der Zahlungseingang.</p>';
    var t = '<div class="tablewrap"><table><thead><tr><th>Quartal</th><th class="num">Honorar brutto (Bescheid)</th><th class="num">Verwaltungskosten</th><th class="num">Sonstige Abzüge/Erstattungen</th><th class="num">Netto Leistung</th><th class="num">Zufluss im Quartal</th></tr></thead><tbody>';
    var sb = 0, sv = 0, ss = 0, sz = 0;
    for (var q = 1; q <= 4; q++) {
      var k = Y + '-Q' + q, e = D.kvn[k] || {};
      var netto = nz(e.brutto) - nz(e.vk) - nz(e.sonst);
      sb += nz(e.brutto); sv += nz(e.vk); ss += nz(e.sonst); sz += zufluss[q - 1];
      t += '<tr><td>Q' + q + '</td>' +
        '<td class="num"><input class="inline" type="number" step="0.01" data-bind="kvn.' + k + '.brutto" value="' + (e.brutto || '') + '"></td>' +
        '<td class="num"><input class="inline" type="number" step="0.01" data-bind="kvn.' + k + '.vk" value="' + (e.vk || '') + '"></td>' +
        '<td class="num"><input class="inline" type="number" step="0.01" data-bind="kvn.' + k + '.sonst" value="' + (e.sonst || '') + '"></td>' +
        '<td class="num">' + eur(netto, 2) + '</td><td class="num">' + eur(zufluss[q - 1], 2) + '</td></tr>';
    }
    t += '<tr class="sum"><td>Jahr</td><td class="num">' + eur(sb, 2) + '</td><td class="num">' + eur(sv, 2) + '</td><td class="num">' + eur(ss, 2) + '</td><td class="num">' + eur(sb - sv - ss, 2) + '</td><td class="num">' + eur(sz, 2) + '</td></tr>';
    t += '</tbody></table></div>';
    h += '<div class="card"><h2>Leistungsquartal und Zufluss</h2>' + t +
      '<p class="muted small">Auf dem Konto kommt der Auszahlungsbetrag nach Abzug der Verwaltungskosten an; die EÜR rechnet mit diesem Zufluss, die Verwaltungskosten sind damit bereits als Betriebsausgabe berücksichtigt. Abschläge und Restzahlungen eines Leistungsquartals fließen oft im Folgequartal oder Folgejahr zu.</p></div>';
    return h;
  }

  // ---------------------------------------------------------------- Ansicht: Planung
  function viewPlanung() {
    var H = D.hochrechnung, Y = new Date().getFullYear(), A = auswertung(Y);
    var h = '<h1>Planung</h1><p class="lead">Hochrechnung des laufenden Jahres und Szenarien für die kommenden Jahre.</p>';
    h += '<div class="card"><h2>Hochrechnung ' + Y + '</h2>' +
      '<div class="seg" style="margin-bottom:12px"><button data-act="set" data-path="hochrechnung.methode" data-v="linear" aria-pressed="' + (H.methode === 'linear') + '">Linear aus Ist</button><button data-act="set" data-path="hochrechnung.methode" data-v="sitzungen" aria-pressed="' + (H.methode === 'sitzungen') + '">Über Sitzungen</button><button data-act="set" data-path="hochrechnung.methode" data-v="manuell" aria-pressed="' + (H.methode === 'manuell') + '">Manuelle Planwerte</button></div>';
    if (H.methode === 'linear') h += '<p class="muted small">Jede Kategorie wird mit ihrem bisherigen Verlauf aufs Jahr hochgerechnet (Ist ÷ abgelaufener Jahresanteil).</p>';
    if (H.methode === 'sitzungen') {
      h += '<p class="muted small">KVN- und Privathonorare: Ist plus verbleibende Wochen × Sitzungen × Honorar. Alle übrigen Kategorien linear.</p><div class="row">' +
        zahlFeld('hochrechnung.kvnSitz', H.kvnSitz, 'KVN: Sitzungen/Woche') + zahlFeld('hochrechnung.kvnHon', H.kvnHon, 'KVN: Honorar je Sitzung') +
        zahlFeld('hochrechnung.privSitz', H.privSitz, 'Privat: Sitzungen/Woche') + zahlFeld('hochrechnung.privHon', H.privHon, 'Privat: Honorar je Sitzung') +
        zahlFeld('hochrechnung.urlaubRest', H.urlaubRest, 'Urlaubswochen bis Jahresende') + '</div>';
    }
    if (H.methode === 'manuell') {
      h += '<p class="muted small">Erwarteter Jahreswert je Kategorie (positiv eingeben). Leere Felder werden linear hochgerechnet.</p><div class="tablewrap"><table><thead><tr><th>Kategorie</th><th class="num">Ist</th><th class="num">linear</th><th class="num">Jahreswert</th></tr></thead><tbody>';
      ['praxis_ein', 'praxis_aus', 'praxis_inv', 'vorsorge'].forEach(function (g) {
        h += '<tr class="sub"><td colspan="4"><b>' + esc(GRUPPEN.filter(function (x) { return x.id === g; })[0].name) + '</b></td></tr>';
        katsIn(g).forEach(function (k) {
          var i = A.ist[k.id] || 0, lin = A.t > 0.04 ? i / A.t : i, mv = (H.manuell[Y] || {})[k.id];
          h += '<tr><td>' + esc(k.name) + '</td><td class="num">' + eur(Math.abs(i)) + '</td><td class="num">' + eur(Math.abs(lin)) + '</td><td class="num"><input class="inline" type="number" step="1" data-bind="hochrechnung.manuell.' + Y + '.' + k.id + '" value="' + (mv === 0 || mv ? mv : '') + '"></td></tr>';
        });
      });
      h += '</tbody></table></div>';
    }
    h += '<p class="small">Ergebnis: Gewinn ' + eur(A.P.gewinn) + ' · Steuern ' + eur(A.R.gesamt) + ' · verfügbar ' + eur(A.verfuegbar / 12) + ' pro Monat.</p></div>';

    // Szenarien
    if (!D.szenarien.length) { D.szenarien.push(szNeu('Basis')); save(true); }
    if (!ui.szId || !D.szenarien.some(function (s) { return s.id === ui.szId; })) ui.szId = D.szenarien[0].id;
    var sz = D.szenarien.filter(function (s) { return s.id === ui.szId; })[0];
    var ys = Object.keys(sz.jahre).map(Number).sort();
    var idx = D.szenarien.indexOf(sz);
    var sp = 'szenarien.' + idx;

    h += '<div class="card"><h2>Szenarien</h2><div class="row" style="align-items:center">' +
      '<label class="f" style="max-width:260px"><span>Szenario</span><select id="sz-wahl">' + D.szenarien.map(function (s) { return '<option value="' + s.id + '"' + (s.id === sz.id ? ' selected' : '') + '>' + esc(s.name) + '</option>'; }).join('') + '</select></label>' +
      '<label class="f" style="max-width:260px"><span>Name</span><input type="text" data-bindtext="' + sp + '.name" value="' + esc(sz.name) + '"></label></div>' +
      '<div class="btns"><button class="btn" data-act="sz-neu">Neues Szenario</button><button class="btn" data-act="sz-kopie">Duplizieren</button><button class="btn" data-act="sz-prognose">Aus Prognose ' + Y + ' füllen und fortschreiben</button><button class="btn danger" data-act="sz-weg">Löschen</button></div>' +
      '<h3>Fortschreibung</h3><div class="row">' +
      '<label class="f"><span>Honorare/Einnahmen % p. a.</span><input type="number" step="0.1" data-bindpct="' + sp + '.wachstum.h" value="' + (sz.wachstum.h * 100) + '"></label>' +
      '<label class="f"><span>Praxiskosten % p. a.</span><input type="number" step="0.1" data-bindpct="' + sp + '.wachstum.k" value="' + (sz.wachstum.k * 100) + '"></label>' +
      '<label class="f"><span>Vorsorge % p. a.</span><input type="number" step="0.1" data-bindpct="' + sp + '.wachstum.v" value="' + (sz.wachstum.v * 100) + '"></label></div>' +
      '<div class="btns"><button class="btn" data-act="sz-fort">Werte aus ' + ys[0] + ' auf Folgejahre fortschreiben</button><button class="btn" data-act="sz-jahr-plus">Jahr anhängen</button><button class="btn" data-act="sz-jahr-minus"' + (ys.length < 2 ? ' disabled' : '') + '>Letztes Jahr entfernen</button></div>';

    var g = '<div class="tablewrap sgrid" style="margin-top:12px"><table><thead><tr><th></th>' + ys.map(function (y) { return '<th class="num">' + y + '</th>'; }).join('') + '</tr></thead><tbody>';
    SZ_FELDER.forEach(function (f) {
      if (f.grp) { g += '<tr class="grp"><td colspan="' + (ys.length + 1) + '">' + f.grp + '</td></tr>'; return; }
      g += '<tr><td>' + f.n + '</td>' + ys.map(function (y) { return '<td><input type="number" step="any" inputmode="decimal" data-bind="' + sp + '.jahre.' + y + '.' + f.k + '" value="' + nz(sz.jahre[y][f.k]) + '"></td>'; }).join('') + '</tr>';
    });
    var erg = ys.map(function (y) { return szRechne(sz, y); });
    g += '<tr class="grp"><td colspan="' + (ys.length + 1) + '">Ergebnis</td></tr>';
    var outRow = function (n, fn, cls) { return '<tr class="out ' + (cls || '') + '"><td>' + n + '</td>' + erg.map(function (e) { return '<td class="num">' + fn(e) + '</td>'; }).join('') + '</tr>'; };
    g += outRow('Umsatz', function (e) { return eur(e.umsatz); });
    g += outRow('Gewinn', function (e) { return eur(e.gewinn); });
    g += outRow('Zu versteuerndes Einkommen', function (e) { return eur(e.R.zvE); });
    g += outRow('Steuern (ESt, Soli, KiSt)', function (e) { return eur(e.R.gesamt); });
    g += outRow('Durchschnitts- / Grenzsteuersatz', function (e) { return pct(e.R.durchschnitt, 0) + ' / ' + pct(e.R.grenz, 0); });
    g += outRow('Verfügbar im Jahr', function (e) { return eur(e.verfuegbar); }, 'sum');
    g += outRow('<b>Verfügbar pro Monat</b>', function (e) { return '<b>' + eur(e.verfuegbar / 12) + '</b>'; });
    g += '</tbody></table></div>';
    h += g + '<p class="muted small">„Verfügbar“ = Einnahmen − Betriebsausgaben − Anschaffungen − Steuern − private Vorsorge' + ' (bei Zusammenveranlagung inkl. Partnerin). Tarif ab 2027 mit ' + pct(D.settings.inflation) + ' p. a. fortgeschrieben (änderbar unter Daten).</p></div>';

    // Vergleich
    var alleJahre = {};
    D.szenarien.forEach(function (s) { Object.keys(s.jahre).forEach(function (y) { alleJahre[y] = 1; }); });
    var jl = Object.keys(alleJahre).map(Number).sort();
    var serien = D.szenarien.slice(0, 4).map(function (s) {
      return { name: s.name, werte: jl.map(function (y) { return s.jahre[y] ? szRechne(s, y).verfuegbar / 12 : 0; }) };
    });
    h += '<div class="card"><h2>Verfügbar pro Monat im Vergleich</h2>' + linienChart(serien, jl) +
      (D.szenarien.length > 4 ? '<p class="muted small">Das Diagramm zeigt die ersten vier Szenarien.</p>' : '') + '</div>';
    return h;
  }

  // ---------------------------------------------------------------- Ansicht: Daten
  function viewDaten() {
    var h = '<h1>Daten</h1><p class="lead">Alle Daten liegen nur auf diesem Gerät. Zum Abgleich zwischen Notebook und Handy dient die JSON-Datei.</p>';
    h += '<div class="card"><h2>Speicherort</h2>';
    if (hatFS) {
      if (fileHandle) {
        h += '<p>Verbunden mit <b>' + esc(fileHandle.name) + '</b> · ' + (dateiStatus === 'verbunden' ? 'Änderungen werden automatisch gespeichert.' : 'Zugriff muss erneut erlaubt werden.') + '</p>' +
          '<div class="btns">' + (dateiStatus !== 'verbunden' ? '<button class="btn primary" data-act="datei-erlauben">Zugriff erlauben</button>' : '<button class="btn" data-act="datei-jetzt">Jetzt speichern</button>') +
          '<button class="btn" data-act="datei-oeffnen">Andere Datei öffnen</button><button class="btn" data-act="datei-trennen">Verbindung trennen</button></div>';
      } else {
        h += '<p>Noch keine Datei verbunden. Die App schreibt dann jede Änderung direkt in eine JSON-Datei, z. B. in einem Cloud- oder Sync-Ordner.</p>' +
          '<div class="btns"><button class="btn primary" data-act="datei-neu">Neue Datendatei anlegen</button><button class="btn" data-act="datei-oeffnen">Vorhandene Datei öffnen</button></div>';
      }
    } else {
      h += '<p>Auf diesem Gerät speichert die App im Browser. Zum Abgleich: auf dem Notebook die Datendatei hierher übertragen und unten einlesen; Änderungen vom Handy per „Datensicherung herunterladen“ zurückgeben.</p>';
    }
    h += '<p class="muted small">Stand der Daten: ' + new Date(D.meta.geaendert).toLocaleString('de-DE') + ' · ' + D.buchungen.length + ' Buchungen · ' + D.regeln.length + ' Regeln</p>';
    h += '<div class="btns"><button class="btn" data-act="export-json">Datensicherung herunterladen</button><button class="btn" data-act="import-json">Datensicherung einlesen</button><button class="btn" data-act="csv">Kontoumsätze importieren (Excel/CSV)</button></div></div>';

    // Regeln
    h += '<div class="card"><h2>Regeln für die Kategorisierung</h2><p class="muted small">Die erste passende Regel gilt. IBAN: exakter Vergleich; Name, Verwendungszweck, beides: enthält den Text.</p>';
    if (D.regeln.length) {
      h += '<div class="tablewrap"><table><thead><tr><th>Feld</th><th>Muster</th><th>Kategorie</th><th></th></tr></thead><tbody>' +
        D.regeln.map(function (r, i) {
          return '<tr><td>' + ({ iban: 'IBAN', name: 'Name', text: 'Verwendungszweck', art: 'Buchungsart', alle: 'Name, Zweck oder Art' })[r.feld] + '</td><td>' + esc(r.muster) + '</td><td>' + esc(katName(r.kat)) + '</td><td style="white-space:nowrap">' +
            (i ? '<button class="btn small" data-act="regel-hoch" data-i="' + i + '" aria-label="nach oben">↑</button> ' : '') +
            '<button class="btn small danger" data-act="regel-weg" data-i="' + i + '">Entfernen</button></td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    h += '<div class="row" style="margin-top:10px"><label class="f"><span>Feld</span><select id="rg-feld"><option value="name">Name</option><option value="iban">IBAN</option><option value="text">Verwendungszweck</option><option value="art">Buchungsart</option><option value="alle">Name, Zweck oder Art</option></select></label>' +
      '<label class="f"><span>Muster</span><input type="text" id="rg-muster"></label><label class="f"><span>Kategorie</span><select id="rg-kat">' + katOptions('', false) + '</select></label></div>' +
      '<div class="btns"><button class="btn" data-act="regel-neu">Regel hinzufügen</button><button class="btn" data-act="regeln-alle">Regeln auf alle Buchungen anwenden</button></div></div>';

    // Einstellungen
    h += '<div class="card"><h2>Annahmen</h2><div class="row">' +
      '<label class="f"><span>Inflation / Tarif-Fortschreibung % p. a.</span><input type="number" step="0.1" data-bindpct="settings.inflation" value="' + D.settings.inflation * 100 + '"></label>' +
      '<label class="f"><span>Kirchensteuersatz %</span><input type="number" step="1" data-bindpct="settings.kistSatz" value="' + D.settings.kistSatz * 100 + '"></label></div>' +
      '<p class="muted small">Stand der Steuerparameter: Veranlagungszeitraum 2026 (Grundfreibetrag 12.348 €, Soli-Freigrenze 20.350 €, Höchstbetrag Altersvorsorge 30.826 €). Version ' + APP_VERSION + '.</p></div>';

    h += '<div class="card"><h2>Löschen</h2>' +
      '<p class="muted small"><b>Alle Buchungen löschen</b> entfernt nur die Buchungen (aller Jahre). Regeln, Steuerangaben, KVN-Bescheide, Anlagen und Planung bleiben erhalten – ein erneuter Import ordnet dann über die Regeln wieder zu. Einzelne Monate, Kategorien oder Suchtreffer löschst du unter Buchungen über „Angezeigte löschen“.</p>' +
      '<div class="btns"><button class="btn danger" data-act="loeschen-alle"' + (D.buchungen.length ? '' : ' disabled') + '>Alle Buchungen löschen (' + D.buchungen.length + ')</button></div>' +
      '<p class="muted small" style="margin-top:14px"><b>Zurücksetzen</b> löscht alle Daten in diesem Browser. Eine verbundene Datei bleibt erhalten.</p><button class="btn danger" data-act="reset">Alle Daten in diesem Browser löschen</button></div>';
    return h;
  }

  var VIEWS = { uebersicht: viewUebersicht, buchungen: viewBuchungen, steuer: viewSteuer, kvn: viewKVN, planung: viewPlanung, daten: viewDaten };

  // ---------------------------------------------------------------- Toast
  var toastTimer = null;
  function toast(text, knopf, fn) {
    var alt = $('.toast'); if (alt) alt.remove();
    var el = document.createElement('div');
    el.className = 'toast'; el.setAttribute('role', 'status');
    el.innerHTML = '<span>' + esc(text) + '</span>' + (knopf ? '<button>' + esc(knopf) + '</button>' : '');
    document.body.appendChild(el);
    if (knopf) $('button', el).onclick = function () { el.remove(); fn(); };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.remove(); }, knopf ? 9000 : 4500);
  }

  // ---------------------------------------------------------------- Ereignisse
  document.addEventListener('click', function (e) {
    var tab = e.target.closest('[data-tab]');
    if (tab) { ui.tab = tab.dataset.tab; history.replaceState(null, '', '#' + ui.tab); render(); window.scrollTo(0, 0); return; }
    var a = e.target.closest('[data-act]');
    if (!a) return;
    var act = a.dataset.act;
    if (a.tagName === 'A') e.preventDefault();
    switch (act) {
      case 'neu': buchungsDialog(); break;
      case 'bearbeiten': buchungsDialog(D.buchungen.filter(function (b) { return b.id === a.dataset.id; })[0]); break;
      case 'csv': csvDialog(); break;
      case 'csv-modus': csv.map.modus = a.dataset.v; csvMappingZeigen(); break;
      case 'csv-import': csvImportieren(); break;
      case 'dlg-zu': $('#dlg').close(); break;
      case 'mehr': ui.filter.limit += 200; render(); break;
      case 'zeige-unkat': ui.tab = 'buchungen'; ui.filter.kat = '_leer'; render(); break;
      case 'regeln-anwenden': { var n = regelnAnwenden(true); save(); toast(n + ' Buchungen zugeordnet'); break; }
      case 'regeln-alle': { if (!confirm('Regeln auf alle Buchungen anwenden? Bestehende Zuordnungen können sich ändern.')) break; var n2 = regelnAnwenden(false); save(); toast(n2 + ' Buchungen neu zugeordnet'); break; }
      case 'regel-neu': {
        var mu = $('#rg-muster').value.trim(); if (!mu) { toast('Bitte ein Muster eingeben'); break; }
        D.regeln.push({ id: uid(), feld: $('#rg-feld').value, muster: mu, kat: $('#rg-kat').value });
        var n3 = regelnAnwenden(true); save(); toast('Regel angelegt' + (n3 ? ' · ' + n3 + ' Buchungen zugeordnet' : '')); break;
      }
      case 'loeschen-angezeigt': {
        var weg = buchungenGefiltert(), wegIds = {};
        if (!weg.length) break;
        var fl = ui.filter, besch = [ui.jahr];
        if (fl.monat) besch.push(MONATE[+fl.monat - 1]);
        if (fl.kat) besch.push(fl.kat === '_leer' ? 'ohne Kategorie' : fl.kat.indexOf('g:') === 0 ? 'Gruppe ' + (GRUPPEN.filter(function (g) { return 'g:' + g.id === fl.kat; })[0] || {}).name : katName(fl.kat));
        if (fl.suche) besch.push('Suche „' + fl.suche + '“');
        if (!confirm(weg.length + ' Buchungen löschen (' + besch.join(', ') + ')?\n\nTipp: vorher unter Daten eine Datensicherung herunterladen.')) break;
        weg.forEach(function (b) { wegIds[b.id] = 1; });
        D.buchungen = D.buchungen.filter(function (b) { return !wegIds[b.id]; });
        save(); toast(weg.length + ' Buchungen gelöscht'); break;
      }
      case 'loeschen-alle': {
        var anz = D.buchungen.length; if (!anz) break;
        if (!confirm('Wirklich alle ' + anz + ' Buchungen aller Jahre löschen?\n\nRegeln, Steuerangaben, KVN und Planung bleiben erhalten.')) break;
        if (!confirm('Letzte Rückfrage: ' + anz + ' Buchungen endgültig löschen?')) break;
        D.buchungen = []; save(); toast(anz + ' Buchungen gelöscht'); break;
      }
      case 'regel-weg': D.regeln.splice(+a.dataset.i, 1); save(); break;
      case 'regel-hoch': { var i = +a.dataset.i, r = D.regeln.splice(i, 1)[0]; D.regeln.splice(i - 1, 0, r); save(); break; }
      case 'set': {
        var v = a.dataset.v; if (v === 'true') v = true; else if (v === 'false') v = false;
        setPath(a.dataset.path, v); save(); break;
      }
      case 'anlage-neu': {
        var k = nz($('#an-kosten').value), nm = $('#an-name').value.trim(), dt = $('#an-datum').value;
        if (!nm || !k || !dt) { toast('Bezeichnung, Datum und Kosten angeben'); break; }
        D.anlagen.push({ id: uid(), name: nm, datum: dt, kosten: k, nd: Math.max(1, nz($('#an-nd').value) || 1), gwg: k <= 952 });
        save(); toast(k <= 952 ? 'Als geringwertiges Wirtschaftsgut sofort abgeschrieben' : 'Anlagegut angelegt'); break;
      }
      case 'anlage-weg': D.anlagen = D.anlagen.filter(function (x) { return x.id !== a.dataset.id; }); save(); break;
      case 'pausch-neu': {
        var pn = $('#pa-name').value.trim(), pb = nz($('#pa-betrag').value);
        if (!pn || !pb) { toast('Bezeichnung und Betrag angeben'); break; }
        D.pauschalen.push({ id: uid(), jahr: ui.jahr, name: pn, betrag: pb }); save(); break;
      }
      case 'pausch-weg': D.pauschalen = D.pauschalen.filter(function (x) { return x.id !== a.dataset.id; }); save(); break;
      case 'sz-neu': { var s = szNeu('Szenario ' + (D.szenarien.length + 1)); D.szenarien.push(s); ui.szId = s.id; save(); break; }
      case 'sz-kopie': { var src = D.szenarien.filter(function (x) { return x.id === ui.szId; })[0]; var c = JSON.parse(JSON.stringify(src)); c.id = uid(); c.name = src.name + ' (Kopie)'; D.szenarien.push(c); ui.szId = c.id; save(); break; }
      case 'sz-weg': { if (D.szenarien.length < 2) { toast('Mindestens ein Szenario bleibt bestehen'); break; } if (!confirm('Szenario löschen?')) break; D.szenarien = D.szenarien.filter(function (x) { return x.id !== ui.szId; }); ui.szId = null; save(); break; }
      case 'sz-fort': { var s2 = D.szenarien.filter(function (x) { return x.id === ui.szId; })[0]; if (!confirm('Alle Folgejahre mit den Werten des ersten Jahres und den Steigerungsraten überschreiben?')) break; szFortschreiben(s2); save(); break; }
      case 'sz-jahr-plus': { var s3 = D.szenarien.filter(function (x) { return x.id === ui.szId; })[0]; var ys = Object.keys(s3.jahre).map(Number); var last = Math.max.apply(null, ys); s3.jahre[last + 1] = JSON.parse(JSON.stringify(s3.jahre[last])); save(); break; }
      case 'sz-jahr-minus': { var s4 = D.szenarien.filter(function (x) { return x.id === ui.szId; })[0]; var ys2 = Object.keys(s4.jahre).map(Number); if (ys2.length > 1) delete s4.jahre[Math.max.apply(null, ys2)]; save(); break; }
      case 'sz-prognose': {
        if (!confirm('Alle Jahre des Szenarios mit der Prognose ' + new Date().getFullYear() + ' und den Steigerungsraten neu befüllen? Das erste Jahr übernimmt die Beträge der Prognose, die Folgejahre werden daraus fortgeschrieben.')) break;
        var s5 = D.szenarien.filter(function (x) { return x.id === ui.szId; })[0], cy = new Date().getFullYear(), Au = auswertung(cy);
        var y0 = Math.min.apply(null, Object.keys(s5.jahre).map(Number)), j = s5.jahre[y0];
        j.kvnBetrag = Math.round(Au.prog.kvn || 0); j.privBetrag = Math.round(Au.prog.privat || 0);
        j.ausfall = Math.round(Au.prog.ausfall || 0); j.untervermietung = Math.round(Au.prog.untervermietung || 0);
        j.lehre = Math.round(Au.prog.lehre || 0); j.sonstEin = Math.round(Au.prog.sonst_be || 0);
        j.ausgaben = Math.round(Au.P.aus); j.invest = Math.round(Au.P.inv); j.afa = Math.round(Au.P.afa);
        j.kvpv = Math.round(Au.vorsorgeJahr.kvpv); j.pvw = Math.round(Au.vorsorgeJahr.pvw); j.versich = Math.round(Au.vorsorgeJahr.sonstige);
        j.kist = st(cy).kistA ? 1 : 0;
        szFortschreiben(s5);
        save(); toast('Jahre ab ' + y0 + ' aus der Prognose ' + cy + ' gefüllt und fortgeschrieben'); break;
      }
      case 'datei-neu': dateiVerbinden(true); break;
      case 'datei-oeffnen': dateiVerbinden(false); break;
      case 'datei-erlauben': dateiErneutErlauben(); break;
      case 'datei-trennen': dateiTrennen(); break;
      case 'datei-jetzt': dateiSchreiben().then(function () { toast('Gespeichert'); }); break;
      case 'export-json': {
        var blob = new Blob([JSON.stringify(D, null, 1)], { type: 'application/json' });
        var url = URL.createObjectURL(blob), l = document.createElement('a');
        l.href = url; l.download = 'finanzkompass-daten-' + isoHeute() + '.json'; document.body.appendChild(l); l.click(); l.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 2000); break;
      }
      case 'import-json': {
        var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
        inp.onchange = function () {
          var f = inp.files[0]; if (!f) return;
          f.text().then(function (t) {
            var neu = migrate(JSON.parse(t));
            if (!neu.buchungen) throw new Error('Keine Finanzkompass-Datei');
            if (!confirm('Datensicherung vom ' + new Date(neu.meta.geaendert).toLocaleString('de-DE') + ' mit ' + neu.buchungen.length + ' Buchungen einlesen? Die aktuellen Daten in diesem Browser werden ersetzt.')) return;
            D = neu; save(); toast('Datensicherung eingelesen');
          }).catch(function (err) { toast('Einlesen fehlgeschlagen: ' + err.message); });
        };
        inp.click(); break;
      }
      case 'reset': {
        if (!confirm('Wirklich alle Daten in diesem Browser löschen?')) break;
        if (!confirm('Letzte Rückfrage: Löschen kann nicht rückgängig gemacht werden.')) break;
        localStorage.removeItem(STORE_KEY); D = defaultData(); fileHandle = null; dateiStatus = 'keine'; idbDel('handle'); render(); toast('Daten gelöscht'); break;
      }
    }
  });

  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.id === 'jahr') { ui.jahr = +el.value; ui.filter.limit = 200; render(); return; }
    if (el.id === 'sz-wahl') { ui.szId = el.value; render(); return; }
    if (el.dataset.filter) { ui.filter[el.dataset.filter] = el.value; ui.filter.limit = 200; render(); return; }
    if (el.dataset.kat) {
      var b = D.buchungen.filter(function (x) { return x.id === el.dataset.kat; })[0];
      if (!b) return;
      b.kat = el.value; save(); if (b.kat) regelVorschlag(b); return;
    }
    if (el.dataset.sj) {
      var b2 = D.buchungen.filter(function (x) { return x.id === el.dataset.sj; })[0];
      if (!b2) return;
      b2.steuerjahr = +el.value === +b2.datum.slice(0, 4) ? '' : +el.value; save(); return;
    }
    if (el.dataset.bindcheck) { setPath(el.dataset.bindcheck, el.checked); save(); return; }
    if (el.dataset.bindtext) { setPath(el.dataset.bindtext, el.value); save(); return; }
    if (el.dataset.bindpct) { setPath(el.dataset.bindpct, nz(el.value) / 100); save(); return; }
    if (el.dataset.bind) {
      var v = el.type === 'number' ? (el.value === '' ? (el.dataset.bind.indexOf('hochrechnung.manuell') === 0 ? '' : 0) : nz(el.value)) : el.value;
      setPath(el.dataset.bind, v); save(); return;
    }
  });
  document.addEventListener('input', function (e) {
    if (e.target.id === 'f-suche') {
      ui.filter.suche = e.target.value; ui.filter.limit = 200;
      clearTimeout(document.__suchT);
      document.__suchT = setTimeout(function () {
        var pos = e.target.selectionStart; render();
        var f = $('#f-suche'); if (f) { f.focus(); f.setSelectionRange(pos, pos); }
      }, 250);
    }
  });
  window.addEventListener('hashchange', function () {
    var t = location.hash.replace('#', '');
    if (VIEWS[t] && t !== ui.tab) { ui.tab = t; render(); }
  });

  // ---------------------------------------------------------------- Start
  render();
  if (hatFS) {
    idbGet('handle').then(function (h) {
      if (!h) return;
      fileHandle = h;
      return h.queryPermission({ mode: 'readwrite' }).then(function (p) {
        if (p === 'granted') {
          dateiStatus = 'verbunden';
          return dateiLesen(h).then(function (inhalt) {
            if (inhalt && inhalt.meta && inhalt.meta.geaendert > D.meta.geaendert) {
              D = inhalt; localStorage.setItem(STORE_KEY, JSON.stringify(D)); toast('Neuere Daten aus der Datei geladen');
            }
          });
        }
        dateiStatus = 'erlaubnis';
      }).then(function () { render(); });
    }).catch(function () {});
  }
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
  // Test-Haken (nur für automatisierte Prüfung)
  window.__fk = { auswertung: auswertung, parseBetrag: parseBetrag, parseDatum: parseDatum, splitCSV: splitCSV, szRechne: szRechne, data: function () { return D; } };
})();
