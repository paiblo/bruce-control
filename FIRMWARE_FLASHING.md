# Firmware: Backup, Flashen und Wiederherstellung

Die Bridge ist für Bruce-Boardprofil `lilygo-t-embed-cc1101` gebaut. Upstream verwendet dieses Profil auch für Plus: `interface.cpp` initialisiert ausdrücklich die Plus-nRF24-Pins 43/44. Board ESP32-S3, 16 MiB Flash / OPI-PSRAM, ST7789 170×320 mit Rotation 3. Keine neue Pinbelegung durch die Bridge. Trotzdem vor dem Flashen den genauen Modellaufdruck prüfen.

Download: [Release v0.1.0-test.1](https://github.com/paiblo/bruce-control/releases/tag/v0.1.0-test.1). Für den normalen Test das **merged**-Image verwenden; die Datei mit „app-0x10000“ ist nur für bewusstes Einzel-App-Flashen.

## Windows-Starter

Der lokale Starter `scripts/flash-windows.ps1` richtet esptool in einer eigenen Python-Umgebung unter `%LOCALAPPDATA%\BruceControl\Flash` ein. Voraussetzung ist Python 3.10 oder neuer. Er laedt den fest gepinnten Python-Installer, prueft dessen SHA256 sowie die Firmware und waehlt den lokalen COM-Anschluss. Bei mehreren Anschluessen muss der LILYGO-Port ausgewaehlt werden.

Danach folgen ESP32-S3-/16-MB-/Sicherheitspruefung, vollstaendiges lokales Flash-Backup, Schreiben, Vergleich und Neustart. Das private Backup wird niemals hochgeladen. Die SD-Karte muss separat gesichert werden. Ein falscher Chip, unbekannte Flashgroesse, aktive Verschluesselung oder ein unvollstaendiges Backup brechen den Ablauf vor dem Schreiben ab.

Diese Cloud-Sitzung hat keinen Zugriff auf die USB-Anschluesse deines Windows-PCs. Der Starter muss dort ausgefuehrt werden. Ein `-ExecutionPolicy Bypass` im Startkommando gilt nur fuer diesen PowerShell-Prozess; eine dauerhafte Aenderung der Windows-Einstellungen oder Administratorrechte sind nicht vorgesehen.

## Werkzeuge

USB-Datenkabel, Mac/Windows/Linux-Rechner und Python 3.12. Safari auf dem iPhone bietet keinen verlässlichen Web-Serial-Flasher; der erste Flashvorgang erfolgt am Rechner. Kein kostenpflichtiger Dienst erforderlich.

```sh
python -m venv work/flash-venv
# macOS/Linux:
work/flash-venv/bin/pip install esptool==5.3.0
# Windows stattdessen: work\flash-venv\Scripts\pip.exe install esptool==5.3.0
```

Im Folgenden bezeichnet `esptool` das Programm in dieser Umgebung. Unter Windows ggf. dessen vollständigen Pfad einsetzen. `PORT` durch den tatsächlichen USB-Port ersetzen (`COM…`, `/dev/cu.usbmodem…`, `/dev/ttyACM…`).

## Zuerst sichern

1. SD-Karte separat auf dem Rechner sichern. WLAN-Passwörter und andere Konfigurationen privat aufbewahren.
2. Port anzeigen: `esptool --chip esp32s3 --port PORT chip-id`. Für Downloadmodus bei Bedarf BOOT gedrückt halten, USB verbinden bzw. RESET drücken, BOOT loslassen. Wenn die Hardwarebezeichnungen abweichen, LILYGO-Anleitung verwenden.
3. Flashgröße prüfen: `esptool --chip esp32s3 --port PORT flash-id`. Nur bei 16 MiB mit diesem Image fortfahren.
4. Vollbackup (enthält auch NVS/Zugangsdaten, niemals veröffentlichen):

   ```sh
   esptool --chip esp32s3 --port PORT read-flash 0x0 0x1000000 bruce-before-control.bin
   ```

## Bridge bauen oder geprüfte Release-Datei nutzen

Build aus diesem Repository:

```sh
pip install platformio==6.2.0
python firmware/apply.py
pio run -d firmware/upstream -e lilygo-t-embed-cc1101 -j 2
```

Die erzeugte `firmware.bin` ist nur das App-Image bei **0x10000**. Sie ist kein zusammengeführtes Vollimage. Die bereitgestellte Datei `bruce-control-t-embed-cc1101-plus-merged.bin` enthält Bootloader bei 0x0, Partitionstabelle bei 0x8000 und App bei 0x10000. Prüfhash vor dem Schreiben mit `SHA256SUMS` vergleichen. Keine Datei flashen, falls der dokumentierte Build fehlgeschlagen ist oder das genaue Modell nicht passt.

## Geprüfte Image-Eigenschaften

App-Image 4.315.024 Bytes, zusammengeführtes Image 4.380.560 Bytes. ESP32-S3 Chip-ID 9, 16 MB, Flashmodus DIO, 80 MHz. App-Partition 0x470000 Bytes: 92,74 % belegt. Der gesamte 16-MB-Flash-Prozentwert von PlatformIO ist hierfür nicht maßgeblich. Statischer RAM 123.528 / 327.680 Bytes; dynamischer TLS-/Taskbedarf noch physisch zu messen. Metadaten und Integrität mit esptool geprüft, App-Bytes im merged-Image ab Offset 0x10000 bytegleich nachgewiesen.

## Flashen

Mit vollständig gesichertem Gerät und geprüftem zusammengeführtem Image:

```sh
esptool --chip esp32s3 --port PORT --baud 460800 write-flash 0x0 bruce-control-t-embed-cc1101-plus-merged.bin
esptool --chip esp32s3 --port PORT verify-flash 0x0 bruce-control-t-embed-cc1101-plus-merged.bin
```

Kein `erase-flash` nötig. Der Bereich NVS bei 0x9000 kann beim Schreiben eines zusammengeführten Images betroffen sein; vom Erhalt alter Einstellungen nicht ausgehen. Backup bleibt erforderlich. Nach Abschluss neu starten und Modell-/Display-/SD-Funktion zuerst lokal prüfen. Danach [Hotspot und Kopplung](HOTSPOT_SETUP.md).

## Wiederherstellen

Mit dem privaten Vollbackup:

```sh
esptool --chip esp32s3 --port PORT --baud 460800 write-flash 0x0 bruce-before-control.bin
```

Alternativ offizielle Firmware ausschließlich über [Bruce Installationsanleitung](https://wiki.bruce.computer/getting-started/) / [offiziellen Web-Flasher](https://bruce.computer/flasher) für das passende T-Embed CC1101-Modell laden. Anschließend gespeicherte Konfiguration prüfen und SD-Backup wiederherstellen. BOOT/RESET-Downloadmodus funktioniert unabhängig von einer laufenden Bridge, sofern die Hardware intakt ist.

Diese Anleitung beschreibt den vorgesehenen Ablauf. In dieser Sitzung wurde kein Gerät geflasht, kein Backup gelesen und keine Wiederherstellung auf Hardware geprüft.
