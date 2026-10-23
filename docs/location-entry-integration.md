# Standortübergabe – Entwicklungsstand

Empfängerseite und Quelladapter sind vorbereitet, nicht produktiv aktiviert.

## Vertrag

Shift Control ruft serverseitig den frisch geprüften `resolveWorkContext(request)` seiner Standortlogik auf. `integration/shift-control-location-entry/launchHandler.js` stellt eine Factory bereit, die daraus einen 90 Sekunden gültigen signierten Link erzeugt. Browser dürfen weder Standort noch Rolle liefern. Der Link ist während seiner Gültigkeit wiederverwendbar; er ist kein Einmalcode.

Die Inventur löst ausschließlich die Kombination aus Quell-App-ID, Quell-Standort-ID und Umgebung über `InventoryOutletBinding` auf. Vorwärts und rückwärts muss genau eine aktive Zuordnung existieren. Zielstandort muss aktiv sein. Namen sind Anzeige und dürfen unterschiedlich sein. Jede Mitarbeiteranfrage prüft die Zuordnung, deren Revision und den verpflichtenden absoluten Ablaufzeitpunkt expires_at erneut. Das Cookie läuft spätestens mit diesem Ablaufzeitpunkt ab.

`InventoryCapture?workflow=entry` zeigt die zwei Einstiegsmöglichkeiten. Die Mitarbeiterkarte tauscht die Übergabe gegen ein höchstens eine Stunde gültiges HttpOnly/Secure/SameSite=Strict-Cookie und prüft dieses mit einer zweiten Anfrage. Erst danach erfolgt die Weiterleitung. Die feste Standortauswahl kommt aus der Serverantwort. Der Administratorlink führt zum bisherigen geschützten Einstieg, er meldet niemanden automatisch an.

Ein Browsermarker wählt lediglich den Transport mit `X-Inventory-Mode: employee`. Der Server prüft unabhängig davon die signierte Sitzung. Neue Mitarbeiterwege greifen ausschließlich über die vier geprüften Scan-/Liefer-/Inventur-Endpunkte zu, nicht unmittelbar auf Entities oder Import-/Testeinrichtungen. Ein Cookiefehler führt nicht zu einem automatischen Administrator-Fallback.

## Noch notwendige echte Anbindung

1. Für eine eigenständige Kuno-App ist der servergeprüfte Einzelstandort-Adapter in Shift Control PR2 vorbereitet: native Benutzer-ID und native app_id werden frisch geprüft; source_location_id entspricht dabei ausdrücklich source_app_id. Bei späteren Mehrstandort-Apps stattdessen den geprüften Standortkernel verwenden. Beide Wege bleiben bis zur Konfiguration abgeschaltet.
2. Echte Quell-App- und Standort-IDs sowie Ziel-Outlets prüfen und explizit mit expires_at (maximal eine Stunde ab geplanter Testfreigabe) zuordnen. Keine Namen automatisch zu IDs umdeuten. Keine Beispiel-IDs verwenden.
3. Zwei unabhängige serverseitige Schlüssel konfigurieren: `INVENTORY_SHIFT_LAUNCH_KEY_DEV`, `INVENTORY_EMPLOYEE_SESSION_KEY_DEV`; Quell-App-ID `INVENTORY_SHIFT_SOURCE_ID_DEV`. Quelladapter benötigt denselben Launchschlüssel. Geheimnisse nie in Clientcode, URLs oder Repository ablegen.
4. Im befristeten Testfenster beweisen, dass der Base44-Proxy Origin, Set-Cookie und Cookie korrekt durchreicht. Empfänger akzeptiert aktuell ausschließlich die konfigurierte Entwicklungs-Preview-Origin. Keine Produktionsfreigabe ableiten.
5. Frühen Bootstrap im ausgelieferten Frontend nachweisen: main.jsx importiert die Fragmententfernung vor App-/SDK-Initialisierung; der Übergabewert bleibt nur kurzzeitig im Arbeitsspeicher. Signierte Übergaben dürfen weder geloggt noch als X-Origin-URL weitergereicht werden. Dies zusätzlich am echten Netzwerkverkehr prüfen.
6. Echte anonyme Browserprobe sowie fremde/gesperrte/umgebundene Standorte, Seitenreload und Ablauf testen. Anschließend Testschalter schließen.
7. Alte direkte Schreibrechte und den bisherigen Adminschutz vor Produktivfreigabe separat absichern. Ein Browser mit echter bestehender Base44-Admin-Anmeldung bleibt mit deren Token Administrator, wenn er die neuen Mitarbeiterwege verlässt. Der Transportmarker ist keine globale Herabstufung dieser Anmeldung.

Keine Produktionsdaten, Mappings oder Schlüssel wurden eingerichtet. Das Testfenster bleibt geschlossen. Bestehende Admin-/Legacyseiten wurden nicht auf das neue Berechtigungsmodell migriert. Daher ist die vollständige Standortanbindung noch offen.
