# Bruce Control · 0.1.0

Deutschsprachige iPhone-PWA für Bruce mit ausgehendem WSS-Relay, physischer Kopplungsbestätigung und lokalem GPS Center. AGPL-3.0-only.

**Status: erste Testversion, noch nicht auf einem physischen T-Embed oder iPhone geprüft.** Nicht verfügbare Module sind ausdrücklich gekennzeichnet. Es gibt keinen simulierten Gerätebetrieb in der normalen App.

- PWA: https://paiblo.github.io/bruce-control/
- Repository: https://github.com/paiblo/bruce-control
- Relay: https://bruce-control-relay.paiblo-besser.workers.dev/health

## Start

```sh
npm ci
npm run check
npm run test:relay
npm run dev
```

Die Entwicklungsadresse ist http://localhost:5173/bruce-control/. Produktionsbuild: `npm run build`, Ergebnis `apps/web/dist`. Hash-Routing, Manifest und Offline-Cache sind auf `/bruce-control/` abgestimmt.

## Downloads

[Erste Testversion mit Firmware und SHA256-Prüfsummen](https://github.com/paiblo/bruce-control/releases/tag/v0.1.0-test.1). Erst Backup erstellen und [Flashanleitung](FIRMWARE_FLASHING.md) lesen.

## Firmware

```sh
python -m venv work/venv
work/venv/bin/pip install platformio==6.2.0
python firmware/apply.py
work/venv/bin/pio run -d firmware/upstream -e lilygo-t-embed-cc1101 -j 2
```

Der Build zieht exakt Bruce-Commit `a59213f3ec6cd302fa32c2042b2700c9c24d991a`. Bridge und Patches sind getrennt, Originalmenüs bleiben erhalten. FastLED ist auf 3.10.3 fixiert, um einen `FP`-Makrokonflikt in 3.10.9 zu vermeiden.

## Dokumentation

- [Architektur und Protokoll](ARCHITECTURE.md)
- [Feature-Matrix mit Grenzen](FEATURE_MATRIX.md)
- [iPhone-Installation](INSTALLATION_IPHONE.md)
- [Hotspot und Kopplung](HOTSPOT_SETUP.md)
- [Backup, Flashen und Wiederherstellung](FIRMWARE_FLASHING.md)
- [Sicherheit](SECURITY.md)
- [Testergebnisse](TEST_RESULTS.md)
- [Bekannte Einschränkungen](KNOWN_LIMITATIONS.md)
- [Quelleninventar](docs/SOURCES.md)

`tests/` enthält ausdrücklich als Tests erkennbare Gerätesimulationen. Kein Test belegt physische Hardwarefunktion.
