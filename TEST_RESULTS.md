# Testergebnisse · 10. November 2026

## Bestanden

| Prüfung | Ergebnis |
|---|---|
| ESLint / TypeScript Web und Relay | bestanden |
| Unit-Tests | 16 bestanden: Schemas, Sicherheitsgrenzen, GPS-Ausreißer/Frische/Einheiten, Pausensegmente, GPX/CSV/GeoJSON, WiGLE, IndexedDB, Backup, Bildschirmdecoder, Timeout ohne Resend |
| Relay in echtem workerd-Runtime über Miniflare 5 | 12 Checks bestanden: Enrollment-Besitz, Origin, ungültiger Token, physische Bestätigung, inaktiver Token, Command/Reply, Replay, Ablauf, Geräteisolation und Widerruf |
| Chromium Mobilviewport | 5 bestanden: 8 Seiten/Overflow, Import/Favoriten/Persistenz, Standort/Track/GPX, Offline-Neustart, Menü/Pairingvalidierung |
| WebKit 27.2 Linux mit iPhone-Viewport | dieselben 5 Tests bestanden, einschließlich Service Worker offline und GPX-Dateiinhalt |
| Vite-Produktionsbuild | bestanden; GPS/Karte als Lazy-Chunk, 11 Offline-Cache-Einträge |
| GitHub Pages | veröffentlicht, HTTPS-Seite und Assets erreichbar |
| Veröffentlichter Cloudflare-Relay | Healthcheck HTTP 200; synthetischer HTTPS/WSS-Gerätetest für Enrollment, Pairing, Freigabe, Command/Reply, Replay und Revoke bestanden |
| Firmware | erfolgreich mit PlatformIO 6.2.0, pioarduino 55.03.39, Arduino 3.3.9 und gepinntem exFAT-Framework gebaut |
| Firmware-Image | ESP32-S3 / 16 MB / DIO / 80 MHz; SHA256 und App-Bytes im merged-Image geprüft |

16 + 12 + 10 = **38 automatisierte Checks**, zusätzlich Live-Relaytest und Imageprüfung. Die Testfixtures verwenden ausdrücklich künstliche Positionen / Geräte. Sie erscheinen nicht als echte Daten im normalen App-Betrieb.

## Firmware-Speicher

App 4.315.024 Bytes / 4.653.056 Bytes Factory-App-Partition = **92,74 %**. Merged-Image 4.380.560 Bytes. Statische RAM-Belegung **123.528 / 327.680 Bytes (37,7 %)**. Laufzeitheap, Fragmentierung, WSS-Handshakes, Queue-/Task-Stacks und Watchdog sind nicht an Hardware gemessen.

## Korrigierte beobachtete Fehler

- pioarduino überschrieb die vorhandene CA-Konfiguration; im lokalen Buildwerkzeug wurde der bestehende vertrauenswürdige Systempfad erhalten, TLS-Prüfung blieb aktiv.
- Compilerpaket konnte wegen knappen temporären Plattenplatzes nicht vollständig kopiert werden; Buildcache bereinigt und vollständiges Toolchainpaket verwendet.
- FastLED 3.10.9 kollidierte mit Bruces `FP`-Makro; auf 3.10.3 fixiert.
- Upstream-Buildpatch nannte ein veraltetes Toolchainpaket; auf das tatsächlich installierte vereinheitlichte Paket korrigiert und Verlust des Originalarchivs bei Toolfehler verhindert.
- Upstream-IR-Handler gab bei Timeout den Reader nicht frei; Freigabe ergänzt.
- WebKit-Testbrowser lieferte Geolocation-Zeitstempel in Mikrosekunden; Einheit normalisiert, Frischeprüfung bleibt erhalten.
- Transiente Geolocation-Fehler beendeten die Watch zu früh; nur eine abgelehnte Berechtigung beendet sie jetzt.
- Browserabhängige Sanitierung von Dateinamen wird im GPX-Downloadtest berücksichtigt; auch tatsächlicher Dateiinhalt wird geprüft.

## Prüfgrenzen

Kein physisches Flashen, kein reales LILYGO, kein iOS-27-Hotspot, keine Antennen-/IR-/NFC-Prüfung oder Hintergrund-GPS-Messung. Linux-WebKit mit Mobilviewport belegt keine Hardware-/iOS-Kompatibilität. Der vollständige Bruce-Upstream behält Compilerwarnungen; Details in KNOWN_LIMITATIONS.md.

CI: https://github.com/paiblo/bruce-control/actions
Release und Hashes: https://github.com/paiblo/bruce-control/releases/tag/v0.1.0-test.1
