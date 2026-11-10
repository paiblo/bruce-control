#!/usr/bin/env python3
"""Read Xtensa ENTRY stack reservations from the built ELF, never device memory."""
import argparse
import json
from elftools.elf.elffile import ELFFile


def frames(path):
    result = {}
    with open(path, 'rb') as stream:
        elf = ELFFile(stream)
        for symbol in elf.get_section_by_name('.symtab').iter_symbols():
            name = symbol.name
            key = ('bridge_execute' if name.startswith('_ZN12_GLOBAL__N_17execute') else
                   'serial_handler' if name.startswith('_Z20handleSerialCommands') else None)
            if not key:
                continue
            address = symbol['st_value']
            for segment in elf.iter_segments():
                if segment['p_type'] == 'PT_LOAD' and segment['p_vaddr'] <= address < segment['p_vaddr'] + segment['p_filesz']:
                    offset = address - segment['p_vaddr']
                    instruction = int.from_bytes(segment.data()[offset:offset+3], 'little')
                    if instruction & 0xfff != 0x136:
                        raise RuntimeError('Expected Xtensa ENTRY a1 instruction for ' + name)
                    result[key] = ((instruction >> 12) & 0xfff) * 8
                    break
    if 'serial_handler' not in result:
        raise RuntimeError('Serial task handler symbol not found')
    # After removing the large buffers LTO may inline execute into this handler.
    result['combined_static_frames'] = sum(result.values())
    result['execute_inlined_into_handler'] = 'bridge_execute' not in result
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('elf')
    parser.add_argument('--check', action='store_true')
    options = parser.parse_args()
    report = frames(options.elf)
    print(json.dumps(report, indent=2))
    if options.check and report['combined_static_frames'] > 8192 - 2048:
        raise SystemExit('Insufficient stack reserve for nested calls on 8192-byte CLI task')
