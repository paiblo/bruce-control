# Feature-Matrix der Testversion

Legende: Ja = implementiert; Teil = begrenzter Umfang; — = nicht verfügbar. Alle Gerätefunktionen brauchen noch physische Prüfung. Browser-/Runtime-Tests ersetzen diese nicht.

| Funktion | Offiziell Bruce | WebUI | Neue Bridge | Zusatzhardware | Testversion | Automatisiert | Physisch prüfen |
|---|---|---|---|---|---|---|---|
| iPhone-Hotspot / WSS-Relay | WLAN ja, Relay nein | lokales HTTP | Ja | Internet | Ja | Relay-Runtime | Ja |
| Physisches Pairing / Token / Revoke | eigene BLE-API vorhanden | eigene WebUI-Auth | Ja | — | Ja | 12 Runtimechecks | Ja |
| Geräteinformationen / Heap / PSRAM / IP | Ja | CLI | Ja | — | Ja | Routing / Schema | Ja |
| Akku | Boardhandler | teils | erforderlich | Akku/Fuel Gauge | —, bewusst leer | Leerstatus UI | Ja |
| Live-Verlaufsgraph / Speicher-Ringe | Rohwerte ja | CLI | Ja | PSRAM je Board | Ja, nur echte Sitzung | UI | Ja |
| Originales Menü / Navigation / lange Pulse | Ja | Navigator | Ja | Display/Board | Ja, 10–1000 ms | Schema / Routing | Ja |
| Bildschirm / Screenshot / Skalierung | Zeichenlogger | `/getscreen` | Ja | Display | Ja, binäre Zeichenframes | Decoder / UI | Ja; keine Pixelgleichheit |
| Vollbild / Querformat | — | Browser | Browser | — | Teil, Browserfunktion / responsive | Mobil-Overflow | iOS-Vollbild |
| Terminal | viele Befehle | `/cm` | sichere Teilmenge | I²C je Gerät | Ja, Diagnose-Allowlist | Allowlist / Timeout | Ja |
| IR-Empfang / RAW | Ja | CLI | Ja | Board IR 1/2 | Ja, Upstream-Timeout 10 s | Parameterprüfung | Ja |
| IR-Datei senden | Ja | CLI | Ja | IR-Diode | Ja, ausdrückliche Einzelaktion | Allowlist | Ja |
| IR-Remote-Builder | native App Remotes | nein | nur Senden | IR-Diode | Ja, Position/Farbe/Label/Gruppe/Profil; Raster per Schieberegler | Persistenzgrundlage | Ja |
| IR-Favoriten / Import / Export | Dateien | Ja | nicht lokal nötig | — | Ja, IndexedDB | Import / Persistenz | — |
| Sub-GHz-Empfang / Wiedergabe | Ja | CLI | erforderlich | CC1101 im Board | —, Oberflächen/Dateibibliothek | Sperrstatus | Ja |
| Spektrum | bestimmte RF-Funktionen | keine garantierten Streams | erforderlich | CC1101 | —, keine erfundenen Kurven | Leerstatus | Ja |
| NFC lesen / emulieren | Ja, tagabhängig | CLI | erforderlich | PN532 im Boardprofil | —, lokale Dumps / Diagnose | Sperrstatus | Ja |
| NFC-Dateien vergleichen | Dateien | Texteditor | nicht lokal nötig | — | Rohvorschau; strukturierter Vergleich ausstehend | Bibliothek | — |
| iPhone-GPS / Genauigkeit / Tempo / Richtung | neue Quelle | nein | nur Push | iPhone-Freigabe | Ja, Karten-/Koordinatensicht; Richtung nur wenn gemeldet | Geolocation-Browsertest | Ja |
| GNSS extern live | UART/TinyGPS++ | eingeschränkt | Hook | NMEA-Modul extern | Teil: Tracker/Wardriving-Hook, frische Position/Sat/HDOP wenn vorhanden | Schemas | Ja |
| Phone-GPS an Bruce | nein | nein | Ja | — | Ja, 15-s-Frische / Genauigkeitsgrenze, Provider getter | Schema / Filter | Ja |
| Phone-GPS in Upstream Wardriving | UART-gebunden | nein | weiterer Umbau | — | —; Provider speichert nur aktuelle Position | — | Ja |
| GPS-Karte / Track / Start-Ende / Wegpunkte | Tracker | kein Kartenportal | lokal | Internet für Kacheln | Ja | GPS-Browsertest | iOS |
| GPS-Pause / Resume / Filter / Ausreißer | Teil | nein | lokal | — | Ja, keine Linie über Pause | Unit | iOS |
| GPX / CSV / GeoJSON Import-Export | GPX/CSV geräteseitig | Dateien | lokal | — | Ja | Unit / Browser-Download | iOS-Teilen |
| Wardriving-CSV / Verschlüsselungsfilter / Statistik | Ja, WiGLE-CSV | Datei | lokal | vorhandene Datei | Ja, keine aktive Netzinteraktion | CSV-Parser | Datenprobe |
| Gleichzeitige WLAN-Scans + Hotspot | hardwareabhängig | Warnung | weiterer Ablauf | — | Import nach Offline-Erfassung empfohlen | keine Hardware | Ja |
| LED-Effekte | Ja | CLI | erforderlich | RGB-LEDs | — | Sperrstatus | Ja |
| Displayhelligkeit | Ja | CLI | Ja | Display | Ja | Schema | Ja |
| Audio | Ja | CLI | erforderlich | Boardlautsprecher | —, gekennzeichnet | Sperrstatus | Ja |
| GPIO-Schreiben | Ja | CLI | bewusst gesperrt | Pins/Module | — | Allowlist | — |
| I²C-Scan | Ja | CLI | Ja | angeschlossene Geräte | Ja, ausdrückliche Aktion | Allowlist | Ja |
| Bruce App-Store / Skriptverwaltung | Ja / native App | CLI-Dateien | erforderlich | Speicher | —, gekennzeichnet | Sperrstatus | Ja |
| Systemneustart / Energie / Konfigbackup | Ja | teils | erforderlich | — | —; Diagnose ja, lokale Bibliothekssicherung ja | Diagnose | Ja |
| SD / LittleFS Liste / Verzeichnisse | Ja | Ja | Ja | SD separat | Ja, Liste max. 200 | Pfad-/Schemachecks | Ja |
| Datei Upload / Download / Rename / Delete | Ja | Ja | Ja | Speicher | Ja, 3 KiB-Blöcke, Upload ≤1 MiB, Download ≤16 MiB; nur Dateien löschen | Pfadsicherheit | Ja |
| Texteditor | Ja | Ja | Ja | Speicher | Ja, ≤256 KiB; Speichern als neue Datei | UI / Persistenz | Ja |
| Bibliothek Suche / Filter / Sortierung / Favoriten | native App | Dateien | lokal | — | Ja | IndexedDB / Import | iOS-Speicher |
| PWA / Offline / Update / Pages | nein | lokale HTML-UI | lokal | — | Ja | Build / Offline-Browser / CI | Installation iOS |

Nicht implementierte Funktionen werden nicht durch Dummy-Messwerte ersetzt. Die Bridge-Capability-Liste ist bewusst kleiner als die gesamte Firmware-CLI. nRF24 ist beim Plus vorhanden, aber durch diese Bridge nicht fernsteuerbar. Externes GNSS ist nicht automatisch erkannt oder neu auf UART gestartet; es liest ausschließlich Werte bereits laufender Bruce-GPS-Funktionen.
