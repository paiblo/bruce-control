#!/usr/bin/env python3
"""Apply bridge to the pinned, separate Bruce checkout. Never edits other projects."""
from pathlib import Path
import shutil, subprocess, sys
root=Path(__file__).resolve().parent
checkout=Path(sys.argv[1]) if len(sys.argv)>1 else root/'upstream'
commit='a59213f3ec6cd302fa32c2042b2700c9c24d991a'
if not checkout.exists():
 subprocess.run(['git','clone','https://github.com/BruceDevices/firmware.git',str(checkout)],check=True)
 subprocess.run(['git','-C',str(checkout),'checkout',commit],check=True)
actual=subprocess.check_output(['git','-C',str(checkout),'rev-parse','HEAD'],text=True).strip()
if actual!=commit:raise SystemExit('Unsupported Bruce revision: '+actual)
for f in (root/'bridge').glob('*'):shutil.copy(f,checkout/'src/core'/f.name)
def patch(file,old,new):
 p=checkout/file;s=p.read_text()
 if new in s:return
 if old not in s:raise SystemExit('Patch context missing: '+str(file))
 p.write_text(s.replace(old,new,1))
patch(Path('src/main.cpp'),'#include <globals.h>','#include <globals.h>\n#include "core/control_bridge.h"')
patch(Path('src/main.cpp'),'    startSerialCommandsHandlerTask(true);','    controlBridgeStart();\n    startSerialCommandsHandlerTask(true);')
patch(Path('src/core/serialcmds.cpp'),'#include "serialcmds.h"','#include "serialcmds.h"\n#include "control_bridge.h"')
patch(Path('src/core/serialcmds.cpp'),'    CmdPacket packet;\n    if (cmdQueue','    controlBridgePoll();\n    CmdPacket packet;\n    if (cmdQueue')
patch(Path('src/core/menu_items/ConfigMenu.cpp'),'#include "ConfigMenu.h"','#include "ConfigMenu.h"\n#include "core/control_bridge.h"')
patch(Path('src/core/menu_items/ConfigMenu.cpp'),'        localOptions.push_back({"About", showDeviceInfo});','        localOptions.push_back({"Bruce Control", controlBridgeMenu});\n        localOptions.push_back({"About", showDeviceInfo});')
for filename,cls in [('gps_tracker.cpp','GPSTracker'),('wardriving.cpp','Wardriving')]:
 f=Path('src/modules/gps')/filename
 patch(f,f'void {cls}::set_position() {{',f'void {cls}::set_position() {{\n    controlBridgeGNSS(gps.location.lat(), gps.location.lng(), gps.satellites.isValid() ? gps.satellites.value() : -1, gps.hdop.isValid() ? gps.hdop.hdop() : 0);')
 p=checkout/f;s=p.read_text();inc='#include "core/control_bridge.h"\n'
 if inc not in s:p.write_text(inc+s)
p=checkout/'platformio.ini';s=p.read_text().replace('fastled/FastLED @^3.10.3','fastled/FastLED @3.10.3')
if 'links2004/WebSockets' not in s:s=s.replace('lib_deps =\n','lib_deps =\n\tlinks2004/WebSockets@2.7.2\n',1)
p.write_text(s)
print('Bridge applied to',checkout)

# Upstream IR receive handler leaked its allocated reader on timeout.
patch(Path("src/core/serial_commands/ir_commands.cpp"),"    if (r.length() == 0) return false;","    if (r.length() == 0) { delete i; return false; }")

# pioarduino 55 uses the unified Xtensa package; upstream patch.py names an obsolete package.
p=checkout/'patch.py';s=p.read_text()
s=s.replace('"pio pkg exec -p toolchain-xtensa-%s -- xtensa-%s-elf-objcopy  --weaken-symbol=ieee80211_raw_frame_sanity_check %s %s"\n            % (mcu, mcu, original_file, patched_file)',
            '\'"%s" --weaken-symbol=ieee80211_raw_frame_sanity_check "%s" "%s"\'\n            % (join(env.PioPlatform().get_package_dir("toolchain-xtensa-esp-elf"), "bin", "xtensa-%s-elf-objcopy" % mcu), original_file, patched_file)')
# Never rename the original archive after a failed external tool invocation.
s=s.replace('    if isfile("%s.old" % (original_file)):', '    if not isfile(patched_file):\n        raise RuntimeError("Upstream WiFi archive patch failed; original preserved")\n\n    if isfile("%s.old" % (original_file)):')
p.write_text(s)

# Remove upstream credential-extraction and reverse-shell demonstration payloads.
# These functions are not required for Bruce Control or the user's device-control use case.
import re
p=checkout/'src/modules/ble/BLE_Suite.cpp';s=p.read_text()
s=s.replace('    scripts[scriptCount++] = "Example: WiFi Credentials";\n','')
s=s.replace('    scripts[scriptCount++] = "Example: Reverse Shell";\n','')
s=re.sub(r'\} else if \(scriptName == "WiFi Credentials"\) \{.*?\} else if \(scriptName == "Rickroll"\) \{', '} else if (scriptName == "Rickroll") {',s,flags=re.S)
if 'TCPClient' in s or 'key=clear' in s:
    raise SystemExit('Unwanted BLE demonstration payload remains; stop build for review')
p.write_text(s)
