# Externes GNSS

Bruce nutzt TinyGPS++ und UART/NMEA. Das Pinprofil definiert ESP32 TX=43 und RX=44. Modul-TX gehört an ESP32 RX; Modul-RX nur bei Bedarf an ESP32 TX, gemeinsame Masse. **GPIO sind 3,3-V-Signale**; Versorgung und Logikpegel müssen anhand des konkreten Modulboards geprüft werden. Ein „5 V“-Versorgungseingang beweist keine 5-V-toleranten ESP32-Pins.

Default-Baudrate im aktuellen Bruce-Code: 9600, 8N1. Config akzeptiert 9600, 19200, 38400, 57600 und 115200. Die Rate muss zur programmierten NMEA-Ausgabe des konkreten NEO-6M, ATGM336H oder M5Stack-Moduls passen. Keine pauschale Plug-and-play-Zusage für alle Module.

Beim Plus sind 43/44 auch nRF24-CE/CS und weitere externe Busoptionen. Ein unabhängiger paralleler GNSS-Treiber könnte diese Pins beschädigend umkonfigurieren; deshalb initialisiert die Bridge keinen zweiten UART und konfiguriert keine Pins. Upstream-GPS-Funktionen enthalten Pin-Freigabe/Wiederherstellung, die mit der konkreten Plus-Verkabelung physisch zu prüfen ist. Keine GPS-Verkabelung während des nRF24-Betriebs.

Für die Testversion auf Bruce GPS Tracker oder Wardriving starten. Nur tatsächlich von TinyGPS++ als gültig gemeldete Satelliten-/HDOP-Werte erscheinen im Status. Die Bridge markiert die Position nach 15 Sekunden als veraltet. Ein Fix-Typ wird nicht erfunden. Ohne gemeldete Genauigkeit in Metern bleibt diese im GPS Center leer. Die GNSS-Koordinaten können aufgezeichnet werden, der Meter-Genauigkeitsfilter steht dann nicht zur Verfügung; Zeit-/Ausreißerprüfung bleibt aktiv.

iPhone-GPS wird separat durch Browserfreigabe aktiviert. Dessen optionale Geschwindigkeit/Richtung und Genauigkeit werden angezeigt, Satelliten/HDOP fehlen in dieser API. `gps.push` speichert nur eine aktuelle Phone-Position im RAM; bestehende UART-Tracker/Wardriving verwenden diese noch nicht als Ersatzquelle.
