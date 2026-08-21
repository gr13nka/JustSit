#!/usr/bin/env python3
"""
Re-lift the drawings, palettes and icons out of the app and into tools/.

The pages under tools/ are copies — they have to be, since a file:// page cannot
import TypeScript and a build step is what would let them rot. This is what
keeps the copies honest: run it after redrawing a plant, adding a species, or
moving a colour, and every page is current again.

    python3 tools/lab-data.py

It rewrites one line of each target (`const DATA = ...;`) and nothing else, so
anything tuned in a page's own code survives. Add a page here when it needs the
app's drawings; the anchor line is the whole contract between them.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TARGETS = [
    ROOT / 'tools' / 'anim-lab.html',    # the motion bench
    ROOT / 'tools' / 'field-demo.html',  # the field
]


def strip_comments(text):
    return re.sub(r'^\s*//.*$', '', text, flags=re.M)


def block(text, opener, closer='\n};'):
    i = text.index(opener) + len(opener)
    return text[i:text.index(closer, i)]


def strings(text):
    return re.findall(r"'([^']*)'", text)


def entries(body):
    """Each `  name: { … },` or `  name: [ … ],` at one level of indent."""
    return re.finditer(r'^  (\w+): [\{\[]\n(.*?)^  [\}\]],$', body, flags=re.M | re.S)


def read(rel):
    return (ROOT / rel).read_text()


def species():
    body = block(strip_comments(read('src/ui/Plant.tsx')),
                 'const SPECIES: Record<PlantKey, Species> = {')
    out = {}
    for m in entries(body):
        name, chunk = m.group(1), m.group(2)
        g = chunk.index('growth: [')
        entry = {'growth': strings(chunk[g:chunk.index(']', g)])}
        if 'bloom:' in chunk:
            p = chunk.index('paths: [')
            entry['bloom'] = {
                'pen': re.search(r"pen: '(\w+)'", chunk).group(1),
                'paths': strings(chunk[p:chunk.index('\n      ]', p)]),
            }
        out[name] = entry
    return out


def themes():
    src = strip_comments(read('src/theme/themes.ts'))
    hexes = lambda t: dict(re.findall(r"(\w+): '(#[0-9A-Fa-f]{6})'", t))
    cream = hexes(block(src, 'const CREAM_PENS = {', '\n} as const;'))
    out = {}
    for m in entries(block(src, 'export const THEMES: Record<ThemeId, Theme> = {')):
        tid, chunk = m.group(1), m.group(2)
        palette = hexes(chunk)
        if '...CREAM_PENS' in chunk:
            palette.update(cream)
        palette['name'] = re.search(r"name: '([^']+)'", chunk).group(1)
        out[tid] = palette
    return out


def icons():
    body = block(read('src/ui/icons.paths.ts'),
                 'export const ICON_PATHS = {', '\n} as const;')
    return {m.group(1): strings(m.group(2)) for m in entries(body)}


data = {'species': species(), 'themes': themes(), 'icons': icons()}
line = 'const DATA = ' + json.dumps(data, separators=(',', ':')) + ';'

for target in TARGETS:
    html = target.read_text()
    patched, n = re.subn(r'^const DATA = .*;$', lambda _: line, html, count=1, flags=re.M)
    if n != 1:
        sys.exit(f'{target.name} has no `const DATA = …;` line to replace.')
    target.write_text(patched)
    print(f'{target.relative_to(ROOT)}: {len(data["species"])} species, '
          f'{len(data["themes"])} themes, {len(data["icons"])} icons')
