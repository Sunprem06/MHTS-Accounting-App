// Generates a PLACEHOLDER app icon (build/icon.png, 1024x1024) so
// electron-builder has something to derive per-platform icon formats from.
// This is scaffolding for the packaging pipeline, not real branding — swap
// this file for real MHTS/white-label art before any public distribution.
// Run with: npm run generate-icon (apps/desktop-shell).
import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SIZE = 1024;
const BACKGROUND = [0x1f, 0x3a, 0x5f]; // dark blue, placeholder brand color
const FOREGROUND = [0xff, 0xff, 0xff]; // white monogram

const png = new PNG({ width: SIZE, height: SIZE });

// Flat background.
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const idx = (SIZE * y + x) << 2;
    png.data[idx] = BACKGROUND[0];
    png.data[idx + 1] = BACKGROUND[1];
    png.data[idx + 2] = BACKGROUND[2];
    png.data[idx + 3] = 255;
  }
}

// A simple bold "M" monogram, drawn as a handful of filled rectangles/diagonals
// on a grid — good enough for a placeholder taskbar icon, not final art.
const margin = SIZE * 0.22;
const strokeWidth = SIZE * 0.09;
const top = margin;
const bottom = SIZE - margin;
const left = margin;
const right = SIZE - margin;

function setPixel(x, y) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
  const idx = (SIZE * Math.round(y) + Math.round(x)) << 2;
  png.data[idx] = FOREGROUND[0];
  png.data[idx + 1] = FOREGROUND[1];
  png.data[idx + 2] = FOREGROUND[2];
  png.data[idx + 3] = 255;
}

function fillRect(x0, y0, x1, y1) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      setPixel(x, y);
    }
  }
}

function fillDiagonal(x0, y0, x1, y1, width) {
  const steps = Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = x0 + (x1 - x0) * t;
    const cy = y0 + (y1 - y0) * t;
    fillRect(cx - width / 2, cy - width / 2, cx + width / 2, cy + width / 2);
  }
}

// Left vertical stroke.
fillRect(left, top, left + strokeWidth, bottom);
// Right vertical stroke.
fillRect(right - strokeWidth, top, right, bottom);
// Two diagonals meeting in the middle, forming the "M"'s peak.
const midX = (left + right) / 2;
const midY = top + (bottom - top) * 0.35;
fillDiagonal(left + strokeWidth / 2, top, midX, midY, strokeWidth);
fillDiagonal(midX, midY, right - strokeWidth / 2, top, strokeWidth);

mkdirSync(join(__dirname, '../build'), { recursive: true });
const outPath = join(__dirname, '../build/icon.png');
writeFileSync(outPath, PNG.sync.write(png));
console.log(`Placeholder icon written to ${outPath} — replace with real branding before public distribution.`);
