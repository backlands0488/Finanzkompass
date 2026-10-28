# Finanzkompass – Ausbaustufe 1

Einnahmen, Ausgaben, Gewinn und Steuer der Praxis. Läuft als installierbare Web-App (PWA) auf Handy und Notebook, offline, alle Daten nur lokal.

## Einrichten auf GitHub Pages (einmalig)

1. Auf github.com ein neues Repository anlegen, z. B. `finanzkompass` (öffentlich – es enthält nur Programmcode, keine Daten).
2. „Add file“ → „Upload files“ → alle Dateien und den Ordner `icons` aus diesem Paket hochladen → „Commit changes“.
3. Im Repository: Settings → Pages → „Deploy from a branch“, Branch `main`, Ordner `/ (root)` → Save.
4. Nach etwa einer Minute ist die App erreichbar unter `https://<dein-github-name>.github.io/finanzkompass/`.

## Installieren

- Wichtig: Chrome-Menü ⋮ → **„App installieren“** wählen, nicht „Verknüpfung erstellen“ (die öffnet nur einen Browser-Tab). Danach über das App-Symbol starten. Langes Drücken auf das Symbol bietet Kurzbefehle (Zuordnen, Buchungen, Steuer).
- Meldet Chrome „bereits installiert“, die App startet aber nicht: in den Android-Einstellungen unter Apps „Finanzkompass“ deinstallieren und neu installieren (vorher Datensicherung herunterladen).

- **Handy (Chrome):** Adresse öffnen → Menü ⋮ → „Zum Startbildschirm hinzufügen“ bzw. „App installieren“.
- **Notebook (Chrome/Edge):** Adresse öffnen → Installieren-Symbol in der Adressleiste. Danach unter **Daten → Neue Datendatei anlegen** eine JSON-Datei wählen, gern in einem Sync-Ordner. Jede Änderung wird dort automatisch gespeichert. Nach einem Browser-Neustart einmal „Zugriff erlauben“ klicken.

## Abgleich Handy ↔ Notebook

- Notebook → Handy: die Datendatei aufs Handy bringen und dort **Daten → Datensicherung einlesen**.
- Handy → Notebook: auf dem Handy **Datensicherung herunterladen**, auf dem Notebook **Daten → Andere Datei öffnen** und diese Datei wählen.
- Einlesen ersetzt immer den kompletten Stand; zuletzt bearbeitetes Gerät gewinnt.

## Erste Schritte

1. **Import:** Kontoumsätze der apoBank als Excel (.xlsx) oder CSV exportieren → Buchungen → Excel/CSV importieren. Spalten einmal zuordnen; die Zuordnung wird gespeichert. Doppelte Buchungen werden beim erneuten Import erkannt.
   - Optional kann die Datei die Spalten **Kategorie** (Name oder Kürzel, z. B. „KVN-Honorar“ oder `kvn`), **Steuerjahr** und **Aufteilung** (z. B. „Kirchensteuer: 520“ – teilt die Buchung in zwei) enthalten. Bereits importierte Buchungen ohne Kategorie werden dabei ergänzt; auf Wunsch lernt die App daraus Regeln für künftige Importe.
   - Löschen in größerem Umfang: unter Buchungen „Angezeigte löschen“ (aktuelle Filterauswahl) oder unter Daten „Alle Buchungen löschen“.
2. **Kategorien:** direkt in der Liste wählen. Die App bietet an, daraus eine Regel zu machen; künftige Importe werden dann automatisch zugeordnet.
3. **Steuer:** Anstellung Jan–März 2026 (Lohnsteuerbescheinigung) und Jahressummen des Vorauszahlungsbescheids eintragen. Steuerbuchungen, die ein anderes Jahr betreffen (z. B. Nachzahlung 2025), dort umstellen.
4. **KVN:** Honorarbescheide je Quartal eintragen (brutto, Verwaltungskosten).
5. **Planung:** Hochrechnungsmethode wählen; Szenarien über „Aus Prognose füllen und fortschreiben“ anlegen und je Jahr anpassen.

## Übersicht

Oben drei Antworten: *Was bleibt mir?* (pro Monat, mit Aufteilung jedes Euros), *Reicht meine Steuerrücklage?* (Ring: bezahlt + zurückgelegt) und *Bin ich auf Kurs?* (Gewinnziel oder Vorjahr). Darunter „Was wäre, wenn …“ mit Reglern für Sitzungen, Urlaub und Ausgaben – Ergebnis nach Steuer. Details (Kennzahlen, Monate, EÜR, Cashflow) zum Aufklappen. Offene Buchungen werden über „Zuordnen“ als Karten nacheinander mit Vorschlägen kategorisiert.

## Rechenstand

Tarif § 32a EStG 2026, Soli-Freigrenze 20.350 €, Höchstbetrag Altersvorsorge 30.826 €, sonstige Vorsorge 2.800 €/1.900 €, Arbeitnehmer-Pauschbetrag 1.230 €, Sonderausgaben-Pauschbetrag 36 €. Folgejahre: Tarif mit der eingestellten Inflationsrate fortgeschrieben. Orientierungsrechnung, keine Steuerberatung.

## Dateien

`index.html`, `styles.css`, `app.js` (Oberfläche und Auswertung), `steuer.js` (Steuer-Engine), `sw.js` (Offline-Betrieb), `manifest.webmanifest`, `icons/`.
