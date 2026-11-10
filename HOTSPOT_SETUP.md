# Hotspot, Verbindung und erste Kopplung

## Einmalige Einrichtung

1. Auf dem iPhone **Einstellungen → Persönlicher Hotspot → Zugriff für andere erlauben** aktivieren. Den exakten WLAN-Namen (iPhone-Gerätename) und das angezeigte Passwort merken. Für ESP32-S3 bei Problemen **Kompatibilität maximieren** aktivieren: das Gerät benötigt 2,4 GHz.
2. Bruce einschalten. Im **WiFi-Menü** den eigenen Hotspot auswählen, Passwort eingeben und speichern. Alternativ am lokalen USB-Serial-Terminal (115200 Baud):

   ```text
   wifi add "DEIN-IPHONE-NAME" "DEIN-HOTSPOT-PASSWORT"
   wifi on
   ```

   Nur lokal eingeben; echte Werte weder in GitHub noch in Supportprotokolle kopieren.
3. **Config → System Config → WiFi Startup: ON** einschalten, damit bekannte WLANs beim Start verbunden werden. Die Bridge startet automatisch mit der Firmware und wartet auf WLAN und gültige NTP-Zeit.
4. Der voreingestellte Relay-Host ist `bruce-control-relay.paiblo-besser.workers.dev`. Ändern bei Bedarf: **Config → Bruce Control → Relay host**, reinen Host ohne `https://` eingeben, danach neu starten.
5. **Config → Bruce Control → Pair iPhone** öffnen. Auf dem Display stehen Geräte-ID (zwei Zeilen mit je 16 Zeichen) und 8-stelliger Code. Das Fenster gilt 120 Sekunden.
6. PWA öffnen: **Mehr → Einstellungen**. Relay-URL `https://bruce-control-relay.paiblo-besser.workers.dev`, Geräte-ID aus beiden Zeilen ohne Leerzeichen, Code eingeben. **Sicher koppeln** antippen.
7. **Am physischen Bruce den Encoder drücken**, sobald die PWA zur Bestätigung auffordert. Danach wird der Browser-Token aktiviert. Bei Ablauf/5 Fehlversuchen am Gerät neu beginnen.
8. Home zeigt erst nach erfolgreichem Abruf echte Systemdaten. Unter Remote **Aktualisieren** und dann eine Navigationstaste testen. „Live starten“ liefert höchstens etwa alle 1,5 Sekunden einen Zeichenframe, soweit die Verbindung antwortet.

## Danach

**Hotspot einschalten → Bruce starten → PWA öffnen.** Gespeicherter Browser-Token verbindet sich automatisch. Bei kurzzeitigen Abbrüchen exponentieller Reconnect, aber keine Wiederholung bereits ausgelöster Befehle. Nach 30 Tagen oder Widerruf erneut koppeln.

iOS kann einen Hotspot ohne Teilnehmer beenden oder seine Sichtbarkeit begrenzen. Beim Erstverbinden die Hotspot-Einstellungsseite geöffnet lassen. Ein stabiler automatischer Start ist physisch noch zu prüfen.

## Dateitest

SD-Karte zuerst auf Bruce einhängen (Files/SD). In der PWA Dateien → SD → kleine Textdatei hochladen. Die Bridge legt `/BruceControl/` an und überschreibt keine bestehende Datei. Download und Vorschau prüfen. LittleFS separat auswählen; SD und interner Speicher sind keine Aliase.

## Widerruf

Am Gerät **Config → Bruce Control → Revoke iPhone**. Dadurch wird der Server-Token gelöscht. In der PWA „Dieses iPhone trennen“ entfernt nur die lokale Kopie; für vollständigen Widerruf auch das Gerätemenü verwenden.

## Direkter lokaler Zugriff

Die echte lokale IP steht nach Verbindung auf Home. Bruces vorhandene HTTP-WebUI kann separat über diese IP geöffnet werden, falls sie auf dem Gerät gestartet ist. Es wurde hier kein lokales iPhone-Hotspot-Routing getestet. HTTP aus einer HTTPS-PWA, CORS, Safari-Mixed-Content und lokale Netzberechtigungen sind kein zugesicherter Ersatz für WSS. Keine Zertifikatsausnahme installieren.
