"""No USB access: validate safety ordering and abort behavior with explicit fixtures."""
import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('flash_device', Path(__file__).resolve().parents[1] / 'scripts/flash_device.py')
flasher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(flasher)


class FlashTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.work = Path(self.temp.name)
        self.image = self.work / 'fixture.bin'
        self.image.write_bytes(b'explicit firmware fixture')
        self.bytes = patch.object(flasher, 'FIRMWARE_BYTES', self.image.stat().st_size)
        self.digest = patch.object(flasher, 'FIRMWARE_SHA256', hashlib.sha256(self.image.read_bytes()).hexdigest())
        self.bytes.start()
        self.digest.start()
        self.addCleanup(self.bytes.stop)
        self.addCleanup(self.digest.stop)
        self.addCleanup(self.temp.cleanup)

    def device(self, command, *, flash='Detected flash size: 16MB', security='Secure Boot: Disabled\nFlash Encryption: Disabled', backup=True):
        name = command[0]
        if name == 'chip-id': return 'Chip type: ESP32-S3 (QFN56)'
        if name == 'flash-id': return flash
        if name == 'get-security-info': return security
        if name == 'read-flash' and backup:
            with open(command[-1], 'wb') as output:
                output.truncate(flasher.FLASH_BYTES)
        return 'OK'

    def test_backup_before_write_and_verification_after_write(self):
        calls = []
        def run(port, command, **kwargs):
            calls.append((command[0], kwargs))
            return self.device(command)
        with patch.object(flasher, 'run_esptool', side_effect=run):
            backup = flasher.install('COM_TEST', self.image, self.work)
        self.assertEqual([c[0] for c in calls], ['chip-id', 'flash-id', 'get-security-info', 'read-flash', 'write-flash', 'verify-flash'])
        self.assertEqual(backup.stat().st_size, flasher.FLASH_BYTES)
        self.assertTrue(backup.with_suffix('.sha256').exists())
        self.assertTrue(calls[-1][1]['final_reset'])

    def test_bad_firmware_never_opens_device(self):
        self.image.write_bytes(b'bad')
        with patch.object(flasher, 'run_esptool') as run:
            with self.assertRaises(flasher.FlashError): flasher.install('COM_TEST', self.image, self.work)
            run.assert_not_called()

    def test_wrong_flash_size_aborts_before_backup_or_write(self):
        calls = []
        def run(port, command, **kwargs):
            calls.append(command[0])
            return self.device(command, flash='Detected flash size: 8MB')
        with patch.object(flasher, 'run_esptool', side_effect=run):
            with self.assertRaises(flasher.FlashError): flasher.install('COM_TEST', self.image, self.work)
        self.assertEqual(calls, ['chip-id', 'flash-id'])

    def test_incomplete_backup_prevents_write(self):
        calls = []
        def run(port, command, **kwargs):
            calls.append(command[0])
            return self.device(command, backup=False)
        with patch.object(flasher, 'run_esptool', side_effect=run):
            with self.assertRaises(flasher.FlashError): flasher.install('COM_TEST', self.image, self.work)
        self.assertNotIn('write-flash', calls)

    def test_enabled_encryption_prevents_write(self):
        calls = []
        def run(port, command, **kwargs):
            calls.append(command[0])
            return self.device(command, security='Secure Boot: Disabled\nFlash Encryption: Enabled')
        with patch.object(flasher, 'run_esptool', side_effect=run):
            with self.assertRaises(flasher.FlashError): flasher.install('COM_TEST', self.image, self.work)
        self.assertNotIn('read-flash', calls)
        self.assertNotIn('write-flash', calls)

    def test_verification_failure_does_not_report_success_and_preserves_backup(self):
        def run(port, command, **kwargs):
            if command[0] == 'verify-flash': raise flasher.FlashError('explicit verification failure')
            return self.device(command)
        with patch.object(flasher, 'run_esptool', side_effect=run):
            with self.assertRaises(flasher.FlashError): flasher.install('COM_TEST', self.image, self.work)
        self.assertEqual(len(list(self.work.glob('PRIVATE-backup-*.bin'))), 1)


if __name__ == '__main__': unittest.main()
