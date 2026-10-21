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

## Noch notwendiger Serveranschluss

Die Bedienvorschau ist keine neue Bestandsschnittstelle. Vor Anschluss an die echte App muss ein authentifizierter Serverdienst die Sitzung führen, Eingaben unabhängig erneut prüfen, Benutzer/Standort prüfen und die Umrechnungen aus einem serverseitigen Sitzungssnapshot übernehmen. Offene bzw. übersprungene Artikel erhalten keine Bestandsbuchung.

`saveDraft(request)` erhält `{id, revision, generation, snapshot}`. Der Server muss die Anfrage-ID mit Inhalt und Ergebnis dauerhaft zusammen mit der Sitzungsänderung speichern, die Revision bedingt prüfen und bei exakter Wiederholung dieselbe Bestätigung `{request_id: id, revision: revision + 1}` zurückgeben. Eine reine Frontend-Warteschlange schützt nicht vor einem zweiten Gerät oder Tab. `initialRevision` stammt aus der geladenen Sitzung; jede Sitzung erhält eine eigene Komponenteninstanz mit `key=session.id`.

`completeSession()` darf nur den geprüften Serverabschluss aufrufen, keine direkten Bestandsänderungen aus dem Browser. Er muss gespeicherte Eingaben einfrieren, jede Position mit stabiler Vorgangs-ID und dem erfassten Bestandsversionsstand buchen, Teilfehler wieder aufnehmen und die Sitzung erst nach vollständiger Bestätigung abschließen. Eine inzwischen eingegangene Lieferung muss vor einem Überschreiben als Konflikt erscheinen. Der vorhandene CAS-Buchungskern ist dafür vorbereitet; der vollständige Sitzungsdienst und seine Integration stehen noch aus.

Die bisherigen Live-Schreibwege und Berechtigungen bleiben bis zu dieser zusammenhängenden Umstellung unverändert. Die 46 echten Artikel werden weiterhin nicht importiert.

## Plattformdiagnose

`/InventoryCapture?diagnostics=storage` ist ein getrennter Admin-Prüfzugang innerhalb der App-Vorschau. Er verwendet die echte Base44-Anmeldung und ruft ausschließlich die gesperrte Prüffunktion auf; die normale Inventurerfassung wird dadurch nicht umgestellt. Testdatenmodus und korrekter Branch müssen aktiv sein. Eine veröffentlichte oder noch nicht verbundene Mitarbeiteroberfläche ist dies nicht.
