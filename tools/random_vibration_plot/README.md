# Random Vibration Spectra: Table → Plot

Generalised converter that turns a *Random Vibration Spectra* qualification
table into the standard log-log ASD vs. Frequency plot.

## Install

```bash
pip install matplotlib            # always required
pip install pillow pytesseract    # only for --image (OCR) mode
# plus the tesseract binary, e.g.  apt install tesseract-ocr
```

## Usage

```bash
# Reliable: from a CSV
python random_vibration_plot.py --csv example_spectra.csv -o plot.png

# Best-effort: from an image of the table (uses Tesseract OCR)
python random_vibration_plot.py --image table.png -o plot.png \
    --title "Random Vibration Spectra"

# European decimals, semicolon-delimited, custom axes
python random_vibration_plot.py --csv eu.csv -o plot.png \
    --decimal comma --delimiter ';' \
    --xlim 10 2000 --ylim 1e-4 1e2 \
    --xlabel "Frequency [Hz]" --ylabel "ASD [g²/Hz]"
```

All flags: `--csv|--image`, `-o/--output`, `--title`, `--xlabel`, `--ylabel`,
`--xlim`, `--ylim`, `--decimal {auto,dot,comma}`, `--delimiter`,
`--legend-loc`, `--show`.

## CSV format

* Row 1 — header. First column is `Frequency`; remaining columns are series
  names (e.g. `M180072-003 XY`).
* Row 2 — optional units row (`/Hz`, blanks). Skipped automatically.
* Following rows — one frequency per row. Empty cells mean the series is not
  defined at that frequency and are skipped (no line drawn through the gap
  with a fake value).
* A trailing totals row whose label contains `grms` / `aeff` is skipped.

See `example_spectra.csv` for a worked example that reproduces the reference
plot.

## Notes on OCR

Tesseract is reasonable on clean screenshots but is not magic — column
alignment can be wrong on noisy images. If the OCR output is off, export the
table to CSV (or paste it into a spreadsheet and save as CSV) and rerun in
`--csv` mode.
