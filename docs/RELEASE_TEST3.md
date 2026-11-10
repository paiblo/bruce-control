# Bruce Control 0.1.0-test.3: CLI stack correction, full upstream features

Fixes a concrete stack-budget defect in the bridge. The previous execute function reserved 7,968 bytes and its serial-handler caller reserved 592 bytes, already exceeding the CLI task's 8,192-byte stack before nested library calls. Large file-transfer buffers now use checked RAII allocations, preferably in PSRAM. The final optimized program inlines execute into the serial handler and reserves 1,440 bytes there. The stack-budget checker enforces at least 2,048 bytes of static reserve. This is a static build check; it does not claim a physical hardware test or complete dynamic-stack coverage.

The user's private device log showed StoreProhibited in a FreeRTOS tick and an interrupt watchdog timeout around a queue operation. Stack corruption can explain such failures; successful hardware recovery still must be verified by the user. No private log, credentials, MAC addresses or backups are published.

ALL original upstream Bruce features are preserved, as explicitly requested. No example payloads or module features are removed. This is not an antivirus clearance; the original dual-use firmware functionality can trigger riskware detections.

For the already installed original 16-MB T-Embed CC1101/Plus bridge firmware, scripts/resume-flash-test3.ps1 verifies an existing private full-flash backup and writes ONLY the new app image at 0x10000, then verifies it. This preserves NVS/device pairing, the partition table and LittleFS. No second lengthy backup is performed. The full merged image at 0x0 is also provided for a deliberate full installation with a valid backup.

ROM transport remains --no-stub, 115200 baud. Close the USB monitor before flashing. No erase-flash, security-tool exclusion or credential upload is performed. After installation, test boot without a hotspot, then with a hotspot, then pair/remote/periodic status. If a panic persists, retain the new reset log and the matching ELF.

Full corresponding firmware and library source is included, excluding unused examples, tests, media, SD examples and precompiled tool binaries. AGPL-3.0. Exact ELF is retained locally for reset decoding; no physical flash was performed by the cloud session.
