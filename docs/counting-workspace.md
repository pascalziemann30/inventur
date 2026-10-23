# Zähloberfläche – getrennte Bedienvorschau

Die wiederverwendbare React-Komponente `CountingWorkspace` ist noch nicht mit den Live-Routen verbunden. `npm run dev:counting` öffnet unter `/counting-preview.html` eine Vorschau mit vier synthetischen Artikeln. Sie importiert keinen Base44-Client und schreibt ausschließlich in einen flüchtigen Speicher dieses Vorschaufensters. Ein Neuladen setzt die Vorschau zurück. Der normale Produktionsbuild enthält diese separate Einstiegsseite nicht; `npm run build:counting` baut sie getrennt nach `dist-counting/`.

## Abgedecktes Verhalten

- Monatsinventur als Ausgangspunkt; Auswahlfilter für aktive Artikel und individuelle Intervalle bereits vor dem Sitzungsstart.
- Gebindebruchteile mit Komma oder Punkt, mehrere bestätigte Umrechnungen additiv; ganze Torten und einzelne Kuchenstücke.
- Leer bleibt offen, eine bestätigte 0 zählt als Nullbestand. Überspringen löscht eine vorherige Zählung und erhält beim späteren Buchen den bisherigen Bestand.
- Sollbestand erst nach Mengenbestätigung; jede Mengenänderung öffnet den Artikel wieder und blendet den Vergleich aus.
- Suche, Filter, Fortschritt, Mitarbeiterabschluss nach ausdrücklicher Bearbeitung aller Positionen und zusätzlicher Abschlussbestätigung.
- Eine Schreibanfrage gleichzeitig, Zusammenfassen neuerer Eingaben, exakte Wiederholung derselben Anfrage nach einer unklaren Antwort. Speicherfehler bleiben sichtbar, blockieren den Abschluss und lösen eine Browserwarnung vor dem Schließen aus.
- Nativer modaler Abschlussdialog mit Tastaturfokus und Escape-Abbruch.

## Serveranschluss im getrennten Testbetrieb

Die lokale Bedienvorschau bleibt flüchtig. Zusätzlich verbindet `/InventoryCapture?workflow=server` dieselbe Komponente über `ServerCountingPage` mit dem authentifizierten Sitzungsdienst. Dieser prüft echte Benutzer/Standorte und Eingaben, verwendet einen serverseitigen Artikelsnapshot und schreibt in diesem Arbeitspaket ausschließlich in Base44-Testdaten. Offene bzw. übersprungene Artikel erhalten keine Bestandsbuchung. Details: `docs/inventory-runs.md`.

`saveDraft(request)` erhält `{id, revision, generation, snapshot}`. Der Sitzungsdienst speichert die Anfrage-ID mit Inhalt und Ergebnis dauerhaft zusammen mit der Sitzungsänderung, prüft die Revision bedingt und liefert bei exakter Wiederholung dieselbe Bestätigung `{request_id: id, revision: revision + 1}` zurückgeben. Eine reine Frontend-Warteschlange schützt nicht vor einem zweiten Gerät oder Tab. `initialRevision` stammt aus der geladenen Sitzung; jede Sitzung erhält eine eigene Komponenteninstanz mit `key=session.id`.

`completeSession()` ruft im Server-Testworkflow den echten Backendabschluss auf. Er friert die gespeicherten Eingaben ein, bucht jede Position mit stabiler Vorgangs-ID und Bestandsversionsstand und bestätigt den Gesamtabschluss erst nach erfolgreicher Übernahme aller gezählten Positionen. Eine zwischenzeitliche Lieferung löst einen sichtbaren Konflikt aus. Bereits gebuchte Positionen bleiben erhalten; eine ungeklärte Position kann ausdrücklich und mit Sperre gegen ältere laufende Abschlussversuche erneut gezählt werden. Nach Ablauf des Testfensters bleiben autorisierte Lesezugriffe möglich, Änderungen und Buchungen sind gesperrt.

Die bisherigen Live-Schreibwege und Berechtigungen bleiben bis zu dieser zusammenhängenden Umstellung unverändert. Die 46 echten Artikel werden weiterhin nicht importiert.

## Plattformdiagnose

`/InventoryCapture?diagnostics=storage` ist ein getrennter Admin-Prüfzugang innerhalb der App-Vorschau. Er verwendet die echte Base44-Anmeldung und ruft ausschließlich die gesperrte Prüffunktion auf; die normale Inventurerfassung wird dadurch nicht umgestellt. Testdatenmodus und korrekter Branch müssen aktiv sein. Eine veröffentlichte oder noch nicht verbundene Mitarbeiteroberfläche ist dies nicht.
