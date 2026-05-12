#!/usr/bin/env python3
"""Convert a Random Vibration Spectra table into a log-log ASD vs Frequency plot.

The script accepts either:
  * a CSV / TSV file with the table contents (most reliable), or
  * an image of the table (best-effort OCR via pytesseract).

Table structure expected (qualification-test "random" style):
  - First column header  : a frequency label (e.g. "Frequency", "Frequenzy")
  - Remaining columns    : one series per column (e.g. "M180072-003 XY")
  - Cells                : ASD values in g^2/Hz; blank cells mean the series
                           is not defined at that frequency
  - Optional units row   : a row directly below the header with non-numeric
                           cells (e.g. "/Hz") -- automatically skipped
  - Optional totals row  : a final row whose label contains "grms" / "aeff" /
                           "rms" -- automatically skipped

Examples
--------
  # From a CSV
  python random_vibration_plot.py --csv spectra.csv -o plot.png

  # From an image of the table (requires tesseract)
  python random_vibration_plot.py --image table.png -o plot.png

  # European-style decimals, custom title and axis limits
  python random_vibration_plot.py --csv spectra.csv -o plot.png \
      --decimal comma --title "Qualification Spectrum" \
      --xlim 10 2000 --ylim 1e-4 1e2
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

import matplotlib.pyplot as plt


Series = Dict[str, List[Tuple[float, float]]]

_NULL_TOKENS = {"", "-", "--", "—", "/", "n/a", "na", "nan", "none"}


# ---------------------------------------------------------------------------
# Numeric parsing
# ---------------------------------------------------------------------------


def _to_float(cell: Optional[str], decimal: str = "auto") -> Optional[float]:
    """Parse a numeric cell. Returns None for blank / non-numeric input.

    Parameters
    ----------
    cell    : raw string from the table.
    decimal : "dot" (US: 1,234.5), "comma" (EU: 1.234,5), or "auto".
              In "auto" mode the rightmost of '.' or ',' is treated as the
              decimal separator; if only ',' is present and there is at most
              one of them in a position consistent with a decimal, it is
              treated as the decimal mark.
    """
    if cell is None:
        return None
    s = str(cell).strip()
    if not s or s.lower() in _NULL_TOKENS:
        return None

    # Keep only characters relevant to a numeric literal.
    s = re.sub(r"[^\d.,eE+\-]", "", s)
    if not s or s in {".", ",", "-", "+"}:
        return None

    if decimal == "comma":
        s = s.replace(".", "").replace(",", ".")
    elif decimal == "dot":
        s = s.replace(",", "")
    else:  # auto
        has_dot = "." in s
        has_comma = "," in s
        if has_dot and has_comma:
            if s.rfind(",") > s.rfind("."):
                s = s.replace(".", "").replace(",", ".")
            else:
                s = s.replace(",", "")
        elif has_comma:
            # Single separator, ambiguous. If the comma sits 3 digits from
            # the right with leading digits >= 1 it is *probably* a thousands
            # mark ("1,000"); otherwise treat it as a decimal ("0,5").
            parts = s.split(",")
            if (
                len(parts) == 2
                and len(parts[1]) == 3
                and parts[0].lstrip("+-").isdigit()
                and parts[1].isdigit()
            ):
                s = s.replace(",", "")
            else:
                s = s.replace(",", ".")

    try:
        return float(s)
    except ValueError:
        return None


def _looks_like_totals_row(label: str) -> bool:
    """Detect a trailing 'a_eff / grms' totals row so it can be skipped."""
    if not label:
        return False
    norm = re.sub(r"[\s_]+", "", label.lower())
    return any(tok in norm for tok in ("grms", "gms", "aeff", "rms"))


# ---------------------------------------------------------------------------
# Table → series
# ---------------------------------------------------------------------------


def parse_rows(
    rows: Sequence[Sequence[str]], decimal: str = "auto"
) -> Tuple[List[str], Series]:
    """Parse a 2-D list of cells into (series_names, {name: [(f, asd), ...]}).

    Rules:
      * The first non-empty row is the header. Its first cell is the frequency
        column; remaining non-empty cells name the series.
      * A second row whose first cell is non-numeric (e.g. "/Hz") is skipped.
      * Empty cells in data rows are treated as "series not defined here" and
        produce no point (no fake interpolation through gaps).
      * A row whose label matches the totals pattern is skipped.
      * Non-positive frequencies / values are skipped (log scale).
    """
    normalised = [["" if c is None else str(c) for c in r] for r in rows]
    cleaned = [r for r in normalised if any(c.strip() for c in r)]
    if len(cleaned) < 2:
        raise ValueError("Not enough rows to form a table.")

    header = [(c or "").strip() for c in cleaned[0]]
    if len(header) < 2:
        raise ValueError("Header must have at least two columns.")

    data_start = 1
    if len(cleaned) > 1:
        first_cell = (cleaned[1][0] or "").strip() if cleaned[1] else ""
        if first_cell and _to_float(first_cell, decimal) is None:
            data_start = 2

    # Preserve original column indices so blank middle headers don't shift data.
    series_cols: List[Tuple[int, str]] = [
        (i, name) for i, name in enumerate(header[1:], start=1) if name
    ]
    if not series_cols:
        raise ValueError("No series columns found in the header.")
    series_names = [name for _, name in series_cols]
    series: Series = {name: [] for name in series_names}

    for row in cleaned[data_start:]:
        label = (row[0] or "").strip() if row else ""
        if _looks_like_totals_row(label):
            continue
        freq = _to_float(label, decimal)
        if freq is None or freq <= 0:
            continue
        for col_idx, name in series_cols:
            if col_idx >= len(row):
                continue
            value = _to_float(row[col_idx], decimal)
            if value is None or value <= 0:
                continue
            series[name].append((freq, value))

    for name in series:
        series[name].sort(key=lambda fv: fv[0])

    return series_names, series


# ---------------------------------------------------------------------------
# Readers
# ---------------------------------------------------------------------------


def _sniff_dialect(sample: str) -> csv.Dialect:
    try:
        return csv.Sniffer().sniff(sample, delimiters=",;\t|")
    except csv.Error:
        class _D(csv.excel):
            delimiter = ","
        return _D()


def read_csv(
    path: Path, decimal: str = "auto", delimiter: Optional[str] = None
) -> Tuple[List[str], Series]:
    with path.open(newline="", encoding="utf-8-sig") as fh:
        sample = fh.read(4096)
        fh.seek(0)
        if delimiter:
            reader = csv.reader(fh, delimiter=delimiter)
        else:
            reader = csv.reader(fh, dialect=_sniff_dialect(sample))
        rows = list(reader)
    return parse_rows(rows, decimal=decimal)


def _ocr_tokens(image_path: Path):
    try:
        import pytesseract
        from PIL import Image
    except ImportError as exc:
        raise SystemExit(
            "OCR mode requires pillow and pytesseract:\n"
            "  pip install pillow pytesseract\n"
            "and the tesseract binary (e.g. `apt install tesseract-ocr`)."
        ) from exc

    img = Image.open(image_path)
    data = pytesseract.image_to_data(
        img, output_type=pytesseract.Output.DICT, config="--psm 6"
    )
    tokens = []
    for i, text in enumerate(data["text"]):
        s = (text or "").strip()
        if not s:
            continue
        left = data["left"][i]
        top = data["top"][i]
        w = data["width"][i]
        h = data["height"][i]
        tokens.append(
            {
                "text": s,
                "left": left,
                "right": left + w,
                "top": top,
                "bottom": top + h,
                "cx": left + w / 2,
                "cy": top + h / 2,
                "h": h,
            }
        )
    return tokens


def _cluster_rows(tokens):
    """Group tokens into rows by vertical position."""
    if not tokens:
        return []
    tokens = sorted(tokens, key=lambda t: t["cy"])
    heights = sorted(t["h"] for t in tokens)
    median_h = heights[len(heights) // 2] or 10
    tol = max(median_h * 0.6, 4)
    groups = [[tokens[0]]]
    for tok in tokens[1:]:
        if tok["cy"] - groups[-1][-1]["cy"] <= tol:
            groups[-1].append(tok)
        else:
            groups.append([tok])
    for g in groups:
        g.sort(key=lambda t: t["cx"])
    return groups


def _find_header_row(rows: List[List[dict]], decimal: str) -> int:
    """Header is the row directly above the longest numeric-first-token block."""
    def is_numeric(row):
        return bool(row) and _to_float(row[0]["text"], decimal) is not None

    best_start, best_len = -1, 0
    i = 0
    n = len(rows)
    while i < n:
        if is_numeric(rows[i]):
            j = i
            while j < n and is_numeric(rows[j]):
                j += 1
            if j - i > best_len:
                best_start, best_len = i, j - i
            i = j
        else:
            i += 1
    if best_start <= 0:
        # No numeric block, or it starts at the very top; fall back to row 0.
        return 0
    return best_start - 1


def _merge_header_tokens(header_row: List[dict]) -> List[dict]:
    """Merge consecutive header tokens whose gap is small (multi-word names)."""
    if len(header_row) <= 1:
        return list(header_row)
    gaps = [
        header_row[i + 1]["left"] - header_row[i]["right"]
        for i in range(len(header_row) - 1)
    ]
    sorted_gaps = sorted(gaps)
    median_gap = sorted_gaps[len(sorted_gaps) // 2]
    threshold = max(median_gap * 0.5, 1)

    merged: List[List[dict]] = [[header_row[0]]]
    for tok, gap in zip(header_row[1:], gaps):
        if gap <= threshold:
            merged[-1].append(tok)
        else:
            merged.append([tok])

    out = []
    for group in merged:
        out.append(
            {
                "text": " ".join(t["text"] for t in group),
                "left": group[0]["left"],
                "right": group[-1]["right"],
                "cx": sum(t["cx"] for t in group) / len(group),
            }
        )
    return out


def read_image(path: Path, decimal: str = "auto") -> Tuple[List[str], Series]:
    """OCR an image of the table and parse it into series.

    Strategy:
      1. OCR with positional data.
      2. Cluster tokens into rows by y-coordinate.
      3. Locate the header row as the line directly above the longest run of
         numeric-first-token rows.
      4. Merge adjacent header tokens to recover multi-word column names.
      5. Bin every token of every row to its nearest header anchor by x.
      6. Hand the resulting sparse table to parse_rows.
    """
    tokens = _ocr_tokens(path)
    if not tokens:
        raise ValueError("OCR returned no tokens. Is tesseract installed?")

    rows = _cluster_rows(tokens)
    header_idx = _find_header_row(rows, decimal)
    header_tokens = _merge_header_tokens(rows[header_idx])
    if len(header_tokens) < 2:
        raise ValueError(
            "OCR header detection failed (got < 2 columns). "
            "Consider exporting the table to CSV and using --csv."
        )

    anchors = [h["cx"] for h in header_tokens]
    header_names = [h["text"] for h in header_tokens]

    # Half-width tolerance for snapping: half the smallest inter-anchor gap.
    if len(anchors) >= 2:
        min_gap = min(anchors[i + 1] - anchors[i] for i in range(len(anchors) - 1))
        snap_tol = min_gap * 0.75
    else:
        snap_tol = float("inf")

    table: List[List[str]] = [header_names]
    for ri, row in enumerate(rows):
        if ri == header_idx:
            continue
        if ri < header_idx:
            # Title/banner rows above the header are ignored.
            continue
        cells = [""] * len(anchors)
        for tok in row:
            dists = [abs(tok["cx"] - a) for a in anchors]
            j = min(range(len(anchors)), key=lambda k: dists[k])
            if dists[j] > snap_tol:
                continue
            cells[j] = (cells[j] + " " + tok["text"]).strip() if cells[j] else tok["text"]
        if any(c for c in cells):
            table.append(cells)

    return parse_rows(table, decimal=decimal)


# ---------------------------------------------------------------------------
# Plotting
# ---------------------------------------------------------------------------


def plot_spectra(
    series_names: List[str],
    series: Series,
    output: Optional[Path],
    title: str,
    xlabel: str,
    ylabel: str,
    xlim: Optional[Tuple[float, float]],
    ylim: Optional[Tuple[float, float]],
    legend_loc: str,
    show: bool,
) -> None:
    fig, ax = plt.subplots(figsize=(11, 6.5))

    markers = ["o", "s", "D", "^", "v", "P", "X", "*", "h", "<", ">"]
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
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    ax.set_title(title)
    if xlim:
        ax.set_xlim(*xlim)
    if ylim:
        ax.set_ylim(*ylim)
    ax.grid(True, which="major", linestyle="-", linewidth=0.5, alpha=0.7)
    ax.grid(True, which="minor", linestyle=":", linewidth=0.3, alpha=0.4)
    ax.legend(loc=legend_loc, framealpha=0.9)

    fig.tight_layout()
    if output:
        fig.savefig(output, dpi=200)
        print(f"Saved plot to {output}")
    if show:
        plt.show()
    plt.close(fig)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main(argv: Optional[List[str]] = None) -> int:
    summary = (__doc__ or "").strip().splitlines()[0] if __doc__ else ""
    p = argparse.ArgumentParser(description=summary)
    src = p.add_mutually_exclusive_group(required=True)
    src.add_argument("--csv", type=Path, help="CSV/TSV file of the spectra table.")
    src.add_argument("--image", type=Path, help="Image of the spectra table (OCR).")
    p.add_argument("--output", "-o", type=Path, help="Path to save the plot (e.g. plot.png).")
    p.add_argument("--title", default="Random Vibration Spectra", help="Plot title.")
    p.add_argument("--xlabel", default="Frequency  /Hz")
    p.add_argument("--ylabel", default="ASD  /(g$^2$/Hz)")
    p.add_argument("--xlim", type=float, nargs=2, metavar=("XMIN", "XMAX"))
    p.add_argument("--ylim", type=float, nargs=2, metavar=("YMIN", "YMAX"))
    p.add_argument(
        "--decimal",
        choices=("auto", "dot", "comma"),
        default="auto",
        help="Decimal separator convention (default: auto-detect per cell).",
    )
    p.add_argument(
        "--delimiter",
        help="CSV delimiter override (default: auto-detected).",
    )
    p.add_argument(
        "--legend-loc",
        default="best",
        help="Matplotlib legend location (e.g. 'best', 'upper right').",
    )
    p.add_argument("--show", action="store_true", help="Open an interactive window.")
    args = p.parse_args(argv)

    try:
        if args.csv:
            names, series = read_csv(args.csv, decimal=args.decimal, delimiter=args.delimiter)
        else:
            names, series = read_image(args.image, decimal=args.decimal)
    except (FileNotFoundError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    if not any(series.values()):
        print("error: no numeric data parsed from the table.", file=sys.stderr)
        return 1

    for name in names:
        print(f"  {name}: {len(series.get(name, []))} point(s)")

    plot_spectra(
        names,
        series,
        output=args.output,
        title=args.title,
        xlabel=args.xlabel,
        ylabel=args.ylabel,
        xlim=tuple(args.xlim) if args.xlim else None,
        ylim=tuple(args.ylim) if args.ylim else None,
        legend_loc=args.legend_loc,
        show=args.show,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
