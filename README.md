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
- **Notebook (Chrome/Edge):** Adresse öffnen → Installieren-Symbol in der Adressleiste. Danach unter **Einstellungen → Daten und Sicherung → Datendatei anlegen** eine JSON-Datei wählen, gern in einem Sync-Ordner. Jede Änderung wird dort automatisch gespeichert. Nach einem Browser-Neustart einmal „Zugriff erlauben“ klicken.

## Abgleich Handy ↔ Notebook

- Notebook → Handy: die Datendatei aufs Handy bringen und dort **Einstellungen → Sicherung einlesen**.
- Handy → Notebook: auf dem Handy **Sicherung herunterladen**, auf dem Notebook **Einstellungen → Andere Datei öffnen** und diese Datei wählen.
- Einlesen ersetzt immer den kompletten Stand; zuletzt bearbeitetes Gerät gewinnt.

## Erste Schritte

1. **Import:** Kontoumsätze der apoBank als Excel (.xlsx) oder CSV exportieren → Buchungen → Excel/CSV importieren. Spalten einmal zuordnen; die Zuordnung wird gespeichert. Doppelte Buchungen werden beim erneuten Import erkannt.
   - Optional kann die Datei die Spalten **Kategorie** (Name oder Kürzel, z. B. „KVN-Honorar“ oder `kvn`), **Steuerjahr** und **Aufteilung** (z. B. „Kirchensteuer: 520“ – teilt die Buchung in zwei) enthalten. Bereits importierte Buchungen ohne Kategorie werden dabei ergänzt; auf Wunsch lernt die App daraus Regeln für künftige Importe.
   - Löschen in größerem Umfang: unter Buchungen „Angezeigte löschen“ (aktuelle Filterauswahl) oder unter Daten „Alle Buchungen löschen“.
2. **Kategorien:** direkt in der Liste wählen. Die App bietet an, daraus eine Regel zu machen; künftige Importe werden dann automatisch zugeordnet.
3. **Steuer:** Anstellung Jan–März 2026 (Lohnsteuerbescheinigung) und Jahressummen des Vorauszahlungsbescheids eintragen. Steuerbuchungen, die ein anderes Jahr betreffen (z. B. Nachzahlung 2025), dort umstellen.
4. **KVN:** Honorarbescheide je Quartal eintragen (brutto, Verwaltungskosten).
5. **Planung:** Hochrechnungsmethode wählen; Szenarien über „Aus Prognose füllen und fortschreiben“ anlegen und je Jahr anpassen.

## Bedienung

- **Leiste:** unten (Handy) höchstens vier Bereiche plus „Mehr“; Standard Übersicht · Steuer · Planung · KVN. Reihenfolge und Sichtbarkeit unter ⚙ Einstellungen → Leiste anpassen (oder Mehr → Leiste anpassen).
- **Übersicht:** Karten – Was bleibt mir?, Steuerrücklage, Kurs, Demnächst (Steuertermine nach § 37 EStG und erwartete Zahlungen), Zuordnen, Monatsrückblick, Woher/Wohin, Fixkosten (automatisch erkannte wiederkehrende Zahlungen), Was wäre, wenn …, Details. Über „Übersicht anpassen“ verschieben und ausblenden.
- **Steuer, KVN, Planung:** Ergebnis oben, Eingaben in aufklappbaren Gruppen mit Zusammenfassung; Erklärungen hinter „i“. Szenarien werden Jahr für Jahr bearbeitet.

## Darstellung, Bedienung, Sicherung

- **Darstellung** (⚙ → Darstellung): Farbschema Automatisch, Hell, Gedimmt oder Dunkel; sechs ruhige Akzentfarben. Formensprache wie „Dein Leben“.
- **Wischen** zwischen den Bereichen der Leiste (Handy). Die oberste sichtbare Seite ist die Startseite.
- **Zurück-Taste** schließt zuerst Blätter und Fenster, dann Unterseiten (Einstellungen), erst danach die App.
- **Sicherung** (⚙ → Sicherung und Daten): automatisch alle 1/3/7/14/30 Tage als Download (beim nächsten Tippen, wenn fällig), „Teilen“ über das Android-Teilen-Menü, Wiederherstellen aus einer Sicherungsdatei.

## Rechenstand

Tarif § 32a EStG 2026, Soli-Freigrenze 20.350 €, Höchstbetrag Altersvorsorge 30.826 €, sonstige Vorsorge 2.800 €/1.900 €, Arbeitnehmer-Pauschbetrag 1.230 €, Sonderausgaben-Pauschbetrag 36 €. Folgejahre: Tarif mit der eingestellten Inflationsrate fortgeschrieben. Orientierungsrechnung, keine Steuerberatung.

## Dateien

`index.html`, `styles.css`, `app.js` (Oberfläche und Auswertung), `steuer.js` (Steuer-Engine), `sw.js` (Offline-Betrieb), `manifest.webmanifest`, `icons/`.
