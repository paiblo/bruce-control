# Installation auf dem iPhone

1. In Safari **https://paiblo.github.io/bruce-control/** öffnen. Die Seite einmal vollständig laden lassen.
2. **Teilen → Zum Home-Bildschirm** wählen, gegebenenfalls „Als Web-App öffnen“ aktivieren, Name „Bruce Control“, **Hinzufügen**.
3. Das neue Symbol öffnen. Die Oberfläche funktioniert nach erfolgreicher Erstinstallation auch offline; Gerätekommunikation braucht Internet und GPS-Kacheln eine Verbindung.
4. In **Mehr → Einstellungen** das Gerät koppeln, siehe [Hotspot-Setup](HOTSPOT_SETUP.md).
5. Für iPhone-GPS **GPS → Standort freigeben** wählen. Bei abgelehnter Erlaubnis in iOS/Safari die Website-Standortberechtigung korrigieren und erneut versuchen. Der allgemeine iOS-Dialog kann je nach Version anders heißen.
6. „Karte laden“ ruft OSM-Kacheln ab. „Position an Bruce senden“ ist gesondert und standardmäßig aus. Tracks bleiben lokal.

Navigation verwendet Hashes (`#gps`, `#files`), damit Direktaufrufe auf GitHub Pages keine 404-Unterseiten erzeugen. Manifest-Startadresse, Scope und Service Worker sind `/bruce-control/`.

Updates erscheinen nach Erkennung als Banner. Bei laufendem Track zuerst speichern, dann aktualisieren. Browser-/Website-Daten löschen entfernt auch lokale Kopplung, Bibliothek und Tracks; vorab exportieren. iOS kann Speicher unter Platzdruck räumen. „Speicher anfragen“ ist keine Garantie gegen Löschung.

**Prüfgrenze:** Chromium-Mobiltests sind automatisiert; WebKit wird zusätzlich in CI geprüft. Ein Test mit deinem realen iPhone/iOS 27.0, Home-Bildschirm-Installation, Hotspot und gesperrtem Bildschirm steht aus. Dauerhafte Hintergrund-GPS-Aufzeichnung wird nicht zugesichert.
