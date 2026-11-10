Erste praktisch vorbereitete Testversion von Bruce Control.

PWA: https://paiblo.github.io/bruce-control/
Relay: https://bruce-control-relay.paiblo-besser.workers.dev/health

Für den ersten Flash das `bruce-control-t-embed-cc1101-plus-merged.bin` verwenden (ESP32-S3, 16 MB; Offset 0x0). Vorher vollständiges privates Flash- und SD-Backup erstellen, Modell/Flashgröße und SHA256SUMS prüfen. Die beiliegende FIRMWARE_FLASHING.md erklärt Backup, esptool-Kommandos, Wiederherstellung und die Unterschiede zum reinen App-Image bei 0x10000. HOTSPOT_SETUP.md erklärt WLAN-Start und physisches Pairing.

Implementiert: authentifizierter WSS-Relay, Pairing mit Gerätebestätigung, Wiederverbindung ohne Command-Resend, Geräteinfo, Originalmenü/Zeichenbildschirm, Diagnose-Terminal, begrenzte SD/LittleFS-Dateioperationen, IR-Handler, Displayhelligkeit, lokales GPS Center mit Karte/Tracks/Export/Import, Phone-GPS-Provider, GNSS-Hooks, Bibliothek und Remote-Builder. Weitere Modulbindungen sind sichtbar gesperrt; FEATURE_MATRIX.md und KNOWN_LIMITATIONS.md sind maßgeblich.

Geprüft: 16 Unit-Tests, 12 workerd-Relaychecks, 10 Mobil-Browsertests in Chromium/WebKit, zusätzlich synthetischer Test am veröffentlichten Relay und Firmware-Imageprüfung. Firmware erfolgreich gebaut, 92,74 % der App-Partition, 37,7 % statischer RAM.

**Kein physischer Hardwaretest und kein echtes iPhone-/iOS-27-Hotspot-Experiment wurden durchgeführt.** Linux-WebKit ist kein Nachweis einer konkreten iOS-Version. Die Testversion erfordert einen vorsichtigen ersten Hardwaretest. Keine kostenpflichtige Cloudflare-Planaktivierung.

AGPL-3.0. `bruce-control-firmware-source.tar.gz` enthält den vollständigen gepatchten Bruce-Quellstand, die verwendeten Bibliotheksquellen und Arduino-Frameworkquellen. BUILD_MANIFEST.json hält Revisionen/Versionen fest; weitere Framework-Systembibliotheken werden über die gepinnte Buildkonfiguration bezogen. Quellcode dieser PWA und Bridge ist über den Release-Tag verfügbar.

Das Quellenarchiv enthält den für den Build erforderlichen Quelltext und Lizenzdateien. Unbenutzte Beispiele, Tests, Website-Medien, SD-Beispielsammlungen und fertige Tool-Binaries sind aus Größen- und Übersichtgründen ausgeschlossen; sie sind über die fixierten Upstream-Versionen abrufbar.
