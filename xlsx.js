/* Finanzkompass – schlanker Leser für Excel-Dateien (.xlsx) ohne Fremdbibliothek.
 * Entpackt die ZIP-Struktur mit DecompressionStream und liest Tabellenblätter als Zeilen-Arrays.
 * Datumszellen werden als ISO-Datum (JJJJ-MM-TT) geliefert, Zahlen als Zahl, Text als Text.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.XLSX = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function u16(dv, o) { return dv.getUint16(o, true); }
  function u32(dv, o) { return dv.getUint32(o, true); }

  function inflateRaw(bytes) {
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(stream).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }

  // ZIP-Verzeichnis lesen → { name: Promise<Uint8Array> }
  function entpacke(buffer) {
    var dv = new DataView(buffer), bytes = new Uint8Array(buffer);
    var eocd = -1;
    for (var i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (u32(dv, i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Keine gültige Excel-Datei (ZIP-Verzeichnis fehlt)');
    var anzahl = u16(dv, eocd + 10), pos = u32(dv, eocd + 16);
    var dec = new TextDecoder('utf-8'), dateien = {};
    for (var n = 0; n < anzahl; n++) {
      if (u32(dv, pos) !== 0x02014b50) throw new Error('Beschädigtes ZIP-Verzeichnis');
      var methode = u16(dv, pos + 10), groesse = u32(dv, pos + 20);
      var nl = u16(dv, pos + 28), el = u16(dv, pos + 30), cl = u16(dv, pos + 32), lokal = u32(dv, pos + 42);
      var name = dec.decode(bytes.subarray(pos + 46, pos + 46 + nl));
      var start = lokal + 30 + u16(dv, lokal + 26) + u16(dv, lokal + 28);
      dateien[name] = { methode: methode, daten: bytes.subarray(start, start + groesse) };
      pos += 46 + nl + el + cl;
    }
    return {
      namen: Object.keys(dateien),
      text: function (name) {
        var d = dateien[name];
        if (!d) return Promise.resolve(null);
        var p = d.methode === 0 ? Promise.resolve(d.daten) : d.methode === 8 ? inflateRaw(d.daten) : Promise.reject(new Error('Komprimierung ' + d.methode + ' nicht unterstützt'));
        return p.then(function (b) { return dec.decode(b); });
      }
    };
  }

  function entities(s) {
    return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, function (m, e) {
      if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
      return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e.toLowerCase()];
    });
  }
  function attr(tag, name) {
    var m = tag.match(new RegExp('\\s' + name + '="([^"]*)"'));
    return m ? entities(m[1]) : null;
  }
  // Text eines <si>- oder <is>-Elements (Rich Text zusammenfügen, Lautschrift ignorieren)
  function textAus(xml) {
    xml = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
    var out = '', re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g, m;
    while ((m = re.exec(xml))) out += entities(m[1]);
    return out;
  }

  var DATUM_FORMATE = { 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 19: 1, 20: 1, 21: 1, 22: 1, 45: 1, 46: 1, 47: 1 };
  function istDatumsformat(code) {
    if (!code) return false;
    var c = code.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').toLowerCase();
    return /[dmy]/.test(c) && !/^[#0.,\s]*$/.test(c);
  }
  function datumsStile(stylesXml) {
    if (!stylesXml) return [];
    var eigene = {}, re = /<numFmt\b[^>]*>/g, m;
    while ((m = re.exec(stylesXml))) eigene[attr(m[0], 'numFmtId')] = attr(m[0], 'formatCode');
    var xfs = (stylesXml.match(/<cellXfs\b[\s\S]*?<\/cellXfs>/) || [''])[0];
    var stile = [], rx = /<xf\b[^>]*>/g;
    while ((m = rx.exec(xfs))) {
      var id = +attr(m[0], 'numFmtId');
      stile.push(!!DATUM_FORMATE[id] || istDatumsformat(eigene[id]));
    }
    return stile;
  }
  function serienDatum(n) {
    // Excel-Seriennummer (1900-System) → JJJJ-MM-TT
    var ms = Math.round((n - 25569) * 864e5);
    var d = new Date(ms);
    var p = function (x) { return (x < 10 ? '0' : '') + x; };
    return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
  }
  function spalteAusRef(ref) {
    var m = /^([A-Z]+)/.exec(ref || ''), n = 0;
    if (!m) return -1;
    for (var i = 0; i < m[1].length; i++) n = n * 26 + (m[1].charCodeAt(i) - 64);
    return n - 1;
  }

  function blattLesen(xml, shared, stile) {
    var zeilen = [], rr = /<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g, rm;
    while ((rm = rr.exec(xml))) {
      var inhalt = rm[1] || '', zeile = [], rc = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, cm, auto = 0;
      while ((cm = rc.exec(inhalt))) {
        var kopf = '<c' + cm[1] + '>', innen = cm[2] || '';
        var ref = attr(kopf, 'r'), typ = attr(kopf, 't') || 'n', stil = +(attr(kopf, 's') || 0);
        var col = ref ? spalteAusRef(ref) : auto;
        auto = col + 1;
        var vm = /<v>([\s\S]*?)<\/v>/.exec(innen), v = vm ? entities(vm[1]) : null, wert = null;
        if (typ === 's') wert = v != null ? shared[+v] : null;
        else if (typ === 'inlineStr') wert = textAus(innen);
        else if (typ === 'str' || typ === 'e') wert = v;
        else if (typ === 'b') wert = v === '1';
        else if (typ === 'd') wert = v ? v.slice(0, 10) : null;
        else if (v != null && v !== '') {
          var num = Number(v);
          wert = stile[stil] && num > 0 && num < 2958466 ? serienDatum(num) : num;
        }
        zeile[col] = wert;
      }
      for (var i = 0; i < zeile.length; i++) if (zeile[i] === undefined) zeile[i] = null;
      if (zeile.some(function (x) { return x !== null && x !== ''; })) zeilen.push(zeile);
    }
    return zeilen;
  }

  // Liest alle Tabellenblätter → Promise<[{ name, zeilen: [[...], ...] }]>
  function lesen(buffer) {
    var zip;
    try { zip = entpacke(buffer); } catch (e) { return Promise.reject(e); }
    return Promise.all([zip.text('xl/workbook.xml'), zip.text('xl/_rels/workbook.xml.rels'), zip.text('xl/sharedStrings.xml'), zip.text('xl/styles.xml')])
      .then(function (r) {
        var wb = r[0], rels = r[1] || '', ssXml = r[2], stXml = r[3];
        if (!wb) throw new Error('Keine Excel-Arbeitsmappe gefunden (.xls im alten Format wird nicht unterstützt)');
        var shared = [], rs = /<si>([\s\S]*?)<\/si>/g, m;
        if (ssXml) while ((m = rs.exec(ssXml))) shared.push(textAus(m[1]));
        var stile = datumsStile(stXml);
        var ziele = {}, rl = /<Relationship\b[^>]*>/g;
        while ((m = rl.exec(rels))) ziele[attr(m[0], 'Id')] = attr(m[0], 'Target');
        var blaetter = [], rb = /<sheet\b[^>]*>/g;
        while ((m = rb.exec(wb))) {
          var ziel = ziele[attr(m[0], 'r:id')] || '';
          var pfad = ziel.charAt(0) === '/' ? ziel.slice(1) : 'xl/' + ziel.replace(/^\.\//, '');
          blaetter.push({ name: attr(m[0], 'name'), pfad: pfad });
        }
        if (!blaetter.length) zip.namen.filter(function (n) { return /^xl\/worksheets\/[^/]+\.xml$/.test(n); }).forEach(function (p, i) { blaetter.push({ name: 'Blatt ' + (i + 1), pfad: p }); });
        return Promise.all(blaetter.map(function (b) {
          return zip.text(b.pfad).then(function (xml) { return { name: b.name, zeilen: xml ? blattLesen(xml, shared, stile) : [] }; });
        }));
      });
  }

  function istXlsx(buffer) {
    var b = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
    return b.length === 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
  }

  return { lesen: lesen, istXlsx: istXlsx, _serienDatum: serienDatum, _istDatumsformat: istDatumsformat };
});
