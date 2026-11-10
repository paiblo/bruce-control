# Bruce Control 0.1.0-test.2

Entfernt zwei eingebaute Vorlagen aus der offiziellen Bruce BLE-Suite: Reverse Shell und WiFi Credentials. Menueeintraege und die zugehoerigen ausfuehrbaren Vorlagentexte wurden entfernt. Keine Kodierung, Verschleierung oder Antivirus-Ausnahme. Diese Funktionen sind fuer den vorgesehenen Geraetesteuerungsbetrieb nicht erforderlich.

Anlass war eine ESET-Quarantaene des ersten Firmware-Images mit der abgeschnittenen Erkennung PowerShell/RiskWare.Remote.... Im ersten Image war tatsaechlich eine PowerShell-Reverse-Shell-Vorlage vorhanden. Daraus folgt kein Nachweis, dass sie auf dem Windows-PC ausgefuehrt wurde. Die genaue ESET-Klassifizierung und ein ESET-Scan des neuen Images sind nicht verfuegbar. Andere Bruce-Funktionen koennen weiterhin als Dual-Use/Riskware erkannt werden; diese Version ist nicht pauschal als unbedenklich zertifiziert.

Das Image ist ein ESP32-S3/16-MB-Testbuild. Kein physisches Flashen oder Hardwaretest in dieser Cloud-Sitzung. Vor einem Flash muss ein vollstaendiges privates Backup vorhanden sein. Der Windows-Wiederaufnahmestarter prueft ein vorhandenes lokales 16-MB-Backup samt SHA256 und fuehrt daher kein weiteres langes Backup aus. Flashen und Verifizieren erfolgen ueber den vom Benutzer erfolgreich geprueften ROM-Bootloaderweg (COM3, --no-stub, 115200 Baud).

Zugehoeriger Quelltext und Bibliotheksquellen liegen im separaten Quellenarchiv. Unbenutzte Beispiele, Tests, SD-Sammlungen und fertige Tool-Binaries sind ausgenommen. AGPL-3.0; alle benoetigten Lizenzdateien bleiben enthalten.
