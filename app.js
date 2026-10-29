/* Finanzkompass – Ausbaustufe 1: Einnahmen, Ausgaben, Gewinn, Steuer
 * Alle Daten bleiben lokal (Browser-Speicher bzw. verbundene JSON-Datei). Keine persönlichen Daten im Code.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- Grundlagen
  var STORE_KEY = 'finanzkompass.v1';
  var APP_VERSION = '1.6.0';
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
      csvMapping: null,
      ziele: {}, ruecklage: {}, meilensteine: {}
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
      R: R, eingabe: eingabe, lohnNetto: lohnNetto, partnerNetto: partnerNetto, verfuegbar: verfuegbar,
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
    auswahl: null, // null = Auswahlmodus aus; sonst { id: true }
    offen: {},     // aufgeklappte Detailbereiche
    wenn: { sitz: 0, urlaub: 0, ausg: 0 },
    szId: null
  };
  if (!TABS.some(function (t) { return t[0] === ui.tab; })) ui.tab = 'uebersicht';

  // Bereiche: Reihenfolge und Sichtbarkeit sind einstellbar. Unten (Handy) höchstens 4 + „Mehr“ (Material: 3–5 Ziele).
  var BEREICHE = ['uebersicht', 'steuer', 'planung', 'kvn', 'buchungen'];
  var BEREICH_NAME = { uebersicht: 'Übersicht', buchungen: 'Buchungen', steuer: 'Steuer', kvn: 'KVN', planung: 'Planung', daten: 'Einstellungen' };
  function navOrdnung() {
    var s = D.settings.nav;
    if (!s || !s.order) s = D.settings.nav = { order: BEREICHE.slice(), aus: [] };
    BEREICHE.forEach(function (id) { if (s.order.indexOf(id) < 0) s.order.push(id); });
    s.order = s.order.filter(function (id) { return BEREICHE.indexOf(id) >= 0; });
    // Übersicht bleibt immer sichtbar und vorn
    s.order = ['uebersicht'].concat(s.order.filter(function (id) { return id !== 'uebersicht'; }));
    s.aus = (s.aus || []).filter(function (id) { return id !== 'uebersicht'; });
    return s;
  }
  function sichtbareBereiche() { var s = navOrdnung(); return s.order.filter(function (id) { return s.aus.indexOf(id) < 0; }); }
  function navKnopf(id, extra) {
    return '<button data-tab="' + id + '"' + (ui.tab === id ? ' aria-current="page"' : '') + (extra || '') + '><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' + ICON[id] + '</svg>' + BEREICH_NAME[id] + '</button>';
  }
  function navRendern() {
    var vis = sichtbareBereiche();
    var unten = vis.slice(0, 4), rest = vis.slice(4);
    var mehrAktiv = ui.tab === 'daten' || rest.indexOf(ui.tab) >= 0 || (vis.indexOf(ui.tab) < 0 && ui.tab !== 'daten');
    // Desktop: alle sichtbaren + Einstellungen; Handy: 4 + Mehr (per CSS gesteuert)
    $('#tabs').innerHTML =
      vis.map(function (id, i) { return navKnopf(id, i >= 4 ? ' class="nur-breit"' : ''); }).join('') +
      '<button class="nur-schmal" data-act="mehr-blatt"' + (mehrAktiv ? ' aria-current="page"' : '') + '><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>Mehr</button>' +
      '<div class="nav-trenner nur-breit"></div>' + navKnopf('daten', ' class="nur-breit"');
    void unten;
  }
  function mehrBlatt() {
    var vis = sichtbareBereiche(), rest = vis.slice(4), aus = navOrdnung().aus;
    var dlg = $('#dlg'); dlg.className = 'blatt'; dlg.onclose = null;
    var zeile = function (id, zusatz) { return '<button class="blattzeile" data-tab="' + id + '"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' + ICON[id] + '</svg><span>' + BEREICH_NAME[id] + (zusatz || '') + '</span></button>'; };
    dlg.innerHTML = '<div class="blattgriff"></div>' +
      rest.map(function (id) { return zeile(id); }).join('') +
      aus.map(function (id) { return zeile(id, ' <small>ausgeblendet</small>'); }).join('') +
      zeile('daten') +
      '<button class="blattzeile" data-act="anpassen" data-was="nav"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="7" r="2" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="10" cy="17" r="2" stroke="currentColor" stroke-width="2" fill="none"/></svg><span>Leiste anpassen</span></button>';
    dlg.showModal();
  }

  // Anpassen-Listen (Bereiche und Übersichtskarten): verschieben ↑↓, ein-/ausblenden
  function anpassenListe(was) {
    var s = was === 'nav' ? navOrdnung() : kartenOrdnung();
    var name = was === 'nav' ? function (id) { return BEREICH_NAME[id]; } : function (id) { return KARTEMAP[id].n; };
    var fest = was === 'nav' ? ['uebersicht'] : [];
    var h = '<ul class="anpassen">';
    s.order.forEach(function (id, i) {
      var an = s.aus.indexOf(id) < 0, istFest = fest.indexOf(id) >= 0;
      h += '<li class="' + (an ? '' : 'aus') + '">' +
        '<label class="schalter"><input type="checkbox" data-anp="' + was + '" data-id="' + id + '"' + (an ? ' checked' : '') + (istFest ? ' disabled' : '') + '><i></i></label>' +
        '<span class="anpname">' + esc(name(id)) + (was === 'nav' && an && sichtbareBereiche().indexOf(id) >= 4 ? ' <small>unter „Mehr“</small>' : '') + '</span>' +
        '<button class="btn small" data-act="anp-hoch" data-was="' + was + '" data-id="' + id + '"' + (i === 0 || istFest || (was === 'nav' && i === 1) ? ' disabled' : '') + ' aria-label="nach oben">↑</button>' +
        '<button class="btn small" data-act="anp-runter" data-was="' + was + '" data-id="' + id + '"' + (i === s.order.length - 1 || istFest ? ' disabled' : '') + ' aria-label="nach unten">↓</button></li>';
    });
    h += '</ul>';
    if (was === 'nav') h += '<p class="muted small">Auf dem Handy erscheinen die ersten vier sichtbaren Bereiche unten, alle weiteren unter „Mehr“. Einstellungen erreichst du immer über ⚙ oben.</p>';
    else h += '<p class="muted small">Ausgeblendete Karten kannst du hier jederzeit wieder einschalten.</p>';
    return h;
  }
  function anpassenDialog(was) {
    var dlg = $('#dlg'); dlg.className = 'blatt'; dlg.onclose = null;
    dlg.innerHTML = '<div class="dhead"><h2>' + (was === 'nav' ? 'Leiste anpassen' : 'Übersicht anpassen') + '</h2><button class="x" data-act="dlg-zu" aria-label="Schließen">×</button></div><div class="dbody" id="anp-body">' + anpassenListe(was) + '</div>';
    dlg.dataset.anp = was;
    if (!dlg.open) dlg.showModal();
  }
  function anpassenAendern(was, id, aktion, wert) {
    var s = was === 'nav' ? navOrdnung() : kartenOrdnung(), i = s.order.indexOf(id);
    if (aktion === 'hoch' && i > 0) { s.order.splice(i, 1); s.order.splice(i - 1, 0, id); }
    if (aktion === 'runter' && i < s.order.length - 1) { s.order.splice(i, 1); s.order.splice(i + 1, 0, id); }
    if (aktion === 'an') { s.aus = s.aus.filter(function (x) { return x !== id; }); if (!wert) s.aus.push(id); }
    save();
    var body = $('#anp-body'); if (body && $('#dlg').open) body.innerHTML = anpassenListe(was);
  }

  // Gemeinsame Bausteine für ruhige, tabellenarme Darstellung
  function wbr(t) { return String(t).replace(/\//g, '/<wbr>'); }
  function info(text) { return '<details class="info"><summary aria-label="Erklärung" title="Erklärung">i</summary><div class="infotext">' + text + '</div></details>'; }
  function kopf(titel, infotext) { return '<div class="khead"><h2>' + titel + '</h2>' + (infotext ? info(infotext) : '') + '</div>'; }
  function zliste(zeilen) {
    return '<div class="zliste">' + zeilen.filter(Boolean).map(function (z) {
      return '<div class="zrow ' + (z[2] || '') + '"><span>' + z[0] + '</span><b>' + z[1] + '</b></div>';
    }).join('') + '</div>';
  }
  function gruppeKarte(id, titel, zusammenfassung, inhalt, offen) {
    var auf = ui.offen[id] !== undefined ? ui.offen[id] : !!offen;
    return '<details class="mehr card" data-auf="' + id + '"' + (auf ? ' open' : '') + '><summary><span><span class="gt">' + titel + '</span>' + (zusammenfassung ? '<small>' + zusammenfassung + '</small>' : '') + '</span></summary><div class="mehrinhalt">' + inhalt + '</div></details>';
  }
  function feldZeile(pfad, wert, label, hilfe) {
    return '<label class="fz"><span>' + label + (hilfe ? '<small>' + hilfe + '</small>' : '') + '</span><input type="number" step="any" inputmode="decimal" data-bind="' + pfad + '" value="' + (wert === 0 || wert ? wert : '') + '" placeholder="0"></label>';
  }

  function jahreRendern() {
    var cur = new Date().getFullYear(), set = {};
    set[cur] = 1; set[cur - 1] = 1;
    D.buchungen.forEach(function (b) { set[+b.datum.slice(0, 4)] = 1; });
    Object.keys(D.steuer).forEach(function (y) { set[y] = 1; });
    var ys = Object.keys(set).map(Number).sort(function (a, b) { return b - a; });
    $('#jahr').innerHTML = ys.map(function (y) { return '<option' + (y === ui.jahr ? ' selected' : '') + '>' + y + '</option>'; }).join('');
  }

  // Auf dem Handy liegen die Bereiche der Leiste nebeneinander und rasten beim Wischen ein
  // (natives Scroll-Snapping wie in „Dein Leben“: folgt dem Finger, flüssig wie eine native App).
  function seitenModus() { return schmal() && sichtbareBereiche().indexOf(ui.tab) >= 0; }
  ui.scroll = {};
  function seitenScrollMerken() {
    $$('#pager .page').forEach(function (p) { ui.scroll[p.dataset.seite] = p.scrollTop; });
  }
  function render() {
    var ae = document.activeElement;
    var fokus = ae && ae.dataset ? (ae.dataset.bind || ae.id || null) : null;
    var m = $('#main');
    navRendern(); jahreRendern(); statusAnzeigen();
    if (seitenModus()) {
      seitenScrollMerken();
      var ids = sichtbareBereiche();
      document.body.classList.add('paged');
      kopfHoehe();
      m.innerHTML = '<div class="pager" id="pager">' + ids.map(function (k) {
        return '<section class="page" data-seite="' + k + '"><div class="pageinhalt">' + VIEWS[k]() + '</div></section>';
      }).join('') + '</div>';
      var pg = $('#pager');
      ui.springen = true;
      pg.scrollLeft = ids.indexOf(ui.tab) * pg.clientWidth;
      $$('.page', pg).forEach(function (p) { p.scrollTop = ui.scroll[p.dataset.seite] || 0; });
      setTimeout(function () { ui.springen = false; }, 60);
    } else {
      var scroll = window.scrollY;
      document.body.classList.remove('paged');
      m.innerHTML = (VIEWS[ui.tab] || VIEWS.uebersicht)();
      window.scrollTo(0, scroll);
    }
    if (fokus) {
      var el = $('[data-bind="' + fokus + '"]', m) || document.getElementById(fokus);
      if (el && el !== document.body) { try { el.focus({ preventScroll: true }); } catch (e) { /* ignorieren */ } }
    }
    bindCharts();
  }
  function kopfHoehe() { var t = $('.topbar'); if (t) document.documentElement.style.setProperty('--kopf', t.offsetHeight + 'px'); }
  // Leiste ohne Neuaufbau an die aktuelle Seite anpassen
  function navSync() {
    var vis = sichtbareBereiche(), rest = vis.slice(4);
    $$('#tabs [data-tab]').forEach(function (b) { if (b.dataset.tab === ui.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    var mehr = $('#tabs [data-act=mehr-blatt]');
    if (mehr) { if (rest.indexOf(ui.tab) >= 0) mehr.setAttribute('aria-current', 'page'); else mehr.removeAttribute('aria-current'); }
  }
  function zuSeite(k) {
    var pg = $('#pager'), ids = sichtbareBereiche();
    ui.tab = k; history.replaceState(null, '', '#' + k);
    if (pg && seitenModus()) {
      ui.springen = true; clearTimeout(ui.springT); ui.springT = setTimeout(function () { ui.springen = false; }, 700);
      navSync();
      var ziel = ids.indexOf(k) * pg.clientWidth;
      if (Math.abs(pg.scrollLeft - ziel) < 2) { var p = $('.page[data-seite="' + k + '"]'); if (p) p.scrollTo({ top: 0, behavior: 'smooth' }); }
      else pg.scrollTo({ left: ziel, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      return;
    }
    render(); window.scrollTo(0, 0);
  }
  // Aktive Seite aus der Scrollposition ableiten (ohne Neuaufbau)
  document.addEventListener('scroll', function (e) {
    var pg = e.target; if (!pg || pg.id !== 'pager' || ui.springen) return;
    var k = sichtbareBereiche()[Math.round(pg.scrollLeft / pg.clientWidth)];
    if (k && k !== ui.tab) { ui.tab = k; history.replaceState(null, '', '#' + k); navSync(); }
  }, true);
  document.addEventListener('scrollend', function (e) { if (e.target && e.target.id === 'pager') ui.springen = false; }, true);
  var warSchmal = schmal();
  window.addEventListener('resize', function () {
    kopfHoehe();
    if (schmal() !== warSchmal) { warSchmal = schmal(); render(); return; }
    var pg = $('#pager'); if (pg && !ui.springen) pg.scrollLeft = sichtbareBereiche().indexOf(ui.tab) * pg.clientWidth;
  });

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
  // Aufbau nach „Progressive Disclosure“: drei Antworten oben, Details zum Aufklappen darunter.
  function aufklapp(id, titel, inhalt, offen) {
    var auf = ui.offen[id] !== undefined ? ui.offen[id] : !!offen;
    return '<details class="mehr card" data-auf="' + id + '"' + (auf ? ' open' : '') + '><summary><span>' + titel + '</span></summary><div class="mehrinhalt">' + inhalt + '</div></details>';
  }
  // Fortschrittsring (SVG); teile = [{ wert: 0..1, farbe }]
  function ring(teile, mitte, unter) {
    var r = 42, U = 2 * Math.PI * r, off = 0;
    var s = '<svg viewBox="0 0 100 100" class="ring" aria-hidden="true"><circle cx="50" cy="50" r="' + r + '" class="ringbahn"/>';
    teile.forEach(function (t) {
      var w = Math.max(0, Math.min(1 - off, t.wert));
      if (w > 0.001) s += '<circle cx="50" cy="50" r="' + r + '" class="ringteil" stroke="' + t.farbe + '" stroke-dasharray="' + (w * U) + ' ' + U + '" stroke-dashoffset="' + (-off * U) + '" transform="rotate(-90 50 50)"/>';
      off += w;
    });
    return '<div class="ringbox">' + s + '</svg><div class="ringtext"><b>' + mitte + '</b>' + (unter ? '<span>' + unter + '</span>' : '') + '</div></div>';
  }
  function hatJahr(y) { return D.buchungen.some(function (b) { return +b.datum.slice(0, 4) === y; }); }
  function zielFuer(Y) {
    var z = D.ziele[Y] && nz(D.ziele[Y].gewinn);
    if (z > 0) return { wert: z, quelle: 'ziel' };
    if (hatJahr(Y - 1)) { var v = auswertung(Y - 1).P.gewinn; if (v > 0) return { wert: v, quelle: 'vorjahr' }; }
    return null;
  }
  function honorar() { return nz(D.settings.honorar) || nz(D.hochrechnung.kvnHon) || 0; }

  // Kleine, ruhige Momente: einmalig vermerken und freundlich melden
  function meilenstein(key, text) {
    if (D.meilensteine[key]) return false;
    D.meilensteine[key] = isoHeute();
    setTimeout(function () { save(true); toast(text); }, 400);
    return true;
  }

  function antwortBleibt(A) {
    var basis = A.P.ein + Math.max(0, A.lohnNetto) + Math.max(0, A.partnerNetto);
    var teile = [
      { n: 'Praxiskosten', w: A.P.aus + A.P.inv, f: 'var(--teil-kosten)' },
      { n: 'Steuern', w: A.R.gesamt, f: 'var(--teil-steuer)' },
      { n: 'Vorsorge & Versicherungen', w: A.vorsorgeJahr.gesamt, f: 'var(--teil-vorsorge)' },
      { n: 'Dir bleibt', w: Math.max(0, A.verfuegbar), f: 'var(--teil-bleibt)' }
    ];
    var h = '<div class="antwort"><div class="frage">Was bleibt mir' + (A.vergangen ? ' ' + A.Y + ' geblieben' : '') + '?</div>';
    if (A.verfuegbar < 0) {
      h += '<div class="gross">' + eur(A.verfuegbar / 12) + ' <small>pro Monat</small></div><p class="satz">Nach Steuern und Vorsorge reicht es ' + (A.vergangen ? 'in diesem Jahr' : 'voraussichtlich') + ' nicht ganz. Schau in die Details unten, woran es liegt.</p>';
    } else {
      h += '<div class="gross">' + eur(A.verfuegbar / 12) + ' <small>pro Monat</small></div>' +
        '<p class="satz">' + (A.vergangen ? 'Nach' : 'Voraussichtlich nach') + ' Steuern, Kranken- und Altersvorsorge' + (st(A.Y).zusammen ? ' (Haushalt)' : '') + '. Im Jahr ' + eur(A.verfuegbar) + '.</p>';
    }
    if (basis > 0) {
      h += '<div class="euro" role="img" aria-label="Aufteilung jedes Euros">' + teile.map(function (t) {
        var a = Math.max(0, t.w) / basis; return a > 0.004 ? '<i style="width:' + (a * 100).toFixed(2) + '%;background:' + t.f + '"></i>' : '';
      }).join('') + '</div><div class="euroleg">' + teile.map(function (t) {
        return '<span><i style="background:' + t.f + '"></i>' + t.n + ' <b>' + Math.round(Math.max(0, t.w) / basis * 100) + ' ct</b></span>';
      }).join('') + '</div><p class="muted small">… von jedem Euro, der hereinkommt' + (A.lohnNetto > 0 ? ' (Praxis und Anstellung)' : '') + '.</p>';
    }
    return h + '</div>';
  }

  function antwortSteuer(A) {
    var S = st(A.Y), L = S.lohn;
    var lohnAbzug = nz(L.lohnsteuer) + nz(L.soli) + nz(L.kist);
    var bezahlt = A.bezahlt.est + A.bezahlt.soli + A.bezahlt.kist + lohnAbzug;
    var offen = A.nochZuZahlen;
    var bedarf = bezahlt + offen;
    var aktuell = A.Y === new Date().getFullYear();
    var ruecklage = aktuell ? nz(D.ruecklage.betrag) : 0;
    var gedecktR = Math.min(ruecklage, offen);
    var quote = bedarf > 0 ? (bezahlt + gedecktR) / bedarf : 1;
    var h = '<div class="antwort"><div class="frage">Reicht meine Steuerrücklage?</div><div class="antwortzeile">';
    h += ring([{ wert: bedarf > 0 ? bezahlt / bedarf : 0, farbe: 'var(--teil-steuer)' }, { wert: bedarf > 0 ? gedecktR / bedarf : 0, farbe: 'var(--teil-ruecklage)' }],
      Math.round(Math.min(1, quote) * 100) + ' %', 'gedeckt');
    var kurz = A.vergangen ? 'Steuer ' + A.Y + ': <b>' + eur(A.R.gesamt) + '</b>' :
      'Voraussichtlich <b>' + eur(A.R.gesamt) + '</b> Steuern für ' + A.Y + '.<br><span class="muted">Bezahlt ' + eur(bezahlt) + (ruecklage ? ' · zurückgelegt ' + eur(gedecktR) : '') + '</span>';
    h += '<p class="satz">' + kurz + '</p></div><div>';
    if (A.vergangen) {
      h += '<p class="satz">' + (A.R.offenGesamt > 0 ? 'Laut Rechnung sind noch etwa <b>' + eur(A.R.offenGesamt) + '</b> offen (Nachzahlung mit dem Bescheid).' : A.R.offenGesamt < 0 ? 'Voraussichtlich gibt es <b>' + eur(-A.R.offenGesamt) + '</b> zurück.' : 'Alles bezahlt.') + '</p>';
    } else if (quote >= 0.995) {
      h += '<p class="satz"><span class="haken">✓</span> <b>Gut vorgesorgt.</b> Alles bezahlt oder zurückgelegt.</p>';
      if (aktuell && bedarf > 0) meilenstein('steuer-gedeckt-' + A.Y, 'Steuer ' + A.Y + ' ist voll gedeckt – gut vorgesorgt.');
    } else {
      var luecke = offen - gedecktR;
      h += '<p class="satz">Es fehlen noch <b>' + eur(luecke) + '</b> – das sind <b>' + eur(luecke / A.monateRest) + ' pro Monat</b> bis Jahresende.</p>';
    }
    if (A.R.offenGesamt < -50 && !A.vergangen) h += '<p class="muted small">Nach heutigem Stand gibt es voraussichtlich etwa ' + eur(-A.R.offenGesamt) + ' Erstattung.</p>';
    if (aktuell) h += '<label class="inline-f">Zurückgelegt für Steuern <input type="number" inputmode="decimal" step="100" data-bind="ruecklage.betrag" value="' + (ruecklage || '') + '" placeholder="0"> €</label>';
    h += '<p class="muted small">Faustregel: von jedem Euro Gewinn etwa ' + Math.round(A.ruecklageQuote * 100) + ' Cent zur Seite legen.</p>';
    return h + '</div></div>';
  }

  function antwortKurs(A) {
    var Y = A.Y, z = zielFuer(Y);
    var h = '<div class="antwort"><div class="frage">Bin ich auf Kurs?</div>';
    var zielFeld = '<label class="inline-f">Mein Gewinnziel ' + Y + ' <input type="number" inputmode="decimal" step="1000" data-bind="ziele.' + Y + '.gewinn" value="' + ((D.ziele[Y] && D.ziele[Y].gewinn) || '') + '" placeholder="' + (z && z.quelle === 'vorjahr' ? Math.round(z.wert) : 'z. B. 60000') + '"> €</label>';
    if (!z) {
      return h + '<p class="satz">Hochrechnung für ' + Y + ': <b>' + eur(A.P.gewinn) + '</b> Gewinn. Leg ein Ziel fest, dann zeige ich dir, ob du im Plan liegst.</p>' + zielFeld + '</div>';
    }
    var soll = A.vergangen ? z.wert : z.wert * Math.min(1, A.t);
    var ist = A.I.gewinn, prog = A.P.gewinn, diff = prog - z.wert;
    var anteil = Math.max(0, Math.min(1.15, ist / z.wert)), sollA = Math.max(0, Math.min(1, soll / z.wert));
    h += '<div class="kursbar" role="img" aria-label="Fortschritt zum Gewinnziel"><i style="width:' + (Math.min(1, anteil) * 100).toFixed(1) + '%"></i>' +
      (!A.vergangen && A.t < 1 ? '<em style="left:' + (sollA * 100).toFixed(1) + '%" title="Heute im Plan"></em>' : '') + '</div>' +
      '<div class="kursleg"><span>Bisher ' + eur(ist) + '</span><span>' + (z.quelle === 'ziel' ? 'Ziel ' : 'Vorjahr ') + eur(z.wert) + '</span></div>';
    var hon = honorar(), sitz = hon > 0 ? Math.round(Math.abs(diff) / hon) : 0;
    if (A.vergangen) {
      h += '<p class="satz">' + (ist >= z.wert ? '<span class="haken">✓</span> Ziel erreicht: ' : 'Ergebnis: ') + '<b>' + eur(ist) + '</b> Gewinn, ' + (ist >= z.wert ? eur(ist - z.wert) + ' mehr als ' : eur(z.wert - ist) + ' weniger als ') + (z.quelle === 'ziel' ? 'geplant' : 'im Vorjahr') + '.</p>';
    } else if (Math.abs(diff) < z.wert * 0.02) {
      h += '<p class="satz"><span class="haken">✓</span> <b>Genau im Plan.</b> Hochrechnung ' + eur(prog) + '.</p>';
    } else if (diff > 0) {
      h += '<p class="satz"><span class="haken">✓</span> Du liegst <b>' + eur(diff) + ' über</b> ' + (z.quelle === 'ziel' ? 'deinem Ziel' : 'dem Vorjahr') + ' (Hochrechnung ' + eur(prog) + ').</p>';
    } else {
      h += '<p class="satz">Hochrechnung ' + eur(prog) + ' – <b>' + eur(-diff) + ' unter</b> ' + (z.quelle === 'ziel' ? 'deinem Ziel' : 'dem Vorjahr') + (sitz ? ', das entspricht etwa ' + sitz + ' Sitzungen' : '') + '.</p>';
    }
    if (z.quelle === 'ziel' && ist >= z.wert) meilenstein('ziel-' + Y, 'Gewinnziel ' + Y + ' erreicht. Schön!');
    if (!A.vergangen && A.t < 1) h += '<p class="muted small">Der Strich zeigt, wo du heute bei gleichmäßigem Verlauf stündest. KV-Zahlungen kommen quartalsweise, daher schwankt das.</p>';
    return h + zielFeld + '</div>';
  }

  // Was wäre, wenn …: Regler direkt im Satz, Ergebnis nach Steuer sofort
  function wennRechne(A) {
    var w = ui.wenn, hon = honorar(), AW = nz(D.settings.arbeitswochen) || 42;
    var wochenUmsatz = ((A.prog.kvn || 0) + (A.prog.privat || 0)) / AW;
    var dUmsatz = w.sitz * hon * AW - w.urlaub * (wochenUmsatz + w.sitz * hon);
    var dGewinn = dUmsatz - w.ausg * 12;
    var e2 = JSON.parse(JSON.stringify(A.eingabe));
    e2.a.gewinn += dGewinn;
    var R2 = Steuer.berechne(e2);
    var dSteuer = R2.gesamt - A.R.gesamt;
    return { dGewinn: dGewinn, dSteuer: dSteuer, dNetto: dGewinn - dSteuer, hon: hon, AW: AW, wochenUmsatz: wochenUmsatz, grenz: A.R.grenz };
  }
  function wennErgebnis(A) {
    var r = wennRechne(A), w = ui.wenn;
    if (!w.sitz && !w.urlaub && !w.ausg) {
      var e1 = JSON.parse(JSON.stringify(A.eingabe)); e1.a.gewinn += 1000;
      var proEuro = 1 - (Steuer.berechne(e1).gesamt - A.R.gesamt) / 1000;
      return '<p class="wennerg">Schieb an den Reglern. <span class="muted">Zur Orientierung: Von jedem zusätzlichen Euro Gewinn blieben dir derzeit etwa <b>' + Math.round(Math.max(0, Math.min(1, proEuro)) * 100) + ' Cent</b>.</span></p>';
    }
    if (w.sitz && !r.hon) return '<p class="wennerg">Trag unten dein <b>Honorar je Sitzung</b> ein, dann rechne ich die zusätzlichen Sitzungen aus.</p>';
    var plus = r.dGewinn >= 0;
    var cent = r.dGewinn ? Math.round(r.dNetto / r.dGewinn * 100) : 0;
    return '<p class="wennerg">Dann hättest du im Jahr <b class="' + (plus ? 'pos' : 'neg') + '">' + eur(Math.abs(r.dGewinn)) + ' ' + (plus ? 'mehr' : 'weniger') + '</b> Gewinn. ' +
      (plus ? 'Davon gingen ' + eur(r.dSteuer) + ' an Steuern – <b>dir blieben ' + eur(r.dNetto) + '</b>' : 'Die Steuer sänke um ' + eur(-r.dSteuer) + ' – <b>dir blieben ' + eur(-r.dNetto) + ' weniger</b>') +
      ' (≈ ' + eur(Math.abs(r.dNetto) / 12) + ' im Monat).' + (cent && plus ? ' Von jedem zusätzlichen Euro bleiben ' + cent + ' Cent.' : '') + '</p>';
  }
  function kartenWenn(A) {
    var w = ui.wenn, hon = honorar(), AW = nz(D.settings.arbeitswochen) || 42;
    var regler = function (k, min, max, step, text) {
      return '<span class="regler"><input type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + w[k] + '" data-wenn="' + k + '" aria-label="' + text + '"><output id="wenn-' + k + '">' + wennLabel(k, w[k]) + '</output></span>';
    };
    var h = '<div class="wenn"><div class="wennzeilen">' +
      '<div class="wennzeile"><span>Sitzungen pro Woche</span>' + regler('sitz', -6, 10, 1, 'Sitzungen pro Woche') + '</div>' +
      '<div class="wennzeile"><span>Urlaub im Jahr</span>' + regler('urlaub', -4, 8, 1, 'Urlaubswochen') + '</div>' +
      '<div class="wennzeile"><span>Praxisausgaben pro Monat</span>' + regler('ausg', -500, 1500, 50, 'Ausgaben pro Monat') + '</div></div>' +
      '<div id="wenn-erg">' + wennErgebnis(A) + '</div>' +
      '<div class="row wennbasis"><label class="f"><span>Honorar je Sitzung (€)</span><input type="number" inputmode="decimal" step="1" data-bind="settings.honorar" value="' + (nz(D.settings.honorar) || hon || '') + '"' + (hon ? '' : ' class="fehlt" placeholder="bitte eintragen"') + '></label>' +
      '<label class="f"><span>Arbeitswochen im Jahr</span><input type="number" inputmode="numeric" step="1" data-bind="settings.arbeitswochen" value="' + AW + '"></label>' +
      (w.sitz || w.urlaub || w.ausg ? '<div><button class="btn small" data-act="wenn-null">Zurücksetzen</button></div>' : '') + '</div>' +
      '<p class="muted small">Gerechnet aufs ganze Jahr ' + A.Y + ' mit deiner Hochrechnung als Basis. Urlaub: je Woche fällt der durchschnittliche Wochenumsatz aus KV und Privat weg (' + eur(wennRechne(A).wochenUmsatz) + '). Beiträge zu Versorgungswerk und Krankenversicherung bleiben unverändert angenommen.</p></div>';
    return h;
  }
  function wennLabel(k, v) {
    v = +v;
    if (k === 'sitz') return v === 0 ? 'gleich viele' : (v > 0 ? v + ' mehr' : -v + ' weniger');
    if (k === 'urlaub') return v === 0 ? 'gleich viel' : (v > 0 ? v + ' Woche' + (v > 1 ? 'n' : '') + ' mehr' : -v + ' Woche' + (v < -1 ? 'n' : '') + ' weniger');
    if (k === 'ausg') return v === 0 ? '0 €' : (v > 0 ? '+' : '−') + eur(Math.abs(v));
    return v;
  }

  function installHinweis() {
    if (istApp() || !schmal()) return '';
    try { if (localStorage.getItem('fk.installHinweis') === 'weg') return ''; } catch (e) { /* ignorieren */ }
    if (installEvt) return '<div class="note install"><div><b>Als App installieren?</b> Dann startet der Finanzkompass ohne Adressleiste – wie eine normale App.</div><div class="btns"><button class="btn primary small" data-act="installieren">Installieren</button><button class="btn small" data-act="install-weg">Später</button></div></div>';
    return '<div class="note install"><div>Du nutzt den Finanzkompass im Browser. <b>Als App:</b> Chrome-Menü ⋮ → „App installieren“. Ist sie schon installiert, öffne sie über ihr App-Symbol.</div><div class="btns"><button class="btn small" data-act="install-weg">Verstanden</button></div></div>';
  }

  // ---------------------------------------------------------------- Übersicht: Karten (verschieb- und ausblendbar)
  function karte(id, inhalt, breit, cls) { return '<div class="card k-' + id + (breit ? ' breit' : '') + (cls ? ' ' + cls : '') + '">' + inhalt + '</div>'; }

  function karteZuordnen(A) {
    var offen = D.buchungen.filter(function (b) { return !b.kat; }).length;
    if (offen) {
      var min = Math.max(1, Math.round(offen * 6 / 60));
      return karte('zuordnen', '<div><div class="frage">' + offen + (offen === 1 ? ' Buchung wartet' : ' Buchungen warten') + ' auf eine Kategorie</div>' +
        '<p class="muted small">Eine nach der anderen, mit Vorschlägen · etwa ' + min + ' Min.</p></div>' +
        '<button class="btn primary" data-act="ritual">Zuordnen</button>', true, 'ritualkarte');
    }
    var letzt = D.meta.letzterImport ? 'Letzter Import ' + new Date(D.meta.letzterImport).toLocaleDateString('de-DE') : 'Neue Umsätze einfach importieren';
    return karte('zuordnen', '<div><div class="frage"><span class="haken">✓</span> Alles zugeordnet</div><p class="muted small">' + letzt + '</p></div>' +
      '<button class="btn" data-act="csv">Importieren</button>', true, 'ritualkarte still');
  }

  // Wiederkehrende Zahlungen erkennen (Abstand und Häufigkeit; ähnlich der Vertragserkennung in Finanz-Apps)
  function wiederkehrend() {
    var gruppen = {}, ref = null;
    D.buchungen.forEach(function (b) { if (!ref || b.datum > ref) ref = b.datum; });
    if (!ref) return [];
    var refT = new Date(ref + 'T12:00:00').getTime();
    D.buchungen.forEach(function (b) {
      var g = gruppe(b.kat);
      if (!b.kat || ['praxis_aus', 'vorsorge', 'praxis_ein'].indexOf(g) < 0) return;
      var t = new Date(b.datum + 'T12:00:00').getTime();
      if (refT - t > 400 * 864e5) return;
      // Vorzeichen muss zur Kategorie passen (Gutschriften bei Ausgaben-Kategorien zählen nicht als Fixkosten)
      if ((g === 'praxis_ein') !== (b.betrag > 0)) return;
      var key = (nameKey(b) || normIBAN(b.iban)) + '|' + b.kat;
      (gruppen[key] = gruppen[key] || []).push({ b: b, t: t });
    });
    var med = function (a) { var s = a.slice().sort(function (x, y) { return x - y; }); var m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
    var liste = [];
    Object.keys(gruppen).forEach(function (key) {
      var e = gruppen[key].sort(function (x, y) { return x.t - y.t; });
      var monate = {}; e.forEach(function (x) { monate[x.b.datum.slice(0, 7)] = 1; });
      if (e.length < 3 || Object.keys(monate).length < 3) return;
      var abst = []; for (var i = 1; i < e.length; i++) abst.push((e[i].t - e[i - 1].t) / 864e5);
      var mi = Math.max(1, med(abst));
      var rhythmus = mi <= 20 ? 'mehrmals im Monat' : mi <= 40 ? 'monatlich' : mi <= 105 ? 'vierteljährlich' : mi <= 200 ? 'halbjährlich' : null;
      if (!rhythmus) return;
      // nur aktive Zahlungsströme: letzte Zahlung nicht länger als 1,5 Intervalle (mind. 45 Tage) vor dem letzten Kontostand
      if ((refT - e[e.length - 1].t) / 864e5 > Math.max(45, mi * 1.5)) return;
      var summe = e.reduce(function (s, x) { return s + x.b.betrag; }, 0);
      var spanne = (e[e.length - 1].t - e[0].t) / 864e5 + Math.max(mi, 30.44);
      var proMonat = summe / (spanne / 30.44);
      var naechst = e[e.length - 1].t, heute = Date.now(), schritt = Math.max(mi, 28) * 864e5;
      if (mi > 20) { do { naechst += schritt; } while (naechst < heute - 2 * 864e5); } else naechst = null;
      var letzter = e[e.length - 1].b;
      liste.push({ name: String(letzter.gegenpartei || letzter.iban || '').split('\n')[0].replace(/\s{2,}/g, ' '), kat: letzter.kat, gruppe: gruppe(letzter.kat),
        rhythmus: rhythmus, proMonat: proMonat, typisch: med(e.map(function (x) { return x.b.betrag; })), naechst: naechst, n: e.length });
    });
    return liste.sort(function (a, b) { return Math.abs(b.proMonat) - Math.abs(a.proMonat); });
  }

  function karteFixkosten(A) {
    var w = wiederkehrend().filter(function (x) { return x.proMonat < 0; });
    if (!w.length) return '';
    var praxis = w.filter(function (x) { return x.gruppe === 'praxis_aus'; }), vors = w.filter(function (x) { return x.gruppe === 'vorsorge'; });
    var sum = function (l) { return -l.reduce(function (s, x) { return s + x.proMonat; }, 0); };
    var gesamt = sum(w), hon = honorar();
    var h = '<div class="frage">Fixkosten</div><div class="gross mittel">' + eur(gesamt) + ' <small>pro Monat</small></div>' +
      '<p class="satz">' + (hon ? 'Dafür brauchst du etwa <b>' + Math.ceil(gesamt / hon) + ' Sitzungen</b> im Monat. ' : '') +
      '<span class="muted">Praxis ' + eur(sum(praxis)) + ' · Vorsorge &amp; Versicherungen ' + eur(sum(vors)) + '</span></p>';
    var zeile = function (x) { return '<div class="fixrow"><span><b>' + esc(x.name) + '</b><small>' + esc(katName(x.kat)) + ' · ' + x.rhythmus + '</small></span><em>' + eur(-x.proMonat) + '</em></div>'; };
    h += '<div class="fixliste">' + w.slice(0, 5).map(zeile).join('') + '</div>';
    if (w.length > 5) h += '<details class="weitere"><summary>' + (w.length - 5) + ' weitere</summary><div class="fixliste">' + w.slice(5).map(zeile).join('') + '</div></details>';
    h += '<p class="muted small">Automatisch erkannt aus wiederkehrenden Zahlungen, auf den Monat umgerechnet. Jährliche Beiträge erkennt die App erst nach zwei Jahren.</p>';
    return karte('fixkosten', h);
  }

  function karteTermine(A) {
    if (A.Y !== new Date().getFullYear()) return '';
    var heute = new Date(), jetzt = isoHeute(), items = [];
    // Steuer-Vorauszahlungen: 10.3., 10.6., 10.9., 10.12. (§ 37 Abs. 1 EStG)
    var termine = [], y = heute.getFullYear();
    [y, y + 1].forEach(function (jj) { ['03', '06', '09', '12'].forEach(function (m) { termine.push(jj + '-' + m + '-10'); }); });
    var nt = termine.filter(function (d) { return d >= jetzt; })[0];
    var S = D.steuer[+nt.slice(0, 4)] || st(A.Y), vz = S && S.vz ? nz(S.vz.est) + nz(S.vz.soli) + nz(S.vz.kist) : 0;
    items.push({ d: nt, t: 'Steuer-Vorauszahlung', s: vz ? 'ESt, Soli, KiSt' : 'Betrag: Vorauszahlungsbescheid unter Steuer eintragen', b: vz ? -vz / 4 : null, cls: 'steuer' });
    // Erwartete Zahlungen aus wiederkehrenden Buchungen (nächste 35 Tage)
    var grenze = Date.now() + 35 * 864e5;
    wiederkehrend().forEach(function (x) {
      if (!x.naechst || x.naechst > grenze) return;
      var d = new Date(x.naechst); var iso = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      items.push({ d: iso, t: x.name, s: 'erwartet · ' + x.rhythmus, b: x.typisch, cls: x.typisch > 0 ? 'ein' : '' });
    });
    // Steuertermin immer zeigen, dazu die nächsten erwarteten Zahlungen
    var steuerI = items.shift();
    items.sort(function (a, b) { return a.d < b.d ? -1 : 1; });
    items = items.slice(0, 5).concat([steuerI]).sort(function (a, b) { return a.d < b.d ? -1 : 1; });
    var tage = function (iso) { var n = Math.round((new Date(iso + 'T12:00:00') - new Date(jetzt + 'T12:00:00')) / 864e5); return n <= 0 ? 'heute' : n === 1 ? 'morgen' : 'in ' + n + ' Tagen'; };
    var h = '<div class="frage">Demnächst</div><div class="termine">' + items.slice(0, 6).map(function (i) {
      var p = i.d.split('-');
      return '<div class="termin ' + i.cls + '"><div class="tdatum"><b>' + +p[2] + '.</b><span>' + MONATE[+p[1] - 1] + '</span></div><div class="ttext"><b>' + esc(i.t) + '</b><small>' + tage(i.d) + ' · ' + esc(i.s) + '</small></div>' +
        (i.b !== null ? '<em class="' + (i.b > 0 ? 'pos' : '') + '">' + (i.b > 0 ? '+' : '') + eur(i.b) + '</em>' : '') + '</div>';
    }).join('') + '</div>';
    return karte('termine', h);
  }

  function karteMonat(A) {
    if (!A.stichtag) return '';
    var st0 = new Date(A.stichtag + 'T12:00:00'), letzterTag = new Date(st0.getFullYear(), st0.getMonth() + 1, 0).getDate();
    var m = st0.getDate() >= letzterTag - 1 ? st0.getMonth() : st0.getMonth() - 1, y = st0.getFullYear();
    if (m < 0) { m = 11; y--; }
    var vm = m - 1, vy = y; if (vm < 0) { vm = 11; vy--; }
    var werte = function (yy, mm) {
      var o = { ein: 0, aus: 0, kats: {} }, pre = yy + '-' + pad(mm + 1);
      D.buchungen.forEach(function (b) {
        if (b.datum.slice(0, 7) !== pre) return;
        var g = gruppe(b.kat);
        if (g === 'praxis_ein') o.ein += b.betrag;
        else if (g === 'praxis_aus' || g === 'praxis_inv' || g === 'vorsorge') { o.aus -= b.betrag; o.kats[b.kat] = (o.kats[b.kat] || 0) - b.betrag; }
      });
      o.saldo = o.ein - o.aus; return o;
    };
    var a = werte(y, m), v = werte(vy, vm);
    if (!a.ein && !a.aus) return '';
    var mName = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    var diff = v.saldo ? (a.saldo - v.saldo) / Math.abs(v.saldo) : 0;
    var top = Object.keys(a.kats).sort(function (x, z) { return a.kats[z] - a.kats[x]; }).slice(0, 3);
    var max = Math.max(a.ein, a.aus, 1);
    var h = '<div class="frage">Rückblick ' + mName[m] + '</div>' +
      '<div class="balkenpaar"><div><span>Eingenommen</span><i style="width:' + (a.ein / max * 100).toFixed(1) + '%;background:var(--teil-bleibt)"></i><b>' + eur(a.ein) + '</b></div>' +
      '<div><span>Ausgegeben</span><i style="width:' + (a.aus / max * 100).toFixed(1) + '%;background:var(--teil-kosten)"></i><b>' + eur(a.aus) + '</b></div></div>' +
      '<p class="satz">Überschuss <b>' + eur(a.saldo) + '</b>' + (v.saldo ? ' <span class="' + (diff >= 0 ? 'pos' : 'muted') + '">' + (diff >= 0 ? '▲ ' : '▼ ') + Math.abs(Math.round(diff * 100)) + ' % zum ' + mName[vm] + '</span>' : '') + '</p>' +
      (top.length ? '<p class="muted small">Größte Posten: ' + top.map(function (k) { return esc(katName(k)) + ' ' + eur(a.kats[k]); }).join(' · ') + '</p>' : '') +
      '<p class="muted small">Praxis plus Vorsorge, ohne Steuern und Privatentnahmen.</p>';
    return karte('monat', h);
  }

  function karteWohin(A) {
    var sicht = ui.wohin || 'wohin';
    var posten = [];
    if (sicht === 'wohin') {
      KAT.forEach(function (k) { if (['praxis_aus', 'praxis_inv', 'vorsorge'].indexOf(k.gruppe) >= 0 && A.ist[k.id] < 0) posten.push({ k: k.id, n: k.name, w: -A.ist[k.id] }); });
      var stz = -((A.ist.st_est || 0) + (A.ist.st_soli || 0) + (A.ist.st_kist || 0)); if (stz > 0) posten.push({ k: 'g:steuer', n: 'Steuern', w: stz });
    } else {
      KAT.forEach(function (k) { if ((k.gruppe === 'praxis_ein' || k.id === 'lohn') && A.ist[k.id] > 0) posten.push({ k: k.id, n: k.name, w: A.ist[k.id] }); });
    }
    posten.sort(function (a, b) { return b.w - a.w; });
    var summe = posten.reduce(function (s, p) { return s + p.w; }, 0);
    if (!summe) return '';
    if (posten.length > 7) { var rest = posten.slice(6); posten = posten.slice(0, 6); posten.push({ k: '', n: 'Weitere (' + rest.length + ')', w: rest.reduce(function (s, p) { return s + p.w; }, 0) }); }
    var max = posten[0].w;
    var h = '<div class="khead"><div class="frage">' + (sicht === 'wohin' ? 'Wohin geht das Geld?' : 'Woher kommt das Geld?') + '</div>' +
      '<div class="seg klein"><button data-act="wohin" data-v="woher" aria-pressed="' + (sicht === 'woher') + '">Woher</button><button data-act="wohin" data-v="wohin" aria-pressed="' + (sicht === 'wohin') + '">Wohin</button></div></div>' +
      '<div class="hbalken">' + posten.map(function (p) {
        return '<button class="hb" ' + (p.k ? 'data-act="zeige-kat" data-k="' + p.k + '"' : 'disabled') + '><span class="hbname">' + esc(p.n) + '</span><span class="hbbar"><i style="width:' + (p.w / max * 100).toFixed(1) + '%;background:' + (sicht === 'wohin' ? 'var(--teil-kosten)' : 'var(--teil-bleibt)') + '"></i></span><b>' + eur(p.w) + '</b><small>' + Math.round(p.w / summe * 100) + ' %</small></button>';
      }).join('') + '</div><p class="muted small">Ist ' + A.Y + (A.t < 1 ? ' bis ' + datumDE(A.stichtag) : '') + ' · Tippen zeigt die Buchungen.</p>';
    return karte('wohin', h);
  }

  function karteDetails(A) {
    var Y = A.Y;
    var tiles = '<div class="tiles">' +
      tile('Steuerlicher Gewinn', eur(A.P.gewinn), A.t < 1 ? 'Ist ' + eur(A.I.gewinn) : 'EÜR') +
      tile('Steuern ' + Y, eur(A.R.gesamt), 'Ø ' + pct(A.R.durchschnitt) + ' · Grenz ' + pct(A.R.grenz, 0)) +
      tile('Noch zu zahlen', eur(A.nochZuZahlen), 'Vorauszahlungen + Nachzahlung') +
      tile('Rücklage pro Monat', eur(A.ruecklageMonat), A.monateRest + ' Monat(e) bis Jahresende') + '</div>';
    var zeilen = [['<b>Betriebseinnahmen</b>', A.I.ein, A.P.ein, 'sum']];
    katsIn('praxis_ein').forEach(function (k) { var i = A.ist[k.id] || 0, p = A.prog[k.id] || 0; if (i || p) zeilen.push([wbr(esc(k.name)), i, p, 'sub']); });
    zeilen.push(['<b>Betriebsausgaben</b>', -A.I.aus, -A.P.aus, 'sum']);
    katsIn('praxis_aus').forEach(function (k) { var i = A.ist[k.id] || 0, p = A.prog[k.id] || 0; if (i || p) zeilen.push([wbr(esc(k.name)), i, p, 'sub']); });
    zeilen.push(['Abschreibungen (AfA/GWG)', -A.I.afa, -A.P.afa, 'sub']);
    if (A.pausch) zeilen.push(['Pauschalen (nicht kontowirksam)', -A.I.pausch, -A.P.pausch, 'sub']);
    zeilen.push(['<b>Steuerlicher Gewinn</b>', A.I.gewinn, A.P.gewinn, 'sum']);
    zeilen.push(['Anschaffungen (Abfluss)', -A.I.inv, -A.P.inv, 'sub']);
    zeilen.push(['<b>Cashflow-Überschuss Praxis</b>', A.I.cashflow, A.P.cashflow, 'sum']);
    var eur2 = '<div class="zliste drei"><div class="zrow kopfz"><span></span><b>Ist</b>' + (A.t < 1 ? '<b>Prognose</b>' : '') + '</div>' + zeilen.map(function (z) {
      return '<div class="zrow ' + z[3] + '"><span>' + z[0] + '</span><b>' + eur(z[1]) + '</b>' + (A.t < 1 ? '<b>' + eur(z[2]) + '</b>' : '') + '</div>';
    }).join('') + '</div>';
    var cf = zliste([
      ['Cashflow-Überschuss Praxis', eur(A.P.cashflow)],
      A.lohnNetto ? ['+ Lohn aus Anstellung (nach Sozialabgaben)', eur(A.lohnNetto)] : null,
      A.partnerNetto ? ['+ Partnerin (nach Abgaben und Vorsorge)', eur(A.partnerNetto)] : null,
      ['− Einkommensteuer, Soli, Kirchensteuer', eur(-A.R.gesamt)],
      ['− Kranken-/Pflegeversicherung', eur(-A.vorsorgeJahr.kvpv)],
      ['− Versorgungswerk', eur(-A.vorsorgeJahr.pvw)],
      ['− BU, Krankentagegeld, weitere', eur(-A.vorsorgeJahr.sonstige)],
      ['Verfügbar im Jahr', eur(A.verfuegbar), 'sum'],
      ['Verfügbar pro Monat', eur(A.verfuegbar / 12)]
    ]);
    var innen = function (id, t, x) { var auf = !!ui.offen[id]; return '<details class="mehr innen" data-auf="' + id + '"' + (auf ? ' open' : '') + '><summary><span>' + t + '</span></summary><div class="mehrinhalt">' + x + '</div></details>'; };
    return '<div class="card k-details breit"><div class="frage">Details</div>' +
      innen('zahlen', 'Kennzahlen', tiles) + innen('monate', 'Einnahmen und Ausgaben je Monat', monatsChart(A.mon)) +
      innen('ergebnis', 'Ergebnis (EÜR)', eur2) + innen('cashflow', 'Vom Cashflow zum verfügbaren Betrag', cf) + '</div>';
  }

  var KARTEN = [
    { id: 'bleibt', n: 'Was bleibt mir?', f: function (A) { return karte('bleibt', antwortBleibt(A), true, 'hero'); } },
    { id: 'steuer', n: 'Reicht meine Steuerrücklage?', f: function (A) { return karte('steuer', antwortSteuer(A)); } },
    { id: 'kurs', n: 'Bin ich auf Kurs?', f: function (A) { return karte('kurs', antwortKurs(A)); } },
    { id: 'termine', n: 'Demnächst (Termine)', f: karteTermine },
    { id: 'zuordnen', n: 'Zuordnen', f: karteZuordnen },
    { id: 'monat', n: 'Monatsrückblick', f: karteMonat },
    { id: 'wohin', n: 'Woher und wohin', f: karteWohin },
    { id: 'fixkosten', n: 'Fixkosten', f: karteFixkosten },
    { id: 'wenn', n: 'Was wäre, wenn …', f: function (A) { return A.vergangen ? '' : aufklapp('wenn', 'Was wäre, wenn …', kartenWenn(A), true).replace('class="mehr card"', 'class="mehr card breit"'); } },
    { id: 'details', n: 'Details (Kennzahlen, Monate, EÜR)', f: karteDetails }
  ];
  var KARTEMAP = {}; KARTEN.forEach(function (k) { KARTEMAP[k.id] = k; });
  function kartenOrdnung() {
    var s = D.settings.karten;
    if (!s || !s.order) s = D.settings.karten = { order: [], aus: [] };
    KARTEN.forEach(function (k) { if (s.order.indexOf(k.id) < 0) s.order.push(k.id); });
    s.order = s.order.filter(function (id) { return !!KARTEMAP[id]; });
    s.aus = s.aus || [];
    return s;
  }

  function viewUebersicht() {
    var A = auswertung(ui.jahr), Y = ui.jahr;
    var h = installHinweis() + '<h1>Übersicht ' + Y + '</h1>';
    if (!D.buchungen.length) {
      return h + '<p class="lead">Noch keine Buchungen. Starte mit dem Import der apoBank-Umsätze (Excel oder CSV).</p>' +
        '<div class="card"><div class="btns"><button class="btn primary" data-act="csv">Kontoumsätze importieren</button><button class="btn" data-act="neu">Buchung anlegen</button>' +
        (hatFS ? '<button class="btn" data-act="datei-oeffnen">Vorhandene Datendatei öffnen</button>' : '<button class="btn" data-act="import-json">Datensicherung einlesen</button>') +
        '</div></div>';
    }
    var stand = A.vergangen ? 'Abgeschlossenes Jahr' : A.zukunft ? 'Planjahr' : 'Stand ' + datumDE(A.stichtag) + ' · Rest des Jahres hochgerechnet';
    h += '<p class="lead">' + stand + '</p>';
    if (fileHandle && dateiStatus === 'erlaubnis') h += '<div class="note warn"><b>Dateizugriff erneut erlauben.</b> <a href="#" data-act="datei-erlauben">Erlauben</a></div>';
    if (A.R.avUeberHB > 0) h += '<div class="note bad"><b>Altersvorsorge über dem Höchstbetrag:</b> ' + eur(A.R.avUeberHB) + ' wirken steuerlich nicht.</div>';
    var s = kartenOrdnung(), inhalt = '';
    s.order.forEach(function (id) { if (s.aus.indexOf(id) < 0) inhalt += KARTEMAP[id].f(A) || ''; });
    h += '<div class="antworten">' + inhalt + '</div>';
    h += '<div class="anpassenlink"><button class="btn small" data-act="anpassen" data-was="karten">Übersicht anpassen</button></div>';
    if (!A.unkat && D.buchungen.length) meilenstein('zugeordnet-' + (D.meta.letzterImport || 'start'), 'Alles zugeordnet. Die Zahlen sind vollständig.');
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
    h += '<div class="btns" style="margin:0 0 14px"><button class="btn primary" data-act="neu">Buchung anlegen</button><button class="btn" data-act="csv">Excel/CSV importieren</button><button class="btn" data-act="regeln-anwenden">Regeln auf leere anwenden</button>' + (function () { var n = D.buchungen.filter(function (b) { return !b.kat; }).length; return n ? '<button class="btn" data-act="ritual">Zuordnen (' + n + ')</button>' : ''; })() + '</div>';
    h += '<div class="filters">' +
      '<select id="f-monat" data-filter="monat"><option value="">Alle Monate</option>' + MONATE.map(function (m, i) { return '<option value="' + (i + 1) + '"' + (+f.monat === i + 1 ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select>' +
      '<select id="f-kat" data-filter="kat"><option value="">Alle Kategorien</option><option value="_leer"' + (f.kat === '_leer' ? ' selected' : '') + '>Ohne Kategorie</option>' +
      GRUPPEN.map(function (g) { return '<option value="g:' + g.id + '"' + (f.kat === 'g:' + g.id ? ' selected' : '') + '>Gruppe: ' + esc(g.name) + '</option>'; }).join('') +
      KAT.map(function (k) { return '<option value="' + k.id + '"' + (f.kat === k.id ? ' selected' : '') + '>' + esc(k.name) + '</option>'; }).join('') + '</select>' +
      '<input type="text" id="f-suche" data-filter="suche" placeholder="Suche (Name, Text, Betrag)" value="' + esc(f.suche) + '">' +
      '</div>';
    var aw = ui.auswahl;
    if (!aw) {
      h += '<div class="listkopf"><p class="muted small">' + liste.length + ' Buchungen · Summe ' + eur(summe, 2) + '</p>' +
        (liste.length ? '<div class="btns"><button class="btn small" data-act="auswahl-an">Auswählen</button><button class="btn small danger" data-act="loeschen-angezeigt">Angezeigte löschen (' + liste.length + ')</button></div>' : '') + '</div>';
    } else {
      var gew = liste.filter(function (b) { return aw[b.id]; }), gs = gew.reduce(function (s, b) { return s + b.betrag; }, 0);
      h += '<div class="auswahlleiste"><div><b>' + gew.length + ' ausgewählt</b>' + (gew.length ? ' · Summe ' + eur(gs, 2) : '') + '</div><div class="btns">' +
        (gew.length < liste.length ? '<button class="btn small" data-act="auswahl-alle">Alle ' + liste.length + ' auswählen</button>' : '') +
        (gew.length ? '<button class="btn small" data-act="auswahl-keine">Keine</button>' : '') +
        '<select id="auswahl-kat" aria-label="Kategorie für Auswahl setzen"' + (gew.length ? '' : ' disabled') + '><option value="">Kategorie setzen …</option>' + katOptions('', false) + '</select>' +
        '<button class="btn small danger" data-act="auswahl-loeschen"' + (gew.length ? '' : ' disabled') + '>Ausgewählte löschen (' + gew.length + ')</button>' +
        '<button class="btn small primary" data-act="auswahl-aus">Fertig</button></div></div>';
    }
    if (!liste.length) return h + '<div class="card empty">Keine Buchungen für diese Auswahl.</div>';
    h += '<div class="card" style="padding:4px 12px"><ul class="blist' + (aw ? ' waehlen' : '') + '">';
    liste.slice(0, f.limit).forEach(function (b) {
      var sj = b.steuerjahr && +b.steuerjahr !== +b.datum.slice(0, 4) ? '<span class="tag">Steuerjahr ' + b.steuerjahr + '</span>' : '';
      var an = aw && aw[b.id];
      h += '<li' + (an ? ' class="gewaehlt"' : '') + '><div class="d"' + (aw ? ' data-act="waehle" data-id="' + b.id + '"' : '') + '>' +
        (aw ? '<input type="checkbox" data-act="waehle" data-id="' + b.id + '"' + (an ? ' checked' : '') + ' aria-label="Buchung auswählen">' : '') + datumDE(b.datum) + '</div>' +
        '<div class="t" data-act="' + (aw ? 'waehle' : 'bearbeiten') + '" data-id="' + b.id + '"><div class="who">' + esc(b.gegenpartei || '–') + sj + '</div><div class="what">' + esc(b.text || b.notiz || '') + '</div></div>' +
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
      '<div class="dbody" id="csvbody"><p>Export der apoBank (oder einer anderen Bank) auswählen: Excel (.xlsx) oder CSV. Die Spalten ordnest du im nächsten Schritt zu; die Zuordnung wird für künftige Importe gespeichert. Enthält die Datei eine Spalte „Kategorie“, „Steuerjahr“ oder „Aufteilung“, wird sie automatisch übernommen.</p><p class="muted small">App-Version ' + APP_VERSION + '</p>' +
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
    D.meta.letzterImport = new Date().toISOString();
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
  // Ergebnis zuerst, Eingaben in aufklappbaren Gruppen mit Ein-Zeilen-Zusammenfassung, Erklärungen hinter „i“.
  function viewSteuer() {
    var Y = ui.jahr, A = auswertung(Y), R = A.R, S = st(Y), p = 'steuer.' + Y, Pa = R.personen[0];
    var tarifInfo = R.parameter.fortgeschrieben ? 'Tarif 2026 mit ' + pct(D.settings.inflation) + ' p. a. fortgeschrieben.' : (Y < 2026 ? 'Tarif 2026 als Näherung.' : 'Tarif 2026 (§ 32a EStG).');
    var h = '<h1>Steuer ' + Y + '</h1>';
    var lohnAbzug = nz(S.lohn.lohnsteuer) + nz(S.lohn.soli) + nz(S.lohn.kist) + (S.zusammen ? nz(S.partner.lohn.lohnsteuer) + nz(S.partner.lohn.soli) + nz(S.partner.lohn.kist) : 0);
    var bezahlt = A.bezahlt.est + A.bezahlt.soli + A.bezahlt.kist;
    var vzOffen = A.vzOffen.est + A.vzOffen.soli + A.vzOffen.kist;

    // Ergebnis
    h += '<div class="card hero">' + kopf('Voraussichtlich', 'Einkommensteuer, Solidaritätszuschlag und Kirchensteuer auf Basis deiner Hochrechnung. ' + tarifInfo + ' Orientierungsrechnung, keine Steuerberatung; Kapitalerträge sind nicht enthalten.') +
      '<div class="gross">' + eur(R.gesamt) + '</div>' +
      '<div class="pills"><span>Ø-Satz <b>' + pct(R.durchschnitt, 0) + '</b></span><span>Grenzsatz <b>' + pct(R.grenz, 0) + '</b></span><span>zvE <b>' + eur(R.zvE) + '</b></span></div>' +
      '<div class="stats">' +
      '<div><small>Bezahlt</small><b>' + eur(bezahlt + lohnAbzug) + '</b></div>' +
      '<div><small>Noch fällig (Bescheid)</small><b>' + eur(vzOffen) + '</b></div>' +
      '<div><small>' + (R.offenGesamt >= 0 ? 'Nachzahlung' : 'Erstattung') + '</small><b class="' + (R.offenGesamt < 0 ? 'pos' : '') + '">' + eur(Math.abs(R.offenGesamt)) + '</b></div></div>' +
      (A.nochZuZahlen > 0 && !A.vergangen ? '<p class="satz">Leg bis Jahresende <b>' + eur(A.ruecklageMonat) + ' pro Monat</b> zurück.</p>' : '') +
      (R.avUeberHB > 0 ? '<div class="note bad"><b>Höchstbetrag Altersvorsorge überschritten:</b> ' + eur(R.avUeberHB) + ' über ' + eur(R.hbAV) + '.</div>' : '') + '</div>';

    // So entsteht die Steuer
    var rechnung = zliste([
      ['Gewinn aus der Praxis', eur(Pa.einkuenfte18)],
      Pa.einkuenfte19 ? ['+ Einkünfte aus Anstellung', eur(Pa.einkuenfte19)] : null,
      R.zusammen ? ['+ Einkünfte Partnerin', eur(R.personen[1].summe)] : null,
      ['− Altersvorsorge', eur(-R.avAbzug)],
      ['− Kranken-/Pflegeversicherung', eur(-R.basisKVPV)],
      R.sonstigeWirksam ? ['− weitere Vorsorge', eur(-R.sonstigeWirksam)] : null,
      ['− Kirchensteuer, Pauschbetrag', eur(-R.saUebrige)],
      ['Zu versteuerndes Einkommen', eur(R.zvE), 'sum'],
      ['Einkommensteuer' + (R.zusammen ? ' (Splitting)' : ''), eur(R.est)],
      ['Solidaritätszuschlag', eur(R.soli)],
      ['Kirchensteuer (' + pct(D.settings.kistSatz, 0) + ')', eur(R.kist)],
      ['Steuern gesamt', eur(R.gesamt), 'sum']
    ]) + '<p class="muted small">Altersvorsorge ' + eur(R.avGesamt) + ' von ' + eur(R.hbAV) + ' Höchstbetrag genutzt.</p>';
    h += gruppeKarte('st-rechnung', 'So entsteht die Steuer', 'zu versteuern ' + eur(R.zvE), rechnung);

    // Veranlagung
    var ver = '<div class="seg" style="margin-bottom:10px"><button data-act="set" data-path="' + p + '.zusammen" data-v="false" aria-pressed="' + !S.zusammen + '">Einzeln</button><button data-act="set" data-path="' + p + '.zusammen" data-v="true" aria-pressed="' + !!S.zusammen + '">Zusammen</button></div>' +
      '<label class="check"><input type="checkbox" data-bindcheck="' + p + '.kistA"' + (S.kistA ? ' checked' : '') + '> Kirchensteuerpflichtig (ich)</label>' +
      (S.zusammen ? '<label class="check"><input type="checkbox" data-bindcheck="' + p + '.kistB"' + (S.kistB ? ' checked' : '') + '> Kirchensteuerpflichtig (Partnerin)</label>' : '') +
      '<label class="check"><input type="checkbox" data-bindcheck="' + p + '.kvMitKrankengeld"' + (S.kvMitKrankengeld ? ' checked' : '') + '> Eigene GKV mit Krankengeldanspruch</label>' +
      '<label class="f" style="max-width:360px"><span>Höchstbetrag sonstige Vorsorge ' + info('Mit Arbeitgeberzuschuss zur Krankenversicherung gilt 1.900 €, sonst 2.800 €. „Automatisch“ nimmt 1.900 €, sobald Lohn eingetragen ist.') + '</span><select data-bind="' + p + '.agZuschussKV"><option value="auto"' + (S.agZuschussKV === 'auto' ? ' selected' : '') + '>automatisch</option><option value="ja"' + (S.agZuschussKV === 'ja' ? ' selected' : '') + '>1.900 € (mit AG-Zuschuss)</option><option value="nein"' + (S.agZuschussKV === 'nein' ? ' selected' : '') + '>2.800 € (selbst getragen)</option></select></label>';
    h += gruppeKarte('st-veranlagung', 'Veranlagung', (S.zusammen ? 'Zusammen' : 'Einzeln') + ' · Kirchensteuer ' + (S.kistA ? 'ja' : 'nein'), ver);

    // Anstellung
    var lohnFelder = function (pp, LL) {
      return '<div class="fzgruppe">' + feldZeile(pp + '.brutto', LL.brutto, 'Bruttoarbeitslohn') + feldZeile(pp + '.werbungskosten', LL.werbungskosten, 'Werbungskosten', 'leer = 1.230 € Pauschbetrag') +
        feldZeile(pp + '.rvAN', LL.rvAN, 'Rentenversicherung AN') + feldZeile(pp + '.rvAG', LL.rvAG, 'Rentenversicherung AG') + feldZeile(pp + '.avAN', LL.avAN, 'Arbeitslosenversicherung AN') +
        feldZeile(pp + '.kvAN', LL.kvAN, 'Krankenversicherung AN') + feldZeile(pp + '.pvAN', LL.pvAN, 'Pflegeversicherung AN') +
        feldZeile(pp + '.lohnsteuer', LL.lohnsteuer, 'Lohnsteuer (einbehalten)') + feldZeile(pp + '.soli', LL.soli, 'Soli (einbehalten)') + feldZeile(pp + '.kist', LL.kist, 'Kirchensteuer (einbehalten)') + '</div>';
    };
    var L = S.lohn;
    h += gruppeKarte('st-anstellung', 'Anstellung ' + info('Werte aus der Lohnsteuerbescheinigung, z. B. für eine Anstellung im Jahr.'), nz(L.brutto) ? eur(L.brutto) + ' brutto · ' + eur(nz(L.lohnsteuer)) + ' Lohnsteuer' : 'keine Angaben', lohnFelder(p + '.lohn', L));
    if (S.zusammen) {
      var PB = S.partner;
      h += gruppeKarte('st-partner', 'Partnerin', eur(nz(PB.lohn.brutto) + nz(PB.gewinn) + nz(PB.sonstigeEinkuenfte)) + ' Einkünfte', lohnFelder(p + '.partner.lohn', PB.lohn) +
        '<div class="fzgruppe">' + feldZeile(p + '.partner.gewinn', PB.gewinn, 'Gewinn selbständige Arbeit') + feldZeile(p + '.partner.sonstigeEinkuenfte', PB.sonstigeEinkuenfte, 'Sonstige Einkünfte') +
        feldZeile(p + '.partner.vorsorge.pvw', PB.vorsorge.pvw, 'Eigene Altersvorsorge') + feldZeile(p + '.partner.vorsorge.kvBasis', PB.vorsorge.kvBasis, 'Eigene KV (Basis)') + feldZeile(p + '.partner.vorsorge.pvBasis', PB.vorsorge.pvBasis, 'Eigene PV') +
        feldZeile(p + '.partner.vorsorge.sonstige', PB.vorsorge.sonstige, 'Weitere Versicherungen') + feldZeile(p + '.partner.kistGezahlt', PB.kistGezahlt, 'Gezahlte Kirchensteuer') + '</div>');
    }

    // Vorauszahlungsbescheid
    var vzSum = nz(S.vz.est) + nz(S.vz.soli) + nz(S.vz.kist);
    h += gruppeKarte('st-vz', 'Vorauszahlungsbescheid ' + info('Jahressummen laut Bescheid für ' + Y + '. Fällig je ein Viertel am 10. März, Juni, September und Dezember (§ 37 EStG). Was schon bezahlt ist, liest die App aus den Buchungen.'),
      vzSum ? eur(vzSum) + ' im Jahr · ' + eur(vzSum / 4) + ' je Quartal' : 'noch nicht eingetragen',
      '<div class="fzgruppe">' + feldZeile(p + '.vz.est', S.vz.est, 'Einkommensteuer (Jahr)') + feldZeile(p + '.vz.soli', S.vz.soli, 'Soli (Jahr)') + feldZeile(p + '.vz.kist', S.vz.kist, 'Kirchensteuer (Jahr)') + '</div>');

    // Steuerzahlungen
    var stb = D.buchungen.filter(function (b) { return gruppe(b.kat) === 'steuer' && (jahrVon(b) === Y || +b.datum.slice(0, 4) === Y); })
      .sort(function (a, b) { return a.datum < b.datum ? -1 : 1; });
    if (stb.length) {
      var zl = '<div class="zahlungen">' + stb.map(function (b) {
        var sj = jahrVon(b), opts = [sj - 1, sj, sj + 1, +b.datum.slice(0, 4) - 1, +b.datum.slice(0, 4)].filter(function (x, i, a) { return a.indexOf(x) === i; }).sort();
        return '<div class="zahlung"><span><b>' + eur(-b.betrag) + '</b><small>' + datumDE(b.datum) + ' · ' + esc(katName(b.kat)) + '</small></span>' +
          '<label>für <select data-sj="' + b.id + '">' + opts.map(function (y) { return '<option' + (y === sj ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select></label></div>';
      }).join('') + '</div>';
      h += gruppeKarte('st-zahlungen', 'Steuerzahlungen ' + info('Prüfe, für welches Jahr eine Zahlung gilt, z. B. eine Nachzahlung für das Vorjahr.'), stb.length + ' Zahlungen · ' + eur(bezahlt) + ' für ' + Y, zl);
    }

    // Private Vorsorge
    var VK = [['kvpv', 'Kranken-/Pflegeversicherung'], ['pvw', 'Versorgungswerk'], ['bu', 'Berufsunfähigkeit'], ['ktg', 'Krankentagegeld'], ['vers_sonst', 'Weitere Versicherungen']];
    var vors = zliste(VK.filter(function (k) { return A.P.vorsorge[k[0]] || A.ist[k[0]]; }).map(function (k) { return [k[1], eur(A.P.vorsorge[k[0]]) + ' <small>Jahr</small>']; })) +
      '<h3>Zusätzlich, nicht über das Praxiskonto</h3><div class="fzgruppe">' + feldZeile(p + '.extra.kvpv', S.extra.kvpv, 'KV/PV (Jahr)') + feldZeile(p + '.extra.pvw', S.extra.pvw, 'Versorgungswerk (Jahr)') + feldZeile(p + '.extra.sonstige', S.extra.sonstige, 'Weitere Versicherungen (Jahr)') + '</div>';
    h += gruppeKarte('st-vorsorge', 'Vorsorge ' + info('Basis-Kranken- und Pflegeversicherung sind voll abziehbar und schöpfen den Höchstbetrag für sonstige Vorsorge (' + eur(R.hbSonst) + ') meist aus. BU, Krankentagegeld und Haftpflicht wirken dann steuerlich nicht.'),
      eur(A.vorsorgeJahr.gesamt) + ' im Jahr', vors);

    // Anlagegüter
    var afaJ = D.anlagen.reduce(function (s, a) { return s + afaFuer(a, Y); }, 0);
    var an = (D.anlagen.length ? '<div class="zahlungen">' + D.anlagen.map(function (a) {
      return '<div class="zahlung"><span><b>' + esc(a.name) + '</b><small>' + datumDE(a.datum) + ' · ' + eur(a.kosten) + ' · ' + (a.gwg ? 'GWG' : a.nd + ' Jahre') + ' · AfA ' + Y + ': ' + eur(afaFuer(a, Y)) + '</small></span><button class="btn small danger" data-act="anlage-weg" data-id="' + a.id + '" aria-label="Entfernen">×</button></div>';
    }).join('') + '</div>' : '') +
      '<div class="row" style="margin-top:10px"><label class="f"><span>Bezeichnung</span><input type="text" id="an-name"></label><label class="f"><span>Datum</span><input type="date" id="an-datum" value="' + isoHeute() + '"></label>' +
      '<label class="f"><span>Kosten brutto</span><input type="number" step="0.01" id="an-kosten"></label><label class="f"><span>Nutzungsdauer (Jahre)</span><input type="number" id="an-nd" value="3"></label></div>' +
      '<div class="btns"><button class="btn" data-act="anlage-neu">Hinzufügen</button></div>';
    h += gruppeKarte('st-anlagen', 'Anlagegüter ' + info('Über 952 € brutto (800 € netto) wird über die Nutzungsdauer abgeschrieben, darunter sofort als geringwertiges Wirtschaftsgut. Die Zahlung selbst buchst du in der Kategorie „Anschaffung“.'),
      D.anlagen.length ? D.anlagen.length + ' · AfA ' + Y + ': ' + eur(afaJ) : 'keine', an);

    // Pauschalen
    var pl = D.pauschalen.filter(function (x) { return +x.jahr === Y; });
    var pls = pl.reduce(function (s, x) { return s + nz(x.betrag); }, 0);
    h += gruppeKarte('st-pausch', 'Ausgaben ohne Kontobewegung ' + info('Z. B. Kilometerpauschale (0,30 €/km) oder Verpflegungsmehraufwand bei Fortbildungen.'), pl.length ? pl.length + ' · ' + eur(pls) : 'keine',
      (pl.length ? '<div class="zahlungen">' + pl.map(function (x) { return '<div class="zahlung"><span><b>' + eur(x.betrag) + '</b><small>' + esc(x.name) + '</small></span><button class="btn small danger" data-act="pausch-weg" data-id="' + x.id + '" aria-label="Entfernen">×</button></div>'; }).join('') + '</div>' : '') +
      '<div class="row" style="margin-top:10px"><label class="f"><span>Bezeichnung</span><input type="text" id="pa-name"></label><label class="f"><span>Betrag</span><input type="number" step="0.01" id="pa-betrag"></label></div><div class="btns"><button class="btn" data-act="pausch-neu">Hinzufügen</button></div>');
    return h;
  }

  // ---------------------------------------------------------------- Ansicht: KVN
  function viewKVN() {
    var Y = ui.jahr, zufluss = [0, 0, 0, 0];
    D.buchungen.forEach(function (b) { if (b.kat === 'kvn' && +b.datum.slice(0, 4) === Y) zufluss[Math.floor((+b.datum.slice(5, 7) - 1) / 3)] += b.betrag; });
    var sb = 0, sv = 0, ss = 0, sz = zufluss.reduce(function (s, x) { return s + x; }, 0), q, karten = '';
    var maxZ = Math.max.apply(null, zufluss.concat([1]));
    for (q = 1; q <= 4; q++) {
      var k = Y + '-Q' + q, e = D.kvn[k] || {}, netto = nz(e.brutto) - nz(e.vk) - nz(e.sonst);
      sb += nz(e.brutto); sv += nz(e.vk); ss += nz(e.sonst);
      karten += '<div class="card quartal"><div class="khead"><h2>Q' + q + '</h2><span class="muted small">Zufluss ' + eur(zufluss[q - 1]) + '</span></div>' +
        '<div class="qbar"><i style="width:' + (zufluss[q - 1] / maxZ * 100).toFixed(1) + '%"></i></div>' +
        '<div class="fzgruppe">' + feldZeile('kvn.' + k + '.brutto', e.brutto, 'Honorar laut Bescheid') + feldZeile('kvn.' + k + '.vk', e.vk, 'Verwaltungskosten') + feldZeile('kvn.' + k + '.sonst', e.sonst, 'Sonstige Abzüge') + '</div>' +
        (nz(e.brutto) ? '<p class="satz small">Netto aus dem Bescheid: <b>' + eur(netto) + '</b></p>' : '') + '</div>';
    }
    var h = '<h1>KVN ' + Y + '</h1>';
    h += '<div class="card hero">' + kopf('Zahlungseingang', 'Für die Steuer zählt, was auf dem Konto ankommt (nach Abzug der Verwaltungskosten). Die Bescheide zeigen, was du je Quartal erarbeitet hast. Abschläge und Restzahlungen eines Quartals kommen oft erst im Folgequartal oder Folgejahr.') +
      '<div class="gross">' + eur(sz) + '</div><div class="pills"><span>Bescheide brutto <b>' + eur(sb) + '</b></span><span>Verwaltungskosten <b>' + eur(sv) + '</b></span>' + (ss ? '<span>Sonstiges <b>' + eur(ss) + '</b></span>' : '') + '</div></div>';
    h += '<div class="quartale">' + karten + '</div>';
    return h;
  }

  // ---------------------------------------------------------------- Ansicht: Planung
  function viewPlanung() {
    var H = D.hochrechnung, Y = new Date().getFullYear(), A = auswertung(Y);
    var h = '<h1>Planung</h1>';
    // Hochrechnung
    var methodeInfo = { linear: 'Jede Kategorie wird mit ihrem bisherigen Verlauf aufs Jahr hochgerechnet.', sitzungen: 'KV- und Privathonorare: bisher plus verbleibende Wochen × Sitzungen × Honorar. Alles andere linear.', manuell: 'Du gibst je Kategorie den erwarteten Jahreswert ein. Leere Felder werden linear hochgerechnet.' }[H.methode];
    var hr = kopf('Hochrechnung ' + Y, methodeInfo) +
      '<div class="seg" style="margin-bottom:12px"><button data-act="set" data-path="hochrechnung.methode" data-v="linear" aria-pressed="' + (H.methode === 'linear') + '">Linear</button><button data-act="set" data-path="hochrechnung.methode" data-v="sitzungen" aria-pressed="' + (H.methode === 'sitzungen') + '">Sitzungen</button><button data-act="set" data-path="hochrechnung.methode" data-v="manuell" aria-pressed="' + (H.methode === 'manuell') + '">Planwerte</button></div>' +
      '<div class="pills"><span>Gewinn <b>' + eur(A.P.gewinn) + '</b></span><span>Steuern <b>' + eur(A.R.gesamt) + '</b></span><span>bleibt <b>' + eur(A.verfuegbar / 12) + '</b>/Monat</span></div>';
    if (H.methode === 'sitzungen') {
      hr += '<div class="fzgruppe">' + feldZeile('hochrechnung.kvnSitz', H.kvnSitz, 'KV: Sitzungen/Woche') + feldZeile('hochrechnung.kvnHon', H.kvnHon, 'KV: Honorar je Sitzung') +
        feldZeile('hochrechnung.privSitz', H.privSitz, 'Privat: Sitzungen/Woche') + feldZeile('hochrechnung.privHon', H.privHon, 'Privat: Honorar je Sitzung') + feldZeile('hochrechnung.urlaubRest', H.urlaubRest, 'Urlaubswochen bis Jahresende') + '</div>';
    }
    if (H.methode === 'manuell') {
      ['praxis_ein', 'praxis_aus', 'praxis_inv', 'vorsorge'].forEach(function (g) {
        var gname = GRUPPEN.filter(function (x) { return x.id === g; })[0].name;
        var felder = katsIn(g).map(function (k) {
          var i = A.ist[k.id] || 0, lin = A.t > 0.04 ? i / A.t : i, mv = (H.manuell[Y] || {})[k.id];
          return '<label class="fz"><span>' + wbr(esc(k.name)) + '<small>bisher ' + eur(Math.abs(i)) + ' · linear ' + eur(Math.abs(lin)) + '</small></span><input type="number" step="1" inputmode="decimal" data-bind="hochrechnung.manuell.' + Y + '.' + k.id + '" value="' + (mv === 0 || mv ? mv : '') + '" placeholder="≈ ' + Math.round(Math.abs(lin)).toLocaleString('de-DE') + '"></label>';
        }).join('');
        hr += '<details class="mehr innen" data-auf="hm-' + g + '"' + (ui.offen['hm-' + g] ? ' open' : '') + '><summary><span>' + esc(gname) + '</span></summary><div class="mehrinhalt"><div class="fzgruppe">' + felder + '</div></div></details>';
      });
    }
    h += '<div class="card">' + hr + '</div>';

    // Szenarien: Diagramm oben, dann ein Jahr nach dem anderen bearbeiten
    if (!D.szenarien.length) { D.szenarien.push(szNeu('Basis')); save(true); }
    if (!ui.szId || !D.szenarien.some(function (s) { return s.id === ui.szId; })) ui.szId = D.szenarien[0].id;
    var sz = D.szenarien.filter(function (s) { return s.id === ui.szId; })[0];
    var ys = Object.keys(sz.jahre).map(Number).sort(), idx = D.szenarien.indexOf(sz), sp = 'szenarien.' + idx;
    if (!ui.szJahr || ys.indexOf(ui.szJahr) < 0) ui.szJahr = ys[0];
    var jy = ui.szJahr, erg = szRechne(sz, jy);
    var alleJahre = {}; D.szenarien.forEach(function (s) { Object.keys(s.jahre).forEach(function (y) { alleJahre[y] = 1; }); });
    var jl = Object.keys(alleJahre).map(Number).sort();
    var serien = D.szenarien.slice(0, 4).map(function (s) { return { name: s.name, werte: jl.map(function (y) { return s.jahre[y] ? szRechne(s, y).verfuegbar / 12 : 0; }) }; });
    var leer = erg.umsatz === 0;
    h += '<div class="card">' + kopf('Szenarien', '„Bleibt pro Monat“ = Einnahmen − Betriebsausgaben − Anschaffungen − Steuern − private Vorsorge (bei Zusammenveranlagung mit Partnerin). Der Tarif ab 2027 wird mit ' + pct(D.settings.inflation) + ' p. a. fortgeschrieben (Einstellungen).') +
      '<div class="row" style="align-items:flex-end"><label class="f" style="max-width:260px"><span>Szenario</span><select id="sz-wahl">' + D.szenarien.map(function (s) { return '<option value="' + s.id + '"' + (s.id === sz.id ? ' selected' : '') + '>' + esc(s.name) + '</option>'; }).join('') + '</select></label></div>' +
      (leer ? '<div class="note">Dieses Jahr ist noch leer. <a href="#" data-act="sz-prognose">Aus der Hochrechnung ' + Y + ' füllen</a> – danach musst du nur noch anpassen.</div>' : '') +
      '<p class="muted small" style="margin:4px 0 0">Bleibt pro Monat</p>' + linienChart(serien, jl) +
      '<div class="jahrchips">' + ys.map(function (y) { var e2 = szRechne(sz, y); return '<button data-act="sz-jahr" data-y="' + y + '" aria-pressed="' + (y === jy) + '"><span>' + y + '</span><b>' + eur(e2.verfuegbar / 12) + '</b></button>'; }).join('') + '</div></div>';

    // Gewähltes Jahr
    var gruppenF = [], cur = null;
    SZ_FELDER.forEach(function (f) { if (f.grp) { cur = { n: f.grp, f: [] }; gruppenF.push(cur); } else cur.f.push(f); });
    h += '<div class="card hero">' + kopf(sz.name + ' · ' + jy) +
      '<div class="gross mittel">' + eur(erg.verfuegbar / 12) + ' <small>bleiben pro Monat</small></div>' +
      '<div class="pills"><span>Umsatz <b>' + eur(erg.umsatz) + '</b></span><span>Gewinn <b>' + eur(erg.gewinn) + '</b></span><span>Steuern <b>' + eur(erg.R.gesamt) + '</b></span><span>Ø <b>' + pct(erg.R.durchschnitt, 0) + '</b></span></div></div>';
    gruppenF.forEach(function (g, gi) {
      var felder = g.f.map(function (f) { return feldZeile(sp + '.jahre.' + jy + '.' + f.k, nz(sz.jahre[jy][f.k]), f.n); }).join('');
      var zus = gi === 0 ? eur(erg.umsatz) + ' Umsatz' : gi === 1 ? eur(nz(sz.jahre[jy].kvpv) + nz(sz.jahre[jy].pvw) + nz(sz.jahre[jy].versich)) + ' im Jahr' : (nz(sz.jahre[jy].zusammen) === 1 ? 'zusammen' : 'einzeln') + ' · KiSt ' + (nz(sz.jahre[jy].kist) === 1 ? 'ja' : 'nein');
      h += gruppeKarte('sz-g' + gi, g.n, zus, '<div class="fzgruppe">' + felder + '</div>');
    });
    // Verwalten
    h += gruppeKarte('sz-verwalten', 'Szenario verwalten', 'Name, Fortschreibung, Jahre',
      '<label class="f" style="max-width:300px"><span>Name</span><input type="text" data-bindtext="' + sp + '.name" value="' + esc(sz.name) + '"></label>' +
      '<div class="fzgruppe">' + '<label class="fz"><span>Honorare/Einnahmen % p. a.</span><input type="number" step="0.1" data-bindpct="' + sp + '.wachstum.h" value="' + (sz.wachstum.h * 100) + '"></label>' +
      '<label class="fz"><span>Praxiskosten % p. a.</span><input type="number" step="0.1" data-bindpct="' + sp + '.wachstum.k" value="' + (sz.wachstum.k * 100) + '"></label>' +
      '<label class="fz"><span>Vorsorge % p. a.</span><input type="number" step="0.1" data-bindpct="' + sp + '.wachstum.v" value="' + (sz.wachstum.v * 100) + '"></label></div>' +
      '<div class="btns"><button class="btn" data-act="sz-prognose">Aus Hochrechnung ' + Y + ' füllen und fortschreiben</button><button class="btn" data-act="sz-fort">Werte aus ' + ys[0] + ' fortschreiben</button></div>' +
      '<div class="btns"><button class="btn" data-act="sz-neu">Neues Szenario</button><button class="btn" data-act="sz-kopie">Duplizieren</button><button class="btn" data-act="sz-jahr-plus">Jahr anhängen</button><button class="btn" data-act="sz-jahr-minus"' + (ys.length < 2 ? ' disabled' : '') + '>Letztes Jahr entfernen</button><button class="btn danger" data-act="sz-weg">Löschen</button></div>');
    return h;
  }

  // ---------------------------------------------------------------- Ansicht: Einstellungen
  function viewDaten() {
    var h = '<h1>Einstellungen</h1>';
    h += gruppeKarte('e-leiste', 'Leiste anpassen', sichtbareBereiche().map(function (id) { return BEREICH_NAME[id]; }).join(' · '), anpassenListe('nav'));
    var ks = kartenOrdnung();
    h += gruppeKarte('e-karten', 'Übersicht anpassen', (ks.order.length - ks.aus.length) + ' von ' + ks.order.length + ' Karten sichtbar', anpassenListe('karten'));

    // Daten und Sicherung
    var dat = '';
    if (hatFS) {
      if (fileHandle) {
        dat += '<p>Verbunden mit <b>' + esc(fileHandle.name) + '</b> · ' + (dateiStatus === 'verbunden' ? 'speichert automatisch.' : 'Zugriff erneut erlauben.') + '</p>' +
          '<div class="btns">' + (dateiStatus !== 'verbunden' ? '<button class="btn primary" data-act="datei-erlauben">Zugriff erlauben</button>' : '<button class="btn" data-act="datei-jetzt">Jetzt speichern</button>') +
          '<button class="btn" data-act="datei-oeffnen">Andere Datei öffnen</button><button class="btn" data-act="datei-trennen">Trennen</button></div>';
      } else {
        dat += '<p>Optional: Die App schreibt jede Änderung in eine JSON-Datei, z. B. in einem Sync-Ordner.</p><div class="btns"><button class="btn primary" data-act="datei-neu">Datendatei anlegen</button><button class="btn" data-act="datei-oeffnen">Vorhandene öffnen</button></div>';
      }
    }
    dat += '<div class="btns"><button class="btn" data-act="export-json">Sicherung herunterladen</button><button class="btn" data-act="import-json">Sicherung einlesen</button><button class="btn" data-act="csv">Kontoumsätze importieren</button></div>' +
      '<p class="muted small">Stand ' + new Date(D.meta.geaendert).toLocaleString('de-DE') + ' · ' + D.buchungen.length + ' Buchungen · Alle Daten bleiben auf diesem Gerät.</p>';
    h += gruppeKarte('e-daten', 'Daten und Sicherung ' + info('Abgleich Handy ↔ Notebook: Sicherung auf dem einen Gerät herunterladen und auf dem anderen einlesen. Einlesen ersetzt den Stand vollständig.'), fileHandle ? 'Datei ' + esc(fileHandle.name) : 'im Browser gespeichert', dat);

    h += gruppeKarte('e-app', 'Als App nutzen', istApp() ? 'installiert ✓' : 'im Browser', installKarte().replace(/^<div class="card"><h2>Als App nutzen<\/h2>/, '').replace(/<\/div>$/, ''));

    // Regeln kompakt mit Suche
    var q = (ui.regelSuche || '').toLowerCase();
    var feldName = { iban: 'IBAN', name: 'Name', text: 'Zweck', art: 'Art', alle: 'Alles' };
    var treffer = D.regeln.map(function (r, i) { return { r: r, i: i }; }).filter(function (x) { return !q || (x.r.muster + ' ' + katName(x.r.kat)).toLowerCase().indexOf(q) >= 0; });
    var zeig = ui.regelAlle ? treffer : treffer.slice(0, 25);
    var rg = '<input type="text" id="rg-suche" placeholder="Regeln durchsuchen" value="' + esc(ui.regelSuche || '') + '">' +
      '<div class="regeln">' + zeig.map(function (x) {
        return '<div class="regel"><span class="rmuster"><small>' + feldName[x.r.feld] + '</small>' + esc(String(x.r.muster).split('\n')[0]) + '</span><span class="rkat">→ ' + esc(katName(x.r.kat)) + '</span>' +
          (x.i ? '<button class="btn small" data-act="regel-hoch" data-i="' + x.i + '" aria-label="nach oben">↑</button>' : '<span></span>') +
          '<button class="btn small danger" data-act="regel-weg" data-i="' + x.i + '" aria-label="Entfernen">×</button></div>';
      }).join('') + '</div>' +
      (treffer.length > zeig.length ? '<button class="btn small" data-act="regeln-zeigen">Alle ' + treffer.length + ' zeigen</button>' : '') +
      '<h3>Neue Regel</h3><div class="row"><label class="f"><span>Feld</span><select id="rg-feld"><option value="name">Name</option><option value="iban">IBAN</option><option value="text">Verwendungszweck</option><option value="art">Buchungsart</option><option value="alle">Name, Zweck oder Art</option></select></label>' +
      '<label class="f"><span>enthält</span><input type="text" id="rg-muster"></label><label class="f"><span>Kategorie</span><select id="rg-kat">' + katOptions('', false) + '</select></label></div>' +
      '<div class="btns"><button class="btn" data-act="regel-neu">Regel hinzufügen</button><button class="btn" data-act="regeln-alle">Auf alle Buchungen anwenden</button></div>';
    h += gruppeKarte('e-regeln', 'Regeln ' + info('Die erste passende Regel gilt. IBAN: exakter Vergleich, sonst „enthält den Text“. Regeln entstehen auch beim Zuordnen und Importieren.'), D.regeln.length + ' Regeln', rg);

    h += gruppeKarte('e-annahmen', 'Annahmen', 'Inflation ' + pct(D.settings.inflation) + ' · KiSt ' + pct(D.settings.kistSatz, 0),
      '<div class="fzgruppe"><label class="fz"><span>Inflation / Tarif-Fortschreibung % p. a.</span><input type="number" step="0.1" data-bindpct="settings.inflation" value="' + D.settings.inflation * 100 + '"></label>' +
      '<label class="fz"><span>Kirchensteuersatz %</span><input type="number" step="1" data-bindpct="settings.kistSatz" value="' + D.settings.kistSatz * 100 + '"></label></div>' +
      '<p class="muted small">Steuerparameter 2026: Grundfreibetrag 12.348 €, Soli-Freigrenze 20.350 €, Höchstbetrag Altersvorsorge 30.826 €. Version ' + APP_VERSION + '.</p>');

    h += gruppeKarte('e-loeschen', 'Löschen', '',
      '<p class="muted small">„Alle Buchungen löschen“ behält Regeln, Steuerangaben, KVN und Planung – ein neuer Import ordnet dann wieder zu. Einzelne Buchungen löschst du unter Buchungen → Auswählen.</p>' +
      '<div class="btns"><button class="btn danger" data-act="loeschen-alle"' + (D.buchungen.length ? '' : ' disabled') + '>Alle Buchungen löschen (' + D.buchungen.length + ')</button><button class="btn danger" data-act="reset">Alle Daten in diesem Browser löschen</button></div>');
    return h;
  }

  var VIEWS = { uebersicht: viewUebersicht, buchungen: viewBuchungen, steuer: viewSteuer, kvn: viewKVN, planung: viewPlanung, daten: viewDaten };

  // ---------------------------------------------------------------- Zuordnen: eine Buchung nach der anderen
  var ritual = null;
  function nameKey(b) { return String(b.gegenpartei || '').trim().toLowerCase(); }
  function vorschlaege(b) {
    var zaehl = {}, add = function (k, w) { if (k) zaehl[k] = (zaehl[k] || 0) + w; };
    var nk = nameKey(b), ib = normIBAN(b.iban);
    D.buchungen.forEach(function (x) {
      if (!x.kat || x === b) return;
      if (nk && nameKey(x) === nk) add(x.kat, 100);
      else if (ib && normIBAN(x.iban) === ib) add(x.kat, 80);
      else if ((x.betrag > 0) === (b.betrag > 0)) add(x.kat, 1);
    });
    var liste = Object.keys(zaehl).sort(function (a, c) { return zaehl[c] - zaehl[a]; });
    // Fallback: passende Gruppe nach Vorzeichen
    (b.betrag > 0 ? ['kvn', 'privat', 'sonst_be', 'privat_ein'] : ['sonst_ba', 'buero', 'fortbildung', 'privat_aus']).forEach(function (k) { if (liste.indexOf(k) < 0) liste.push(k); });
    return liste.slice(0, 4);
  }
  function ritualStart() {
    var ids = D.buchungen.filter(function (b) { return !b.kat; })
      .sort(function (a, b) { return a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0; }).map(function (b) { return b.id; });
    if (!ids.length) { toast('Alles zugeordnet ✓'); return; }
    ritual = { ids: ids, pos: 0, erledigt: 0, regeln: 0, skip: 0, undo: null, start: ids.length };
    var dlg = $('#dlg'); dlg.className = 'ritual';
    ritualZeigen();
    dlg.showModal();
    dlg.onclose = function () { ritual = null; render(); };
  }
  function ritualAktuell() {
    while (ritual.pos < ritual.ids.length) {
      var b = D.buchungen.filter(function (x) { return x.id === ritual.ids[ritual.pos]; })[0];
      if (b && !b.kat) return b;
      ritual.pos++;
    }
    return null;
  }
  function ritualZeigen(richtung) {
    var dlg = $('#dlg'), b = ritualAktuell();
    var fertig = ritual.ids.length, n = Math.min(ritual.pos + 1, fertig);
    var kopf = '<div class="rkopf"><div class="rbar"><i style="width:' + (ritual.pos / Math.max(1, fertig) * 100).toFixed(1) + '%"></i></div>' +
      '<span class="muted small">' + (b ? n + ' von ' + fertig : 'Fertig') + '</span><button class="x" data-act="r-zu" aria-label="Schließen">×</button></div>';
    if (!b) {
      var offen = D.buchungen.filter(function (x) { return !x.kat; }).length;
      dlg.innerHTML = kopf + '<div class="rende"><div class="rhaken">✓</div><h2>' + (offen ? 'Für heute erledigt' : 'Alles erledigt') + '</h2>' +
        '<p>' + ritual.erledigt + ' Buchung' + (ritual.erledigt === 1 ? '' : 'en') + ' zugeordnet' + (ritual.regeln ? ' · ' + ritual.regeln + ' Regel' + (ritual.regeln === 1 ? '' : 'n') + ' gelernt – beim nächsten Import geht es schneller' : '') + '.</p>' +
        (offen ? '<p class="muted small">' + offen + ' übersprungen – die warten auf ein andermal.</p>' : '') +
        '<div class="btns" style="justify-content:center">' + (offen ? '<button class="btn" data-act="r-nochmal">Übersprungene ansehen</button>' : '') + '<button class="btn primary" data-act="r-zu">Fertig</button></div></div>';
      return;
    }
    var vs = vorschlaege(b), nk = nameKey(b);
    var weitere = nk ? D.buchungen.filter(function (x) { return !x.kat && x !== b && nameKey(x) === nk; }).length : 0;
    var hist = nk ? D.buchungen.filter(function (x) { return x.kat && nameKey(x) === nk; }) : [];
    var eindeutig = hist.every(function (x) { return x.kat === (hist[0] || {}).kat; });
    var regelDa = !!regelFuer(b);
    dlg.innerHTML = kopf +
      '<div class="rkarte' + (richtung ? ' rein-' + richtung : '') + '" id="rkarte">' +
      '<div class="rmeta">' + datumDE(b.datum) + (b.art ? ' · ' + esc(b.art) : '') + '</div>' +
      '<div class="rbetrag ' + (b.betrag < 0 ? 'neg' : 'pos') + '">' + eur(b.betrag, 2) + '</div>' +
      '<div class="rname">' + esc(b.gegenpartei || 'Ohne Namen') + '</div>' +
      '<div class="rtext">' + esc(b.text || '') + '</div></div>' +
      '<div class="rfrage">Wohin gehört das?</div>' +
      '<div class="chips">' + vs.map(function (k, i) { return '<button class="chip" data-act="r-kat" data-k="' + k + '"><span class="kbd">' + (i + 1) + '</span>' + esc(katName(k)) + '</button>'; }).join('') + '</div>' +
      '<select id="r-andere" aria-label="Andere Kategorie">' + '<option value="">Andere Kategorie …</option>' + katOptions('', false) + '</select>' +
      (nk && !regelDa ? '<label class="chk"><input type="checkbox" id="r-regel"' + (eindeutig ? ' checked' : '') + '> Künftig „' + esc(b.gegenpartei) + '“ automatisch so zuordnen</label>' : '') +
      (weitere ? '<label class="chk"><input type="checkbox" id="r-alle" checked> Auch die ' + weitere + ' weitere' + (weitere === 1 ? '' : 'n') + ' offene' + (weitere === 1 ? '' : 'n') + ' Buchung' + (weitere === 1 ? '' : 'en') + ' von „' + esc(b.gegenpartei) + '“</label>' : '') +
      '<div class="rfuss">' + (ritual.undo ? '<button class="btn small" data-act="r-undo">↶ Rückgängig</button>' : '<span></span>') +
      '<button class="btn small" data-act="r-skip">Überspringen →</button></div>' +
      '<p class="muted small rtipp">Tipp: Karte nach links wischen = überspringen' + (schmal() ? '' : ' · Tasten 1–4 wählen') + '</p>';
    var karte = $('#rkarte');
    var x0 = null, dx = 0;
    karte.addEventListener('pointerdown', function (e) { x0 = e.clientX; dx = 0; karte.setPointerCapture(e.pointerId); });
    karte.addEventListener('pointermove', function (e) { if (x0 === null) return; dx = e.clientX - x0; if (dx < 0) karte.style.transform = 'translateX(' + dx + 'px) rotate(' + (dx / 40) + 'deg)'; });
    var ende = function () { if (x0 === null) return; x0 = null; if (dx < -90) ritualWeiter('skip'); else karte.style.transform = ''; };
    karte.addEventListener('pointerup', ende); karte.addEventListener('pointercancel', ende);
  }
  function ritualZuordnen(k) {
    var b = ritualAktuell(); if (!b || !k) return;
    var mitAlle = $('#r-alle') && $('#r-alle').checked, mitRegel = $('#r-regel') && $('#r-regel').checked;
    var betroffen = [b];
    if (mitAlle) D.buchungen.forEach(function (x) { if (!x.kat && x !== b && nameKey(x) === nameKey(b)) betroffen.push(x); });
    betroffen.forEach(function (x) { x.kat = k; });
    var regelId = null;
    if (mitRegel) { regelId = uid(); D.regeln.push({ id: regelId, feld: 'name', muster: String(b.gegenpartei).trim(), kat: k }); ritual.regeln++; }
    ritual.undo = { ids: betroffen.map(function (x) { return x.id; }), regelId: regelId, pos: ritual.pos };
    ritual.erledigt += betroffen.length;
    save();
    ritualWeiter('ok');
  }
  function ritualWeiter(art) {
    var karte = $('#rkarte');
    var weiter = function () { ritual.pos++; ritualZeigen('rechts'); };
    if (karte && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      karte.classList.add(art === 'skip' ? 'raus-links' : 'raus-oben');
      setTimeout(weiter, 180);
    } else weiter();
  }
  function ritualRueckgaengig() {
    var u = ritual.undo; if (!u) return;
    D.buchungen.forEach(function (x) { if (u.ids.indexOf(x.id) >= 0) x.kat = ''; });
    if (u.regelId) { D.regeln = D.regeln.filter(function (r) { return r.id !== u.regelId; }); ritual.regeln--; }
    ritual.erledigt -= u.ids.length;
    ritual.pos = u.pos; ritual.undo = null;
    save(); ritualZeigen('links');
  }
  document.addEventListener('keydown', function (e) {
    if (!ritual || !$('#dlg').open || /input|select|textarea/i.test((e.target || {}).tagName)) return;
    var chips = $$('#dlg .chip');
    if (/^[1-4]$/.test(e.key) && chips[+e.key - 1]) { e.preventDefault(); ritualZuordnen(chips[+e.key - 1].dataset.k); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); ritualWeiter('skip'); }
  });

  // ---------------------------------------------------------------- Installation als App
  var installEvt = null;
  function istApp() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true; }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; if (ui.tab === 'uebersicht' || ui.tab === 'daten') render(); });
  window.addEventListener('appinstalled', function () { installEvt = null; toast('Installiert. Öffne den Finanzkompass künftig über sein App-Symbol.'); render(); });
  function installieren() {
    if (!installEvt) { toast('Chrome-Menü ⋮ → „App installieren“'); return; }
    installEvt.prompt();
    installEvt.userChoice.then(function () { installEvt = null; render(); }).catch(function () {});
  }
  function installKarte() {
    var h = '<div class="card"><h2>Als App nutzen</h2>';
    if (istApp()) return h + '<p><span class="haken">✓</span> Läuft als installierte App.</p></div>';
    if (installEvt) return h + '<p>Installiert startet der Finanzkompass ohne Adressleiste, mit eigenem Symbol und offline.</p><div class="btns"><button class="btn primary" data-act="installieren">App installieren</button></div></div>';
    return h + '<p>Du nutzt den Finanzkompass gerade im Browser.</p><ol class="small"><li>Chrome-Menü ⋮ → <b>„App installieren“</b> (nicht „Verknüpfung erstellen“ – die öffnet nur einen Browser-Tab).</li>' +
      '<li>Danach immer über das <b>App-Symbol</b> starten.</li><li>Meldet Chrome „bereits installiert“, die App aber startet nicht: in den Android-Einstellungen unter Apps „Finanzkompass“ deinstallieren und neu installieren. Vorher hier eine Datensicherung herunterladen.</li></ol></div>';
  }

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
    if (tab && $('#dlg').open && $('#dlg').contains(tab)) $('#dlg').close();
    if (tab) { zuSeite(tab.dataset.tab); return; }
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
      case 'mehr-blatt': mehrBlatt(); break;
      case 'anpassen': anpassenDialog(a.dataset.was); break;
      case 'anp-hoch': anpassenAendern(a.dataset.was, a.dataset.id, 'hoch'); break;
      case 'anp-runter': anpassenAendern(a.dataset.was, a.dataset.id, 'runter'); break;
      case 'wohin': ui.wohin = a.dataset.v; render(); break;
      case 'zeige-kat': ui.filter.kat = a.dataset.k; ui.filter.monat = ''; ui.filter.suche = ''; ui.scroll.buchungen = 0; ui.tab = 'buchungen'; history.replaceState(null, '', '#buchungen'); render(); window.scrollTo(0, 0); break;
      case 'sz-jahr': ui.szJahr = +a.dataset.y; render(); break;
      case 'regeln-zeigen': ui.regelAlle = true; render(); break;
      case 'ritual': ritualStart(); break;
      case 'r-kat': ritualZuordnen(a.dataset.k); break;
      case 'r-skip': ritualWeiter('skip'); break;
      case 'r-undo': ritualRueckgaengig(); break;
      case 'r-zu': $('#dlg').close(); break;
      case 'r-nochmal': { $('#dlg').close(); setTimeout(ritualStart, 50); break; }
      case 'installieren': installieren(); break;
      case 'install-weg': { try { localStorage.setItem('fk.installHinweis', 'weg'); } catch (e2) { /* ignorieren */ } render(); break; }
      case 'wenn-null': ui.wenn = { sitz: 0, urlaub: 0, ausg: 0 }; render(); break;
      case 'auswahl-an': ui.auswahl = {}; render(); break;
      case 'auswahl-aus': ui.auswahl = null; render(); break;
      case 'auswahl-keine': ui.auswahl = {}; render(); break;
      case 'auswahl-alle': buchungenGefiltert().forEach(function (b) { ui.auswahl[b.id] = true; }); render(); break;
      case 'waehle': {
        if (!ui.auswahl) break;
        if (ui.auswahl[a.dataset.id]) delete ui.auswahl[a.dataset.id]; else ui.auswahl[a.dataset.id] = true;
        render(); break;
      }
      case 'auswahl-loeschen': {
        var sel = buchungenGefiltert().filter(function (b) { return ui.auswahl && ui.auswahl[b.id]; });
        if (!sel.length) break;
        if (!confirm(sel.length + ' ausgewählte Buchungen löschen?')) break;
        var selIds = {}; sel.forEach(function (b) { selIds[b.id] = 1; });
        D.buchungen = D.buchungen.filter(function (b) { return !selIds[b.id]; });
        ui.auswahl = {}; save(); toast(sel.length + ' Buchungen gelöscht'); break;
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
    if (el.dataset.anp) { anpassenAendern(el.dataset.anp, el.dataset.id, 'an', el.checked); return; }
    if (el.id === 'r-andere') { if (el.value) ritualZuordnen(el.value); return; }
    if (el.id === 'r-regel' || el.id === 'r-alle' || el.dataset.wenn) return;
    if (el.id === 'auswahl-kat' && el.value && ui.auswahl) {
      var gw = buchungenGefiltert().filter(function (b) { return ui.auswahl[b.id]; });
      gw.forEach(function (b) { b.kat = el.value; });
      save(); toast(gw.length + ' Buchungen → ' + katName(el.value)); return;
    }
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
    if (e.target.dataset && e.target.dataset.wenn) {
      var k = e.target.dataset.wenn; ui.wenn[k] = +e.target.value;
      var o = document.getElementById('wenn-' + k); if (o) o.textContent = wennLabel(k, ui.wenn[k]);
      var erg = $('#wenn-erg'); if (erg) erg.innerHTML = wennErgebnis(auswertung(ui.jahr));
      return;
    }
    if (e.target.id === 'rg-suche') {
      ui.regelSuche = e.target.value; clearTimeout(document.__rgT);
      document.__rgT = setTimeout(function () { var pos = e.target.selectionStart; render(); var f = $('#rg-suche'); if (f) { f.focus(); f.setSelectionRange(pos, pos); } }, 250);
      return;
    }
    if (e.target.id === 'f-suche') {
      ui.filter.suche = e.target.value; ui.filter.limit = 200;
      clearTimeout(document.__suchT);
      document.__suchT = setTimeout(function () {
        var pos = e.target.selectionStart; render();
        var f = $('#f-suche'); if (f) { f.focus(); f.setSelectionRange(pos, pos); }
      }, 250);
    }
  });
  document.addEventListener('toggle', function (e) {
    var d = e.target; if (d && d.dataset && d.dataset.auf) ui.offen[d.dataset.auf] = d.open;
  }, true);
  window.addEventListener('hashchange', function () {
    var t = location.hash.replace('#', '');
    if (VIEWS[t] && t !== ui.tab) { ui.tab = t; render(); }
  });

  // ---------------------------------------------------------------- Start
  render();
  if (/[?&]aktion=zuordnen/.test(location.search)) { history.replaceState(null, '', location.pathname + location.hash); setTimeout(ritualStart, 300); }
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
    // Updates zuverlässig übernehmen: beim Zurückkehren in die App nach neuer Version fragen,
    // und sobald der neue Service Worker aktiv ist, neu laden (bei offenem Dialog nur Hinweis).
    var hatteSW = !!navigator.serviceWorker.controller, neuGeladen = false;
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') reg.update().catch(function () {}); });
    }).catch(function () {});
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hatteSW) { hatteSW = true; return; }
      if (neuGeladen) return;
      if ($('#dlg').open) { toast('Neue Version verfügbar', 'Neu laden', function () { location.reload(); }); return; }
      neuGeladen = true; location.reload();
    });
  }
  // Test-Haken (nur für automatisierte Prüfung)
  window.__fk = { auswertung: auswertung, parseBetrag: parseBetrag, parseDatum: parseDatum, splitCSV: splitCSV, szRechne: szRechne, data: function () { return D; } };
})();
