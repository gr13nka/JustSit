# /// script
# requires-python = ">=3.10"
# dependencies = ["pillow", "numpy"]
# ///
"""Turn a scanned drawing sheet into SVG path data on the app's 48-unit canvas.

Usage:  uv run scripts/trace-art.py art/scans/sheet1-icons.jpg icons

The sheet generator owns where every box landed and writes it to
`*.manifest.json`; this reads that rather than re-deriving any geometry, so the
two can never drift apart.

Four things happen to each drawing, and three of them are about not lying:

- **Registration.** The four corner marks are the only solid black outside the
  boxes, so they survive any threshold and any resize. They give a scale and an
  offset, which is what lets the scan come back from a phone, a camera or a
  messaging app that quietly resampled it.
- **Threshold, then despeckle.** The guides are printed grey and the ink is
  black, so one cut at mid-grey removes every guide line. What it does not
  remove is JPEG ringing, so anything smaller than a fraction of a nib is
  dropped as a connected component rather than by an opening — an opening of
  that radius would also eat a thin stroke, and thin strokes are exactly what a
  hand produces at the end of a flick.
- **Supersample.** potrace traces a bitmap boundary, so its output is only as
  smooth as the pixel grid it read. Scaling up with a smooth filter *before*
  thresholding puts the edge back where the sub-pixel evidence says it was.
- **Normalise by the box, never by the mark.** Each drawing is mapped onto 48
  units through its printed box, so a small mark stays small and a heavy pen
  stays heavy. Fitting each drawing to its own bounding box instead would
  silently rescale every stroke width on the sheet to a different value, which
  is the one error that cannot be seen until all eighteen sit side by side.
"""
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
INK = 128            # mid-grey: guides print above it, a pen lands below it
# Enough to put the stroke edge back where the sub-pixel evidence says it was,
# without tracing the messenger's JPEG ringing as if it were pen texture. The
# blur is what actually buys the size: unsmoothed, the same six marks trace to
# 41KB of path data instead of 16KB, and look identical at every size drawn.
SUPERSAMPLE = 2
BLUR = 2.5
SPECKLE = 0.12       # drop components smaller than this fraction of a nib, squared
PREC = 1             # 0.1 of a unit — a twentieth of a pixel at tab-bar size


def find_corners(ink, page, corners):
    """The scan-to-page transform, read off the four registration marks."""
    h, w = ink.shape
    found = []
    for px, py in corners:
        cx, cy = px * w / page["w"], py * h / page["h"]
        r = max(w, h) // 20
        x0, x1 = int(max(0, cx - r)), int(min(w, cx + r))
        y0, y1 = int(max(0, cy - r)), int(min(h, cy + r))
        ys, xs = np.nonzero(ink[y0:y1, x0:x1])
        if len(xs) == 0:
            raise SystemExit(f"No registration mark near page ({px},{py}). Is the whole sheet in frame?")
        vx = x0 + (xs.min() if px < page["w"] / 2 else xs.max())
        vy = y0 + (ys.min() if py < page["h"] / 2 else ys.max())
        found.append((vx, vy))

    (ax, ay), (bx, by), (cx_, cy_), (dx, dy) = found
    sx = ((bx - ax) + (dx - cx_)) / 2 / (corners[1][0] - corners[0][0])
    sy = ((cy_ - ay) + (dy - by)) / 2 / (corners[2][1] - corners[0][1])
    ox = (ax - corners[0][0] * sx + cx_ - corners[2][0] * sx) / 2
    oy = (ay - corners[0][1] * sy + by - corners[1][1] * sy) / 2
    if abs(sx - sy) > 0.01:
        raise SystemExit(f"Sheet is skewed (x scale {sx:.4f} vs y {sy:.4f}). Re-shoot it flat.")
    return sx, sy, ox, oy


def pen_width(mask):
    """Measured stroke width in pixels, from area over perimeter.

    A stroke of width w and length L has area wL and an outline of about 2L, so
    2 x area / perimeter recovers w and is barely affected by how long or how
    curved the stroke is. This is the number that goes wrong when a sheet is
    drawn with the wrong brush, and the only one that cannot be repaired
    afterwards — a trace can be re-run, a pen weight has to be re-drawn.
    """
    edge = (
        (mask != np.roll(mask, 1, 0)) | (mask != np.roll(mask, -1, 0))
        | (mask != np.roll(mask, 1, 1)) | (mask != np.roll(mask, -1, 1))
    ) & mask
    return 2 * mask.sum() / max(1, edge.sum())


def despeckle(mask, nib_px):
    """Drop ink blobs too small to be a deliberate mark. Flood fill, no scipy."""
    limit = max(4, int((SPECKLE * nib_px) ** 2))
    h, w = mask.shape
    seen = np.zeros_like(mask)
    out = np.zeros_like(mask)
    for sy in range(h):
        for sx in range(w):
            if not mask[sy, sx] or seen[sy, sx]:
                continue
            stack, blob = [(sy, sx)], []
            seen[sy, sx] = True
            while stack:
                y, x = stack.pop()
                blob.append((y, x))
                for ny, nx in ((y-1, x), (y+1, x), (y, x-1), (y, x+1)):
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
            if len(blob) >= limit:
                for y, x in blob:
                    out[y, x] = True
    return out


def trace(bitmap, box_px, size=48.0):
    """potrace the crop, then bake its own transform into 48-unit coordinates."""
    with tempfile.TemporaryDirectory() as tmp:
        pbm, svg = Path(tmp) / "m.pbm", Path(tmp) / "m.svg"
        Image.fromarray((~bitmap * 255).astype(np.uint8), "L").convert("1").save(pbm)
        subprocess.run(
            ["potrace", "-s", "-a", "1.0", "-O", "1.0", "-t", "2", "-o", str(svg), str(pbm)],
            check=True,
        )
        out = svg.read_text()

    # potrace emits `translate(0,H) scale(0.1,-0.1)` around path data in tenths.
    m = re.search(r"translate\(([\d.eE+-]+),([\d.eE+-]+)\)\s*scale\(([\d.eE+-]+),([\d.eE+-]+)\)", out)
    ty, kx, ky = float(m.group(2)), float(m.group(3)), float(m.group(4))
    k = size / box_px  # crop pixels -> canvas units

    def pt(x, y):
        return (x * kx * k, (ty + y * ky) * k)

    paths = []
    for d in re.findall(r'\sd="([^"]+)"', out):
        paths.append(rewrite(d, pt))
    return paths


def rewrite(d, pt):
    """Rewrite one absolute potrace path through `pt`. M/L/C/Z only, as emitted."""
    tokens = re.findall(r"[MLCZmlcz]|[-+]?[\d.]+(?:[eE][-+]?\d+)?", d)
    out, i, cur = [], 0, (0.0, 0.0)
    while i < len(tokens):
        cmd = tokens[i]
        i += 1
        if cmd in "Zz":
            out.append("Z")
            continue
        rel = cmd.islower()
        n = {"m": 2, "l": 2, "c": 6}[cmd.lower()]
        while i + n <= len(tokens) and not re.match(r"[A-Za-z]", tokens[i]):
            nums = [float(t) for t in tokens[i:i + n]]
            i += n
            abs_pts = []
            for j in range(0, n, 2):
                x, y = nums[j], nums[j + 1]
                if rel:
                    x, y = cur[0] + x, cur[1] + y
                abs_pts.append((x, y))
                if j + 2 == n:
                    cur = (x, y)
            letter = {"m": "M", "l": "L", "c": "C"}[cmd.lower()]
            out.append(letter + " ".join(f"{a:.{PREC}f},{b:.{PREC}f}" for a, b in map(lambda p: pt(*p), abs_pts)))
            if cmd.lower() == "m":
                cmd, rel = ("l" if rel else "L"), rel
                n = 2
    return "".join(out)


# The header band, in page units. Wide enough to hold every sheet's title, and
# stopping short of the scratch box, so a test stroke cannot reach it.
HEADER_BAND = (100, 20, 900, 150)


def identify(grey, manifest, sx, sy, ox, oy):
    """Which sheet this scan is, by matching its printed header to the templates.

    Every sheet has identical box geometry — only the printed words differ — so
    there is nothing in the drawings to tell them apart. What does tell them
    apart is that we rendered those words ourselves and still have the files.

    Comparing whole header bands barely separates them, because the bands are
    mostly paper and shared wording; on three real sheets the closest two came
    within 14% of each other. So the comparison runs only over the pixels where
    the templates disagree *with each other* — which is precisely the few hundred
    that spell the sheet's name. The mask is derived, not hand-placed, so it
    stays correct when a title is reworded or a fourth sheet appears.
    """
    x0, y0, x1, y1 = HEADER_BAND
    refs = {}
    for sheet in manifest["sheets"]:
        path = Path(manifest["_dir"]) / sheet["file"]
        if path.exists():
            refs[sheet["id"]] = np.asarray(
                Image.open(path).convert("L").crop((x0, y0, x1, y1)), dtype=float)
    if len(refs) < 2:
        return (next(iter(refs), None) or manifest["sheets"][0]["id"]), []

    stack = np.stack(list(refs.values()))
    telling = (stack.max(0) - stack.min(0)) > 40
    if telling.sum() < 200:
        raise SystemExit("Sheet titles are too alike to tell apart. Pass the sheet id explicitly.")

    got = np.asarray(grey.resize(
        (round(manifest["page"]["w"] * sx), round(manifest["page"]["h"] * sy))
    ).crop((round(x0 * sx), round(y0 * sy), round(x1 * sx), round(y1 * sy))).resize(
        (x1 - x0, y1 - y0), Image.LANCZOS), dtype=float)

    ranked = sorted(
        ((k, float(np.abs(got - ref)[telling].mean())) for k, ref in refs.items()),
        key=lambda kv: kv[1],
    )
    margin = ranked[1][1] / max(1e-6, ranked[0][1]) if len(ranked) > 1 else float("inf")
    if margin < 1.5:
        raise SystemExit(
            f"Cannot tell which sheet this is (closest two within {margin:.0%}: "
            f"{ranked[0][0]}, {ranked[1][0]}). Pass the sheet id explicitly."
        )
    return ranked[0][0], ranked


MANIFEST = ROOT / "art/templates/justsit.manifest.json"


def load_scan(scan, manifest_path):
    """The scan, and the sheet geometry it was drawn on.

    The manifest is a parameter rather than a constant because box size changes
    with the device's pen, and a scan drawn on a retired generation still has to
    be re-traceable — `art/templates/gen-480/` is exactly that case. Template
    images resolve beside their own manifest for the same reason.
    """
    manifest = json.loads(Path(manifest_path).read_text())
    manifest["_dir"] = str(Path(manifest_path).parent)
    grey = Image.open(scan).convert("L")
    ink = np.asarray(grey) < INK
    sx, sy, ox, oy = find_corners(ink, manifest["page"], manifest["corners"])
    return manifest, grey, sx, sy, ox, oy


def main():
    argv = sys.argv[1:]
    manifest_path = MANIFEST
    if "--manifest" in argv:
        i = argv.index("--manifest")
        manifest_path = argv[i + 1]
        del argv[i:i + 2]
    args = [a for a in argv if not a.startswith("--")]
    detect_only = "--detect" in argv
    if not args:
        raise SystemExit(
            "usage: trace-art.py <scan> [sheet-id] [--detect] [--manifest path]")
    scan = Path(args[0])

    manifest, grey, sx, sy, ox, oy = load_scan(scan, manifest_path)
    if len(args) > 1:
        sheet_id = args[1]
    else:
        sheet_id, ranked = identify(grey, manifest, sx, sy, ox, oy)
        if detect_only:
            print(sheet_id)
            return
        print("identified as sheet " + sheet_id + "  ("
              + ", ".join(f"{k} {v:.1f}" for k, v in ranked) + ", lower is closer)")
    if detect_only:
        print(sheet_id)
        return

    sheet = next((s for s in manifest["sheets"] if s["id"] == sheet_id), None)
    if sheet is None:
        raise SystemExit(f"No sheet {sheet_id!r}. Have: {[s['id'] for s in manifest['sheets']]}")

    nib_px = manifest["nib"] * sx
    print(f"{scan.name}: {grey.size[0]}x{grey.size[1]}  scale {sx:.4f}  offset ({ox:.1f},{oy:.1f})  nib {nib_px:.1f}px")

    traced, report = {}, []
    for c in sheet["cells"]:
        # Crop a hair inside the printed box so its own border never enters.
        pad = 3
        x0 = int(round(c["x"] * sx + ox)) + pad
        y0 = int(round(c["y"] * sy + oy)) + pad
        x1 = int(round((c["x"] + c["size"]) * sx + ox)) - pad
        y1 = int(round((c["y"] + c["size"]) * sy + oy)) - pad
        up = grey.crop((x0, y0, x1, y1)).resize(
            ((x1 - x0) * SUPERSAMPLE, (y1 - y0) * SUPERSAMPLE), Image.LANCZOS)
        up = up.filter(ImageFilter.GaussianBlur(BLUR))
        crop = np.asarray(up)
        mask = despeckle(crop < INK, nib_px * SUPERSAMPLE)
        if not mask.any():
            report.append((c["key"], 0, None))
            continue
        paths = trace(mask, (x1 - x0) * SUPERSAMPLE)
        traced[c["key"]] = paths
        # In canvas units, so it compares directly against the nominal nib.
        units = pen_width(mask) * 48.0 / ((x1 - x0) * SUPERSAMPLE)
        report.append((c["key"], len(paths), units))

    out = ROOT / "art/traced"
    out.mkdir(exist_ok=True)
    (out / f"{sheet_id}.json").write_text(json.dumps(traced, indent=1))
    # Kept beside the paths rather than inside them: the paths file is consumed by
    # codegen and must stay pure path data.
    (out / f"{sheet_id}.report.json").write_text(json.dumps({
        "scan": scan.name,
        "sheet": sheet_id,
        "nominalPen": manifest["nib"] / manifest["unit"],
        "marks": {k: {"paths": n, "pen": u} for k, n, u in report},
    }, indent=1))
    nominal = manifest["nib"] / manifest["unit"]      # 2.8 units, the doodle nib
    for key, n, units in report:
        if n == 0:
            print(f"  {key:12}   -  nothing drawn")
            continue
        ratio = units / nominal
        note = "" if 0.8 <= ratio <= 1.25 else ("  <- thin" if ratio < 0.8 else "  <- heavy")
        print(f"  {key:12} {n:3} paths   pen {units:4.2f} of {nominal:.1f} units ({ratio:.0%}){note}")

    drawn = [u for _, n, u in report if n]
    if drawn:
        mean = sum(drawn) / len(drawn)
        spread = max(drawn) / min(drawn)
        print(f"\n  sheet pen {mean:.2f} units ({mean / nominal:.0%} of nominal), "
              f"spread {spread:.2f}x across the sheet")
        if not 0.8 <= mean / nominal <= 1.25:
            print("  This sheet's brush missed the calibration bar. Re-draw rather than rescale:\n"
                  "  scaling a traced outline changes the mark's size, not its stroke weight.")
    print(f"\n-> art/traced/{sheet_id}.json")


main()
