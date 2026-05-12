#!/usr/bin/env python3
"""Convert a Random Vibration Spectra table into a log-log ASD vs Frequency plot.

The script accepts either:
  * an image of the table (OCR via pytesseract), or
  * a CSV file with the same structure (recommended for reliable results).

Table structure expected (qualification-test "random" style):
  - First column header  : "Frequency" (or similar) with units row "/Hz"
  - Remaining columns    : one series per column (e.g. "M180072-003 XY")
  - Cells                : ASD values in g^2/Hz; blank cells mean the series
                           is not defined at that frequency
  - Optional final row   : grms / a_eff totals -- automatically skipped

Examples
--------
  # From a CSV (most reliable)
  python random_vibration_plot.py --csv spectra.csv --output plot.png

  # From a screenshot of the table (requires tesseract installed)
  python random_vibration_plot.py --image table.png --output plot.png \
      --title "Random Vibration Spectra"
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
from pathlib import Path
from typing import Dict, List, Tuple

import matplotlib.pyplot as plt


Series = Dict[str, List[Tuple[float, float]]]


def _to_float(cell: str) -> float | None:
    """Parse a numeric cell. Returns None for blank / non-numeric cells."""
    if cell is None:
        return None
    s = cell.strip().replace(",", ".").replace(" ", "")
    if not s or s in {"-", "--", "/"}:
        return None
    # OCR sometimes turns "O" into "0" the other way around; keep digits/dot/sign/e
    s = re.sub(r"[^0-9eE+\-.]", "", s)
    if s in {"", ".", "-", "+"}:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _looks_like_totals_row(label: str) -> bool:
    """Detect the trailing 'a_eff / grms' total row so it can be skipped."""
    if not label:
        return False
    norm = label.lower().replace(" ", "")
    return any(tok in norm for tok in ("grms", "gms", "aeff", "a_eff", "rms"))


def parse_rows(rows: List[List[str]]) -> Tuple[List[str], Series]:
    """Parse a 2-D list of cells into (series_names, {name: [(f, asd), ...]}).

    The first non-empty row is treated as the header. A second row whose first
    cell is a units token like "/Hz" is also skipped.
    """
    rows = [r for r in rows if any((c or "").strip() for c in r)]
    if len(rows) < 2:
        raise ValueError("Not enough rows to form a table.")

    header = [c.strip() for c in rows[0]]
    data_start = 1
    if rows[1] and rows[1][0].strip().lower().lstrip("/").startswith("hz"):
        data_start = 2

    series_names = [h for h in header[1:] if h]
    series: Series = {name: [] for name in series_names}

    for row in rows[data_start:]:
        if not row:
            continue
        label = (row[0] or "").strip()
        if _looks_like_totals_row(label):
            continue
        freq = _to_float(label)
        if freq is None:
            continue
        for idx, name in enumerate(series_names, start=1):
            if idx >= len(row):
                break
            value = _to_float(row[idx])
            if value is None or value <= 0:
                continue
            series[name].append((freq, value))

    for name in series:
        series[name].sort(key=lambda fv: fv[0])

    return series_names, series


def read_csv(path: Path) -> Tuple[List[str], Series]:
    with path.open(newline="", encoding="utf-8") as fh:
        rows = list(csv.reader(fh))
    return parse_rows(rows)


def read_image(path: Path) -> Tuple[List[str], Series]:
    try:
        import pytesseract
        from PIL import Image
    except ImportError as exc:
        raise SystemExit(
            "OCR mode requires pillow and pytesseract:\n"
            "  pip install pillow pytesseract\n"
            "and the tesseract binary (e.g. `apt install tesseract-ocr`)."
        ) from exc

    img = Image.open(path)
    tsv = pytesseract.image_to_data(
        img, output_type=pytesseract.Output.DICT, config="--psm 6"
    )

    # Group OCR tokens into rows by line/block, then sort within row by x.
    lines: Dict[Tuple[int, int, int], List[Tuple[int, str]]] = {}
    for i, text in enumerate(tsv["text"]):
        if not text or not text.strip():
            continue
        key = (tsv["block_num"][i], tsv["par_num"][i], tsv["line_num"][i])
        lines.setdefault(key, []).append((tsv["left"][i], text.strip()))

    ordered_lines = [
        [tok for _, tok in sorted(toks, key=lambda t: t[0])]
        for _, toks in sorted(lines.items())
    ]

    # Heuristic: a useful row has a numeric first token (frequency) or is the
    # header (contains an alphabetic series id). Split each line by whitespace
    # which pytesseract already did. We assume one token per column.
    return parse_rows(ordered_lines)


def plot_spectra(
    series_names: List[str],
    series: Series,
    output: Path | None,
    title: str,
    show: bool,
) -> None:
    fig, ax = plt.subplots(figsize=(11, 6.5))

    markers = ["o", "s", "D", "^", "v", "P", "X", "*", "h", "<"]
    for idx, name in enumerate(series_names):
        points = series.get(name, [])
        if not points:
            continue
        freqs, asds = zip(*points)
        ax.plot(
            freqs,
            asds,
            marker=markers[idx % len(markers)],
            linewidth=1.2,
            markersize=5,
            label=name,
        )

    ax.set_xscale("log")
    ax.set_yscale("log")
    ax.set_xlabel("Frequency  /Hz")
    ax.set_ylabel("ASD  /(g$^2$/Hz)")
    ax.set_title(title)
    ax.grid(True, which="both", linestyle="-", linewidth=0.4, alpha=0.6)
    ax.grid(True, which="minor", linestyle=":", linewidth=0.3, alpha=0.4)
    ax.legend(loc="upper right", framealpha=0.9)

    fig.tight_layout()
    if output:
        fig.savefig(output, dpi=200)
        print(f"Saved plot to {output}")
    if show:
        plt.show()
    plt.close(fig)


def main(argv: List[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    src = p.add_mutually_exclusive_group(required=True)
    src.add_argument("--csv", type=Path, help="CSV file of the spectra table.")
    src.add_argument("--image", type=Path, help="Image of the spectra table (OCR).")
    p.add_argument("--output", "-o", type=Path, help="Path to save the plot (e.g. plot.png).")
    p.add_argument("--title", default="Random Vibration Spectra", help="Plot title.")
    p.add_argument("--show", action="store_true", help="Open an interactive window.")
    args = p.parse_args(argv)

    if args.csv:
        names, series = read_csv(args.csv)
    else:
        names, series = read_image(args.image)

    if not any(series.values()):
        print("No numeric data parsed from the table.", file=sys.stderr)
        return 1

    for name in names:
        n = len(series.get(name, []))
        print(f"  {name}: {n} point(s)")

    plot_spectra(names, series, args.output, args.title, args.show)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
