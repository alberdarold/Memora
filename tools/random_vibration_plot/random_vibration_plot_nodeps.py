#!/usr/bin/env python3
"""Zero-dependency variant of random_vibration_plot.

Same input as random_vibration_plot.py (CSV/TSV of the spectra table) but
uses only the Python standard library and emits a self-contained HTML file
with an inline SVG plot. No matplotlib, no pip install required.

Usage
-----
  py random_vibration_plot_nodeps.py --csv example_spectra.csv -o plot.html
  start plot.html
"""

from __future__ import annotations

import argparse
import csv
import math
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple


Series = Dict[str, List[Tuple[float, float]]]

_NULL_TOKENS = {"", "-", "--", "—", "/", "n/a", "na", "nan", "none"}

PALETTE = [
    "#e6b800", "#1f3a93", "#5dade2", "#000000",
    "#e74c3c", "#27ae60", "#8e44ad", "#d35400",
    "#16a085", "#7f8c8d",
]

MARKERS = ["circle", "square", "diamond", "triangle-up", "triangle-down",
           "plus", "cross", "star"]


# ---------------------------------------------------------------------------
# Numeric / table parsing (same rules as the matplotlib version)
# ---------------------------------------------------------------------------


def _to_float(cell, decimal: str = "auto") -> Optional[float]:
    if cell is None:
        return None
    s = str(cell).strip()
    if not s or s.lower() in _NULL_TOKENS:
        return None
    s = re.sub(r"[^\d.,eE+\-]", "", s)
    if not s or s in {".", ",", "-", "+"}:
        return None

    if decimal == "comma":
        s = s.replace(".", "").replace(",", ".")
    elif decimal == "dot":
        s = s.replace(",", "")
    else:
        has_dot = "." in s
        has_comma = "," in s
        if has_dot and has_comma:
            if s.rfind(",") > s.rfind("."):
                s = s.replace(".", "").replace(",", ".")
            else:
                s = s.replace(",", "")
        elif has_comma:
            parts = s.split(",")
            if (len(parts) == 2 and len(parts[1]) == 3
                    and parts[0].lstrip("+-").isdigit() and parts[1].isdigit()):
                s = s.replace(",", "")
            else:
                s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def _looks_like_totals_row(label: str) -> bool:
    if not label:
        return False
    norm = re.sub(r"[\s_]+", "", label.lower())
    return any(tok in norm for tok in ("grms", "gms", "aeff", "rms"))


def parse_rows(rows: Sequence[Sequence[str]], decimal: str = "auto") -> Tuple[List[str], Series]:
    normalised = [["" if c is None else str(c) for c in r] for r in rows]
    cleaned = [r for r in normalised if any(c.strip() for c in r)]
    if len(cleaned) < 2:
        raise ValueError("Not enough rows to form a table.")
    header = [c.strip() for c in cleaned[0]]
    if len(header) < 2:
        raise ValueError("Header must have at least two columns.")

    data_start = 1
    first_cell = cleaned[1][0].strip() if cleaned[1] else ""
    if first_cell and _to_float(first_cell, decimal) is None:
        data_start = 2

    series_cols = [(i, name) for i, name in enumerate(header[1:], start=1) if name]
    if not series_cols:
        raise ValueError("No series columns found in the header.")
    names = [name for _, name in series_cols]
    series: Series = {name: [] for name in names}

    for row in cleaned[data_start:]:
        label = row[0].strip() if row else ""
        if _looks_like_totals_row(label):
            continue
        freq = _to_float(label, decimal)
        if freq is None or freq <= 0:
            continue
        for col_idx, name in series_cols:
            if col_idx >= len(row):
                continue
            v = _to_float(row[col_idx], decimal)
            if v is None or v <= 0:
                continue
            series[name].append((freq, v))
    for name in series:
        series[name].sort(key=lambda fv: fv[0])
    return names, series


def _sniff_dialect(sample: str) -> csv.Dialect:
    try:
        return csv.Sniffer().sniff(sample, delimiters=",;\t|")
    except csv.Error:
        class _D(csv.excel):
            delimiter = ","
        return _D()


def read_csv(path: Path, decimal: str = "auto",
             delimiter: Optional[str] = None) -> Tuple[List[str], Series]:
    with path.open(newline="", encoding="utf-8-sig") as fh:
        sample = fh.read(4096)
        fh.seek(0)
        reader = (csv.reader(fh, delimiter=delimiter) if delimiter
                  else csv.reader(fh, dialect=_sniff_dialect(sample)))
        rows = list(reader)
    return parse_rows(rows, decimal=decimal)


# ---------------------------------------------------------------------------
# SVG rendering
# ---------------------------------------------------------------------------


def _nice_log_bounds(values: List[float]) -> Tuple[float, float]:
    lo = min(values)
    hi = max(values)
    return (10.0 ** math.floor(math.log10(lo)),
            10.0 ** math.ceil(math.log10(hi)))


def _decades(lo: float, hi: float) -> List[float]:
    a = int(math.floor(math.log10(lo)))
    b = int(math.ceil(math.log10(hi)))
    return [10.0 ** k for k in range(a, b + 1)]


def _fmt_decade(v: float) -> str:
    exp = int(round(math.log10(v)))
    if -3 <= exp <= 4:
        if exp >= 0:
            return f"{int(v):,}".replace(",", "'")
        return f"{v:g}"
    return f"1e{exp}"


def _marker_svg(kind: str, cx: float, cy: float, size: float, color: str) -> str:
    s = size
    if kind == "circle":
        return f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{s:.2f}" fill="{color}" stroke="{color}"/>'
    if kind == "square":
        return f'<rect x="{cx-s:.2f}" y="{cy-s:.2f}" width="{2*s:.2f}" height="{2*s:.2f}" fill="{color}"/>'
    if kind == "diamond":
        pts = f"{cx},{cy-s} {cx+s},{cy} {cx},{cy+s} {cx-s},{cy}"
        return f'<polygon points="{pts}" fill="{color}"/>'
    if kind == "triangle-up":
        pts = f"{cx},{cy-s} {cx+s},{cy+s} {cx-s},{cy+s}"
        return f'<polygon points="{pts}" fill="{color}"/>'
    if kind == "triangle-down":
        pts = f"{cx},{cy+s} {cx+s},{cy-s} {cx-s},{cy-s}"
        return f'<polygon points="{pts}" fill="{color}"/>'
    if kind == "plus":
        return (f'<line x1="{cx-s}" y1="{cy}" x2="{cx+s}" y2="{cy}" stroke="{color}" stroke-width="2"/>'
                f'<line x1="{cx}" y1="{cy-s}" x2="{cx}" y2="{cy+s}" stroke="{color}" stroke-width="2"/>')
    if kind == "cross":
        return (f'<line x1="{cx-s}" y1="{cy-s}" x2="{cx+s}" y2="{cy+s}" stroke="{color}" stroke-width="2"/>'
                f'<line x1="{cx-s}" y1="{cy+s}" x2="{cx+s}" y2="{cy-s}" stroke="{color}" stroke-width="2"/>')
    return f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{s:.2f}" fill="{color}"/>'


def render_svg(names: List[str], series: Series, title: str,
               xlabel: str, ylabel: str,
               xlim: Optional[Tuple[float, float]],
               ylim: Optional[Tuple[float, float]],
               width: int = 1000, height: int = 600) -> str:

    all_x = [f for pts in series.values() for f, _ in pts]
    all_y = [v for pts in series.values() for _, v in pts]
    if not all_x or not all_y:
        raise ValueError("No data points to plot.")

    xmin, xmax = xlim if xlim else _nice_log_bounds(all_x)
    ymin, ymax = ylim if ylim else _nice_log_bounds(all_y)

    L, R, T, B = 90, 200, 50, 70  # margins (right margin holds legend)
    plot_w = width - L - R
    plot_h = height - T - B
    lxmin, lxmax = math.log10(xmin), math.log10(xmax)
    lymin, lymax = math.log10(ymin), math.log10(ymax)

    def px(x: float) -> float:
        return L + (math.log10(x) - lxmin) / (lxmax - lxmin) * plot_w

    def py(y: float) -> float:
        return T + (lymax - math.log10(y)) / (lymax - lymin) * plot_h

    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" '
        f'font-family="Segoe UI, Arial, sans-serif" font-size="12">',
        f'<rect width="{width}" height="{height}" fill="white"/>',
    ]

    # Minor gridlines (2..9 in each decade)
    for dec in _decades(xmin, xmax):
        for k in range(2, 10):
            x = dec * k
            if xmin <= x <= xmax:
                X = px(x)
                out.append(f'<line x1="{X:.2f}" y1="{T}" x2="{X:.2f}" y2="{T+plot_h}" '
                           f'stroke="#ddd" stroke-width="0.5"/>')
    for dec in _decades(ymin, ymax):
        for k in range(2, 10):
            y = dec * k
            if ymin <= y <= ymax:
                Y = py(y)
                out.append(f'<line x1="{L}" y1="{Y:.2f}" x2="{L+plot_w}" y2="{Y:.2f}" '
                           f'stroke="#ddd" stroke-width="0.5"/>')

    # Major gridlines + tick labels
    for dec in _decades(xmin, xmax):
        if xmin <= dec <= xmax:
            X = px(dec)
            out.append(f'<line x1="{X:.2f}" y1="{T}" x2="{X:.2f}" y2="{T+plot_h}" '
                       f'stroke="#999" stroke-width="0.7"/>')
            out.append(f'<text x="{X:.2f}" y="{T+plot_h+18}" text-anchor="middle">{_fmt_decade(dec)}</text>')
    for dec in _decades(ymin, ymax):
        if ymin <= dec <= ymax:
            Y = py(dec)
            out.append(f'<line x1="{L}" y1="{Y:.2f}" x2="{L+plot_w}" y2="{Y:.2f}" '
                       f'stroke="#999" stroke-width="0.7"/>')
            out.append(f'<text x="{L-8}" y="{Y+4:.2f}" text-anchor="end">{_fmt_decade(dec)}</text>')

    # Plot frame
    out.append(f'<rect x="{L}" y="{T}" width="{plot_w}" height="{plot_h}" '
               f'fill="none" stroke="#333" stroke-width="1"/>')

    # Series
    for idx, name in enumerate(names):
        points = series.get(name, [])
        if not points:
            continue
        color = PALETTE[idx % len(PALETTE)]
        marker = MARKERS[idx % len(MARKERS)]
        coords = " ".join(f"{px(x):.2f},{py(y):.2f}" for x, y in points)
        out.append(f'<polyline points="{coords}" fill="none" stroke="{color}" stroke-width="1.4"/>')
        for x, y in points:
            out.append(_marker_svg(marker, px(x), py(y), 4, color))

    # Axis titles + plot title
    out.append(f'<text x="{L+plot_w/2}" y="{T+plot_h+50}" text-anchor="middle" font-size="13">{xlabel}</text>')
    out.append(f'<text x="20" y="{T+plot_h/2}" text-anchor="middle" font-size="13" '
               f'transform="rotate(-90 20 {T+plot_h/2})">{ylabel}</text>')
    out.append(f'<text x="{width/2}" y="28" text-anchor="middle" font-size="16" font-weight="600">{title}</text>')

    # Legend
    lx = L + plot_w + 20
    ly = T + 10
    out.append(f'<rect x="{lx-8}" y="{ly-14}" width="{R-28}" height="{20*len(names)+10}" '
               f'fill="white" stroke="#999" stroke-width="0.6"/>')
    for idx, name in enumerate(names):
        color = PALETTE[idx % len(PALETTE)]
        marker = MARKERS[idx % len(MARKERS)]
        yy = ly + idx * 20
        out.append(f'<line x1="{lx}" y1="{yy}" x2="{lx+22}" y2="{yy}" stroke="{color}" stroke-width="1.4"/>')
        out.append(_marker_svg(marker, lx + 11, yy, 4, color))
        out.append(f'<text x="{lx+30}" y="{yy+4}">{_escape(name)}</text>')

    out.append('</svg>')
    return "\n".join(out)


def _escape(s: str) -> str:
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
             .replace('"', "&quot;"))


def write_html(svg: str, path: Path, title: str) -> None:
    html = (f'<!doctype html><html><head><meta charset="utf-8">'
            f'<title>{_escape(title)}</title>'
            f'<style>body{{margin:20px;font-family:Segoe UI,Arial,sans-serif;}}</style>'
            f'</head><body>{svg}</body></html>')
    path.write_text(html, encoding="utf-8")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--csv", type=Path, required=True, help="CSV/TSV of the spectra table.")
    p.add_argument("--output", "-o", type=Path, default=Path("plot.html"),
                   help="Output file (.html or .svg). Default: plot.html")
    p.add_argument("--title", default="Random Vibration Spectra")
    p.add_argument("--xlabel", default="Frequency  /Hz")
    p.add_argument("--ylabel", default="ASD  /(g²/Hz)")
    p.add_argument("--xlim", type=float, nargs=2, metavar=("XMIN", "XMAX"))
    p.add_argument("--ylim", type=float, nargs=2, metavar=("YMIN", "YMAX"))
    p.add_argument("--decimal", choices=("auto", "dot", "comma"), default="auto")
    p.add_argument("--delimiter")
    args = p.parse_args(argv)

    try:
        names, series = read_csv(args.csv, decimal=args.decimal, delimiter=args.delimiter)
    except (FileNotFoundError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    if not any(series.values()):
        print("error: no numeric data parsed from the table.", file=sys.stderr)
        return 1

    for name in names:
        print(f"  {name}: {len(series.get(name, []))} point(s)")

    svg = render_svg(
        names, series,
        title=args.title, xlabel=args.xlabel, ylabel=args.ylabel,
        xlim=tuple(args.xlim) if args.xlim else None,
        ylim=tuple(args.ylim) if args.ylim else None,
    )
    if args.output.suffix.lower() == ".svg":
        args.output.write_text(svg, encoding="utf-8")
    else:
        write_html(svg, args.output, args.title)
    print(f"Saved plot to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
