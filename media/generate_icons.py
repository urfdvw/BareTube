"""
Generate SVG + PNG icons for BareTube.
Run from repo root: python3 media/generate_icons.py
Outputs:
  public/logo.svg
  public/icons/icon-192.png
  public/icons/icon-512.png

Shape: 4 cubic bezier curves, one per quadrant.
Anchors at top/right/bottom/left apexes with collinear handles
→ guaranteed G1-smooth everywhere, no arc/bezier junction seams.

On a 512×512 canvas:
  T=(256,88)  R=(490,256)  B=(256,424)  L=(22,256)
  Horizontal handle reach: 200  |  Vertical handle reach: 140

SVG path:
  M 256 88
  C 456 88  490 116  490 256
  C 490 396 456 424  256 424
  C  56 424  22 396   22 256
  C  22 116  56  88  256  88 Z
"""

import math
from pathlib import Path
from PIL import Image, ImageDraw

ROOT    = Path(__file__).parent.parent
SVG_OUT = ROOT / "public" / "logo.svg"
PNG_DIR = ROOT / "public" / "icons"

# ── shape parameters (512×512 canvas) ────────────────────────────────────────

T  = (256,  88)   # top apex
R  = (490, 256)   # right apex
B  = (256, 424)   # bottom apex
L  = (22,  256)   # left apex
HT = 200          # horizontal handle reach (from T / B)
HR = 140          # vertical   handle reach (from R / L)

SVG_PATH = (
    f"M {T[0]} {T[1]} "
    f"C {T[0]+HT} {T[1]} {R[0]} {R[1]-HR} {R[0]} {R[1]} "
    f"C {R[0]} {R[1]+HR} {B[0]+HT} {B[1]} {B[0]} {B[1]} "
    f"C {B[0]-HT} {B[1]} {L[0]} {L[1]+HR} {L[0]} {L[1]} "
    f"C {L[0]} {L[1]-HR} {T[0]-HT} {T[1]} {T[0]} {T[1]} Z"
)

# ── SVG ──────────────────────────────────────────────────────────────────────

SVG_OUT.write_text(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">\n'
    f'  <path d="{SVG_PATH}" fill="#FF0000"/>\n'
    f'</svg>\n'
)
print(f"Written {SVG_OUT}")

# ── PNG rasteriser ────────────────────────────────────────────────────────────

def cubic_bezier(p0, cp1, cp2, p1, steps=120):
    pts = []
    for i in range(steps + 1):
        t  = i / steps
        u  = 1 - t
        x  = u**3*p0[0] + 3*u**2*t*cp1[0] + 3*u*t**2*cp2[0] + t**3*p1[0]
        y  = u**3*p0[1] + 3*u**2*t*cp1[1] + 3*u*t**2*cp2[1] + t**3*p1[1]
        pts.append((x, y))
    return pts

def pillow_polygon(size):
    s  = size / 512
    sc = lambda v: v * s

    t_  = (sc(T[0]),  sc(T[1]))
    r_  = (sc(R[0]),  sc(R[1]))
    b_  = (sc(B[0]),  sc(B[1]))
    l_  = (sc(L[0]),  sc(L[1]))
    ht_ = sc(HT)
    hr_ = sc(HR)

    pts  = cubic_bezier(t_, (t_[0]+ht_, t_[1]),  (r_[0], r_[1]-hr_), r_)
    pts += cubic_bezier(r_, (r_[0], r_[1]+hr_),  (b_[0]+ht_, b_[1]), b_)[1:]
    pts += cubic_bezier(b_, (b_[0]-ht_, b_[1]),  (l_[0], l_[1]+hr_), l_)[1:]
    pts += cubic_bezier(l_, (l_[0], l_[1]-hr_),  (t_[0]-ht_, t_[1]), t_)[1:]
    return pts

def make_logo(size):
    img  = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.polygon(pillow_polygon(size), fill="#FF0000")
    return img

for size in [192, 512]:
    path = PNG_DIR / f"icon-{size}.png"
    make_logo(size).save(path)
    print(f"Written {path}")
