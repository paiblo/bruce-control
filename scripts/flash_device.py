#!/usr/bin/env python3
"""Local USB installer. Never upload the private full-flash backup."""
from __future__ import annotations

import argparse
import hashlib
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import urllib.request
import uuid

FIRMWARE_NAME = "bruce-control-t-embed-cc1101-plus-merged.bin"
FIRMWARE_URL = (
    "https://github.com/paiblo/bruce-control/releases/download/"
    "v0.1.0-test.1/" + FIRMWARE_NAME
)
FIRMWARE_SHA256 = "f292173b33babbb1f3dbc3d976c307e6268a307c265d3e345ae6213fcb13c96a"
FIRMWARE_BYTES = 4380560
FLASH_BYTES = 16 * 1024 * 1024


class FlashError(RuntimeError):
    pass


def check_firmware(path: Path) -> None:
    if path.stat().st_size != FIRMWARE_BYTES:
        raise FlashError("Firmware-Dateigroesse stimmt nicht. Es wurde nichts geflasht.")
    if hashlib.sha256(path.read_bytes()).hexdigest() != FIRMWARE_SHA256:
        raise FlashError("Firmware-Pruefsumme stimmt nicht. Es wurde nichts geflasht.")


def download_firmware(work: Path) -> Path:
    target = work / FIRMWARE_NAME
    if target.exists():
        check_firmware(target)
        return target
    temporary = target.with_suffix(".download")
    try:
        request = urllib.request.Request(FIRMWARE_URL, headers={"User-Agent": "BruceControl-LocalFlasher/0.1"})
        with urllib.request.urlopen(request, timeout=90) as response, temporary.open("wb") as output:
            total = 0
            while block := response.read(65536):
                total += len(block)
                if total > FIRMWARE_BYTES:
                    raise FlashError("Download ist groesser als die gepruefte Firmware.")
                output.write(block)
        check_firmware(temporary)
        temporary.replace(target)
    finally:
        temporary.unlink(missing_ok=True)
    return target


def choose_port(requested: str | None) -> str:
    from serial.tools import list_ports

    ports = sorted(list_ports.comports(), key=lambda p: p.device)
    if requested:
        for port in ports:
            if port.device.casefold() == requested.casefold():
                return port.device
        raise FlashError(f"Anschluss {requested} nicht gefunden.")
    if not ports:
        raise FlashError("Kein USB-Seriell-Anschluss erkannt. Datenkabel und Geraetemanager pruefen.")
    for index, port in enumerate(ports, 1):
        print(f"  {index}. {port.device}: {port.description}")
    if len(ports) == 1:
        return ports[0].device
    selection = input("Nummer des LILYGO-Anschlusses: ").strip()
    if not selection.isdecimal() or not 1 <= int(selection) <= len(ports):
        raise FlashError("Kein eindeutiger Geraeteanschluss ausgewaehlt.")
    return ports[int(selection) - 1].device


def run_esptool(port: str, command: list[str], *, final_reset: bool = False) -> str:
    args = [sys.executable, "-m", "esptool", "--chip", "esp32s3", "--port", port,
            "--baud", "460800", "--after", "hard-reset" if final_reset else "no-reset"] + command
    # Capture for validation but display progress; no hardware identifiers are uploaded.
    process = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                               text=True, encoding="utf-8", errors="replace")
    output: list[str] = []
    assert process.stdout is not None
    try:
        for line in process.stdout:
            print(line, end="", flush=True)
            output.append(line)
        status = process.wait()
    except BaseException:
        process.terminate()
        process.wait()
        raise
    if status:
        raise FlashError("esptool meldet einen Fehler. Keine automatische Wiederholung des Schreibens.")
    return re.sub(r"\x1b\[[0-9;]*[A-Za-z]", "", "".join(output))


def install(port: str, firmware: Path, work: Path) -> Path:
    check_firmware(firmware)
    print("\nPruefe ESP32-S3 und 16-MB-Flash ...", flush=True)
    identity = run_esptool(port, ["chip-id"])
    if "ESP32-S3" not in identity:
        raise FlashError("Erwarteter ESP32-S3 nicht bestaetigt. Abbruch vor dem Schreiben.")
    flash = run_esptool(port, ["flash-id"])
    if not re.search(r"Detected flash size:\s*16\s*MB\b", flash, re.IGNORECASE):
        raise FlashError("16-MB-Flash nicht bestaetigt. Abbruch vor dem Schreiben.")
    security = run_esptool(port, ["get-security-info"])
    if not all(re.search(label + r":\s*Disabled\b", security, re.IGNORECASE)
               for label in ["Secure Boot", "Flash Encryption"]):
        raise FlashError("Sicherheitskonfiguration passt nicht zum Testimage. Abbruch vor dem Schreiben.")

    stamp = time.strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:8]
    backup = work / f"PRIVATE-backup-{stamp}.bin"
    partial = backup.with_suffix(".partial")
    print("\nSichere vollstaendigen Flash. Dieses Backup bleibt auf deinem PC ...", flush=True)
    run_esptool(port, ["read-flash", "0x0", "0x1000000", str(partial)])
    if not partial.exists() or partial.stat().st_size != FLASH_BYTES:
        raise FlashError("Vollbackup ist unvollstaendig. Firmware wurde nicht geschrieben.")
    partial.replace(backup)
    digest = hashlib.sha256(backup.read_bytes()).hexdigest()
    backup.with_suffix(".sha256").write_text(f"{digest}  {backup.name}\n", encoding="utf-8")
    print(f"\nPrivates Backup: {backup}\nNicht auf GitHub oder in den Chat hochladen.", flush=True)
    print("\nInstalliere gepruefte Bruce-Control-Firmware ...", flush=True)
    run_esptool(port, ["write-flash", "0x0", str(firmware)])
    print("\nVergleiche geschriebenen Flash mit der Firmware ...", flush=True)
    run_esptool(port, ["verify-flash", "0x0", str(firmware)], final_reset=True)
    return backup


def main() -> int:
    parser = argparse.ArgumentParser(description="Bruce Control lokal sichern, flashen und pruefen")
    parser.add_argument("--port", help="Optionaler Anschluss, z.B. COM5")
    parser.add_argument("--work-dir", type=Path, default=Path.cwd() / "bruce-control-flash")
    options = parser.parse_args()
    work = options.work_dir.resolve()
    work.mkdir(parents=True, exist_ok=True)
    print("Bruce Control fuer LILYGO T-Embed CC1101 / Plus (ESP32-S3, 16 MB).")
    print("Eine SD-Karte bitte separat sichern; das Flash-Backup enthaelt nicht die SD-Karte.")
    try:
        firmware = download_firmware(work)
        print("Firmware-Pruefsumme stimmt.")
        port = choose_port(options.port)
        print(f"Verwende {port}.")
        backup = install(port, firmware, work)
    except KeyboardInterrupt:
        print("\nAbgebrochen. Nicht waehrend des Schreibens vom USB trennen.", file=sys.stderr)
        return 130
    except (FlashError, OSError, ImportError) as error:
        print(f"\nFEHLER: {error}", file=sys.stderr)
        print("Browser-Flasher/Serial-Monitor schliessen. Bei Verbindungsfehlern: BOOT halten, RESET kurz druecken, BOOT loslassen und neu starten.", file=sys.stderr)
        print(f"Vorhandene private Backups liegen in: {work}", file=sys.stderr)
        return 1
    print("\nERFOLGREICH: Firmware geschrieben und Flash-Inhalt verifiziert. Geraet neu gestartet.")
    print(f"Backup: {backup}")
    print("Jetzt Hotspot verbinden und am Bruce Config > Bruce Control > Pair iPhone waehlen.")
    print("PWA: https://paiblo.github.io/bruce-control/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
