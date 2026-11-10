param(
  [string]$Port = "",
  [string]$WorkDir = (Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'BruceControl\Flash')
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $PythonCommand = $null
  $PythonPrefix = @()
  foreach ($Candidate in @('py', 'python')) {
    if (-not (Get-Command $Candidate -ErrorAction SilentlyContinue)) { continue }
    $Prefix = @()
    if ($Candidate -eq 'py') { $Prefix = @('-3') }
    & $Candidate @Prefix -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)" 2>$null
    if ($LASTEXITCODE -eq 0) { $PythonCommand = $Candidate; $PythonPrefix = $Prefix; break }
  }
  if (-not $PythonCommand) {
    throw 'Python 3.10 oder neuer fehlt. Python von https://www.python.org/downloads/windows/ installieren und den Starter erneut ausfuehren.'
  }
  New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null
  $VenvDir = Join-Path $WorkDir '.venv'
  $VenvPython = Join-Path $VenvDir 'Scripts\python.exe'
  if (-not (Test-Path $VenvPython)) {
    & $PythonCommand @PythonPrefix -m venv $VenvDir
    if ($LASTEXITCODE -ne 0) { throw 'Python-Umgebung konnte nicht angelegt werden.' }
  }
  & $VenvPython -m pip --disable-pip-version-check install 'esptool==5.3.0'
  if ($LASTEXITCODE -ne 0) { throw 'esptool konnte nicht installiert werden.' }
  $InstallerPath = Join-Path $WorkDir 'flash_device.py'
  $InstallerUrl = 'https://raw.githubusercontent.com/paiblo/bruce-control/554402e58a3d2d9004eb0bf00bdacd2846751dd9/scripts/flash_device.py'
  Invoke-WebRequest -UseBasicParsing -Uri $InstallerUrl -OutFile $InstallerPath
  $ExpectedHash = '200bbaef191f320d450d5e02901e71f8ca6a42a0b12b9b9fbfed5d16adeca2ed'
  if ((Get-FileHash -Algorithm SHA256 $InstallerPath).Hash.ToLowerInvariant() -ne $ExpectedHash) {
    throw 'Pruefsumme des Flash-Starters stimmt nicht. Abbruch.'
  }
  $InstallerArgs = @($InstallerPath, '--work-dir', $WorkDir)
  if ($Port) { $InstallerArgs += @('--port', $Port) }
  & $VenvPython @InstallerArgs
  if ($LASTEXITCODE -ne 0) { throw 'Flashvorgang wurde nicht erfolgreich abgeschlossen. Die Meldungen oben beachten.' }
} catch {
  Write-Host "`nFEHLER: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
