# Quellen und tatsächlich analysierter Stand

Abruf: 10. November 2026.

| Quelle | Fixierter Stand / geprüfte Dateien |
|---|---|
| [Bruce Firmware](https://github.com/BruceDevices/firmware/tree/a59213f3ec6cd302fa32c2042b2700c9c24d991a) | `a59213f3ec6cd302fa32c2042b2700c9c24d991a`, AGPL-3.0; platformio.ini, Plus-Pins und interface.cpp, serial_commands, SerialDevice, tftLogger, webInterface, GPS Tracker und Wardriving |
| [Bruce iOS](https://github.com/BruceDevices/App-IOS/tree/96b7fdd16437b58c3bfeabea33c8c403a11b851b) | `96b7fdd16437b58c3bfeabea33c8c403a11b851b`; README, Bluetooth/BLEManager, Protocol, Views, StoreClient/AppStore. Native App verwendet BLE/CoreBluetooth; keine direkt in Safari verwendbare Verbindung. |
| [LILYGO](https://github.com/Xinyuan-LilyGO/T-Embed-CC1101) | README und Board-/Moduldokumentation. Maßgeblich für den Build ist das Bruce-Pinprofil. |
| [WebUI](https://wiki.bruce.computer/controlling-device/webui/) | Navigator, Texteditor, CLI, Startoptionen; mit Quellcode abgeglichen. |
| [Serial](https://wiki.bruce.computer/controlling-device/serial/) | Befehlsfamilien; exakte Zulassung aus aktuellem CLI-Code. |
| [GPS](https://wiki.bruce.computer/features/gps/) und [Module](https://wiki.bruce.computer/external-modules/gps/) | NMEA UART, NEO-6M / ATGM336H / M5Stack; tatsächliche Werte abhängig vom Modul und dessen Ausgabe. |
| [Cloudflare WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/) | acceptWebSocket, Hibernation, serializeAttachment, Auto-Response. |
| [Cloudflare Preise](https://developers.cloudflare.com/durable-objects/platform/pricing/) | SQLite auf Free unterstützt: 100.000 Requests/Tag, 13.000 GB-s/Tag, 5 Mio. gelesene und 100.000 geschriebene Zeilen/Tag, 5 GB Gesamtspeicher. WebSocket-Nachrichten werden mit Faktor 1/20 als Requests gezählt. Limits sind keine zugesicherte kostenlose Nutzung in bestehenden Paid-Accounts. Kein Paid-Plan wurde aktiviert. |
| [MDN Mixed Content](https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content) | HTTPS-PWA kann lokale HTTP-Verbindungen nicht als verlässlich voraussetzen. |
| [MDN Geolocation](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API) | Secure Context und ausdrückliche Berechtigung. Keine Satellitenzahl/HDOP im Browser. |
| [WebKit Feature Status](https://webkit.org/status/) | Keine pauschale iOS-27-Kompatibilitätsbehauptung; reale Safari-/Hotspot-Prüfung ausstehend. |

## Offizielle Schnittstellen

WebUI hat `POST /cm` mit `cmnd`, `GET /getscreen` als binäres Zeichenprotokoll, `GET /listfiles`, `GET /file`, `POST /rename` und `POST /upload`. HTTP-Basic-/WebUI-Zugriff bleibt von der Bridge unabhängig. Die PWA benötigt keine lokale HTTP-Einbettung.

CLI registriert unter anderem `info`, `free`, `uptime`, `date`, `settings`, `storage`, `ir`, `subghz`/`rf`, `led`/Display-Befehle, `gpio`, `i2c`, `js`, `power`, `webui`; Verfügbarkeit ist teils durch Board-/Lite-Buildflags bedingt. **Vorhandener CLI-Befehl bedeutet nicht automatisch Bridge-Freigabe.** In der Bridge ist Terminal auf Diagnose beschränkt; aktive IR-Signale verwenden einen eigenen typisierten Befehl.

Native iOS-App: Geräteübersicht, BLE-Fernsteuerung samt Zeichenrenderer, Module, IR-Remotes, Bibliothek, App-Store-Installation über BLE, Firmware-/Dateiansichten, Terminal. Bruce Control übernimmt keine proprietären Bildassets oder das native BLE-Transportmodell. Eigene SVG- und App-Icons. Bildschirmdecoder basiert auf dem AGPL-Zeichenformat und nennt die Quelle im Code.
