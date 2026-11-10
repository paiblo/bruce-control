param([string]$Port = 'COM3')
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $Directory = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'BruceControl\Flash'
  $Python = Join-Path $Directory '.venv\Scripts\python.exe'
  if (-not (Test-Path $Python)) { throw 'Die bereits installierte Python-Umgebung wurde nicht gefunden.' }
  $Backups = @(Get-ChildItem $Directory -Filter 'PRIVATE-backup-*.bin' | Sort-Object LastWriteTime -Descending)
  $Backup = $null
  foreach ($Candidate in $Backups) {
    $ChecksumFile = [IO.Path]::ChangeExtension($Candidate.FullName, '.sha256')
    if ($Candidate.Length -ne 16777216 -or -not (Test-Path $ChecksumFile)) { continue }
    $ExpectedBackupHash = ((Get-Content $ChecksumFile -Raw).Trim() -split '\s+')[0]
    if ((Get-FileHash $Candidate.FullName -Algorithm SHA256).Hash -eq $ExpectedBackupHash) { $Backup = $Candidate; break }
  }
  if (-not $Backup) { throw 'Kein vollstaendiges 16-MB-Backup mit passender Pruefsumme gefunden. Abbruch ohne Schreiben.' }
  Write-Host "Vorhandenes privates Backup geprueft: $($Backup.FullName)"
  $Firmware = Join-Path $Directory 'bruce-control-test2-merged.bin'
  Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/paiblo/bruce-control/releases/download/v0.1.0-test.2/bruce-control-test2-merged.bin' -OutFile $Firmware
  if ((Get-FileHash $Firmware -Algorithm SHA256).Hash.ToLowerInvariant() -ne '154a65cf5d97afebbc2b0be7e02f9d394e14f816e336b422356689f3f9a25a23') { throw 'Firmware-Pruefsumme stimmt nicht. Abbruch ohne Schreiben.' }
  function Invoke-Device {
    param([string[]]$Arguments, [switch]$Restart)
    $After = 'no-reset'
    if ($Restart) { $After = 'hard-reset' }
    $Output = & $Python -m esptool --chip esp32s3 --port $Port --baud 115200 --no-stub --after $After @Arguments 2>&1
    $Status = $LASTEXITCODE
    $Output | ForEach-Object { Write-Host $_ }
    if ($Status -ne 0) { throw 'esptool-Fehler. Keine automatische Wiederholung des Schreibens.' }
    return ($Output -join "`n")
  }
  $Identity = Invoke-Device -Arguments @('chip-id')
  if ($Identity -notmatch 'ESP32-S3') { throw 'ESP32-S3 nicht bestaetigt.' }
  $Flash = Invoke-Device -Arguments @('flash-id')
  if ($Flash -notmatch 'Detected flash size:\s*16\s*MB\b') { throw '16-MB-Flash nicht bestaetigt.' }
  $Security = Invoke-Device -Arguments @('get-security-info')
  if ($Security -notmatch 'Secure Boot:\s*Disabled\b' -or $Security -notmatch 'Flash Encryption:\s*Disabled\b') { throw 'Sicherheitskonfiguration passt nicht zum Testimage.' }
  Write-Host 'Installiere Testversion 2. USB-Kabel angeschlossen lassen.'
  $null = Invoke-Device -Arguments @('write-flash', '0x0', $Firmware)
  $null = Invoke-Device -Arguments @('verify-flash', '0x0', $Firmware) -Restart
  Write-Host 'ERFOLGREICH: Firmware geschrieben, verifiziert und Geraet neu gestartet.' -ForegroundColor Green
} catch {
  Write-Host "FEHLER: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host 'Bei ESET-Meldungen den vollstaendigen Fundnamen pruefen. Keine automatische Ausnahme oder Schutzabschaltung.'
  exit 1
}
