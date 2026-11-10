# Erster Hardwaretest

1. Vollbackup/SD-Backup und Modell/Flashgröße prüfen; Buildhash vergleichen.
2. Nach Flash lokal Display, Encoder, Zurück, SD, Akkuanzeige und offizielles CC1101-Menü testen.
3. Hotspot verbinden, WiFi Startup aktivieren; Reboot. Bridge-TLS bei gültiger NTP-Zeit prüfen.
4. Physisch koppeln; Home mit USB-CLI-Werten `info`, `free`, `uptime` vergleichen.
5. Remote einmal aktualisieren, je einen Tastendruck prüfen; kurze Trennung während Eingabe darf keinen späteren zweiten Befehl auslösen.
6. Kleine Testdatei unter `/BruceControl/` uploaden, downloaden und Bytegleichheit prüfen; Rename und bestätigtes Löschen testen.
7. 10-Sekunden-IR-Empfang an eigener Fernbedienung testen. Einzelwiedergabe nur am eigenen IR-Gerät.
8. iPhone-GPS freigeben, kurze Route im Vordergrund aufzeichnen, GPX exportieren. Auf Wunsch Position an Bruce senden.
9. Hotspot kurz deaktivieren/aktivieren; Browser und Gerät müssen neu verbinden. Test mit 15 Minuten Leerlauf und verfügbarem Heap/Task-Stack protokollieren.
10. Erst danach weitere Module testen; bei Fehlfunktion offizielles Backup wiederherstellen.

Keine Aussage dieses Dokuments bestätigt eine bereits erfolgreiche Hardwareprüfung.
