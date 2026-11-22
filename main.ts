// The picture that tastes of one ingredient — make.fun bounty entry.
//
// A program that draws one picture of food: a steaming bowl of ramen, big and
// centred, with glossy broth, wavy noodles, a soft egg, chashu, narutomaki,
// green onions and chopsticks, drawn with a tiny self-contained rasteriser.
// No assets, no network, no dependencies: only Node's stdlib (fs, path, zlib).
// The PNG is encoded by hand (zlib deflate + manual PNG chunks).
//
// Run: `node main.ts` (Node 22.18+ runs the TypeScript as it is; the grader
// runs Node 22.23.4). It writes /output/entry.png, or $MAKEFUN_OUTPUT_DIR/
// entry.png outside a container. Deterministic: same run, byte-identical PNG.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

type RGB = [number, number, number];

const buf = Buffer.alloc(W * H * 4);

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mix(c1: RGB, c2: RGB, t: number): RGB {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

// Seeded RNG (mulberry32) — deterministic, no Math.random, no clock.
let seed = 0x9e3779b9;
function rnd(): number {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Source-over blend of one pixel. */
function px(x: number, y: number, c: RGB, a: number): void {
  const xi = x | 0;
  const yi = y | 0;
  if (xi < 0 || xi >= W || yi < 0 || yi >= H || a <= 0) return;
  const i = (yi * W + xi) * 4;
  if (a >= 1) {
    buf[i] = c[0];
    buf[i + 1] = c[1];
    buf[i + 2] = c[2];
    buf[i + 3] = 255;
    return;
  }
  const inv = 1 - a;
  buf[i] = Math.round(c[0] * a + buf[i] * inv);
  buf[i + 1] = Math.round(c[1] * a + buf[i + 1] * inv);
  buf[i + 2] = Math.round(c[2] * a + buf[i + 2] * inv);
  buf[i + 3] = 255;
}

function hline(y: number, x0: number, x1: number, c: RGB, a: number): void {
  const yi = y | 0;
  if (yi < 0 || yi >= H) return;
  const xa = clamp(Math.ceil(x0), 0, W - 1);
  const xb = clamp(Math.floor(x1), 0, W - 1);
  for (let x = xa; x <= xb; x++) px(x, yi, c, a);
}

function fillEllipse(cx: number, cy: number, rx: number, ry: number, c: RGB, a: number): void {
  const y0 = Math.max(0, Math.ceil(cy - ry));
  const y1 = Math.min(H - 1, Math.floor(cy + ry));
  for (let y = y0; y <= y1; y++) {
    const t = (y - cy) / ry;
    const dx = rx * Math.sqrt(Math.max(0, 1 - t * t));
    hline(y, cx - dx, cx + dx, c, a);
  }
}

function fillCircle(cx: number, cy: number, r: number, c: RGB, a: number): void {
  fillEllipse(cx, cy, r, r, c, a);
}

/** Ellipse outline drawn as a chain of small discs; yMin/yMax clip the arc. */
function ellipseStroke(
  cx: number, cy: number, rx: number, ry: number,
  width: number, c: RGB, a: number, yMin = -Infinity, yMax = Infinity,
): void {
  const steps = 360;
  for (let i = 0; i <= steps; i++) {
    const th = (i / steps) * Math.PI * 2;
    const x = cx + rx * Math.cos(th);
    const y = cy + ry * Math.sin(th);
    if (y < yMin || y > yMax) continue;
    fillCircle(x, y, width / 2, c, a);
  }
}

/** Thick line as a chain of discs. */
function line(x0: number, y0: number, x1: number, y1: number, width: number, c: RGB, a: number): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const n = Math.max(1, Math.ceil(len / (width / 3)));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    fillCircle(x0 + dx * t, y0 + dy * t, width / 2, c, a);
  }
}

function inEllipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

// ---------------------------------------------------------------- background
const BG_TOP: RGB = [34, 16, 7];
const BG_BOT: RGB = [66, 30, 12];
for (let y = 0; y < H; y++) {
  const c = mix(BG_TOP, BG_BOT, y / (H - 1));
  hline(y, 0, W - 1, c, 1);
}
// Warm radial glow behind the bowl.
for (let y = 60; y < 900; y++) {
  for (let x = 60; x < 964; x++) {
    const d = Math.hypot(x - 512, y - 470) / 520;
    if (d >= 1) continue;
    const f = (1 - d) * (1 - d) * 0.55;
    px(x, y, [176, 92, 32], f * 0.5);
  }
}
// Table: warmer band across the lower third, soft edge.
for (let y = 620; y < H; y++) {
  const t = clamp((y - 620) / 90, 0, 1);
  hline(y, 0, W - 1, [96, 48, 20], 0.35 * t);
}
// Table sheen line.
hline(648, 0, W - 1, [255, 200, 130], 0.05);
hline(649, 0, W - 1, [255, 200, 130], 0.05);

// Soft shadow under the bowl, tucked tight to its base so it sits on the table.
fillEllipse(512, 872, 395, 52, [0, 0, 0], 0.30);
fillEllipse(512, 869, 360, 44, [0, 0, 0], 0.30);
fillEllipse(512, 866, 320, 36, [0, 0, 0], 0.28);

// --------------------------------------------------------------------- bowl
// Lacquer body: a tall ellipse, warm red, darker toward the base.
for (let y = 470; y <= 856; y++) {
  const t = (y - 470) / 386;
  const c = mix([168, 50, 34], [94, 18, 10], t);
  const dx = 345 * Math.sqrt(Math.max(0, 1 - ((y - 470) / 386) ** 2));
  hline(y, 512 - dx, 512 + dx, c, 1);
}
// Gold band around the body, lower arc only.
ellipseStroke(512, 470, 322, 362, 9, [217, 164, 65], 0.85, 560, 856);
// Lacquer highlight on the left.
fillEllipse(408, 660, 70, 150, [255, 255, 255], 0.05);
fillEllipse(398, 660, 34, 130, [255, 255, 255], 0.05);

// Rim: cream ring, dark inner shadow, then the broth.
fillEllipse(512, 468, 348, 118, [246, 231, 200], 1);
fillEllipse(512, 468, 312, 96, [43, 15, 8], 1);
// Broth: radial amber gradient.
for (let y = 382; y <= 558; y++) {
  for (let x = 212; x <= 812; x++) {
    const dx = (x - 512) / 300;
    const dy = (y - 470) / 88;
    const d2 = dx * dx + dy * dy;
    if (d2 > 1) continue;
    const c = mix([224, 138, 46], [172, 84, 18], clamp(Math.sqrt(d2), 0, 1));
    px(x, y, c, 1);
  }
}
// Broth gloss: a soft light streak, upper left.
fillEllipse(420, 438, 130, 26, [255, 220, 160], 0.14);
fillEllipse(400, 430, 70, 14, [255, 235, 190], 0.12);
// Broth swirls.
ellipseStroke(512, 470, 210, 58, 7, [240, 168, 78], 0.22, 400, 545);
ellipseStroke(512, 470, 150, 40, 6, [240, 168, 78], 0.18, 400, 545);

// ------------------------------------------------------------------ noodles
const NOODLE_COLORS: RGB[] = [[244, 214, 138], [233, 189, 99], [217, 162, 78]];
for (let s = 0; s < 34; s++) {
  const x0 = 235 + rnd() * 540;
  const yBase = 405 + rnd() * 125;
  const amp = 7 + rnd() * 9;
  const wl = 42 + rnd() * 30;
  const ph = rnd() * Math.PI * 2;
  const col = NOODLE_COLORS[s % 3];
  const wdt = 7 + rnd() * 3;
  let prevX = x0;
  let prevY = yBase;
  for (let x = x0; x < x0 + 150; x += 6) {
    const y = yBase + Math.sin((x - x0) / wl * Math.PI * 2 + ph) * amp;
    if (inEllipse(x, y, 512, 470, 294, 82) && inEllipse(prevX, prevY, 512, 470, 294, 82)) {
      line(prevX, prevY, x, y, wdt, col, 1);
    }
    prevX = x;
    prevY = y;
  }
}

// ----------------------------------------------------------------- toppings
// Nori sheet standing at the back (bottom hidden by the broth).
for (let y = 330; y <= 470; y++) {
  const c = mix([22, 36, 26], [14, 24, 18], (y - 330) / 140);
  hline(y, 716, 792, c, 1);
}
fillEllipse(754, 334, 38, 10, [22, 36, 26], 1);
hline(334, 724, 784, [255, 255, 255], 0.06);

// Chashu slices.
function chashu(cx: number, cy: number, rx: number, ry: number): void {
  fillEllipse(cx, cy, rx, ry, [178, 92, 64], 1);
  fillEllipse(cx, cy, rx - 14, ry - 12, [216, 138, 99], 1);
  fillEllipse(cx, cy, rx - 30, ry - 24, [196, 112, 78], 1);
  ellipseStroke(cx, cy, rx - 7, ry - 6, 5, [242, 201, 160], 0.8, cy - ry, cy - 6);
}
chashu(368, 448, 66, 50);
chashu(656, 482, 60, 46);

// Soft egg halves: white + glossy orange yolk.
function egg(cx: number, cy: number, rx: number, ry: number, yr: number): void {
  fillEllipse(cx, cy, rx, ry, [251, 243, 223], 1);
  fillEllipse(cx, cy, rx - 8, ry - 7, [244, 232, 205], 1);
  fillCircle(cx, cy, yr, [232, 137, 26], 1);
  fillCircle(cx - yr * 0.3, cy - yr * 0.32, yr * 0.32, [246, 176, 74], 1);
  fillCircle(cx - yr * 0.28, cy - yr * 0.3, yr * 0.14, [255, 220, 150], 0.9);
}
egg(452, 522, 58, 40, 23);
egg(598, 508, 54, 38, 21);

// Narutomaki: white disc with a pink spiral.
fillCircle(530, 412, 32, [253, 246, 232], 1);
ellipseStroke(530, 412, 24, 24, 5, [232, 122, 154], 0.95, 380, 445);
ellipseStroke(530, 412, 15, 15, 5, [232, 122, 154], 0.95, 380, 445);
fillCircle(530, 412, 6, [232, 122, 154], 0.95);

// Green onion rings.
for (let i = 0; i < 16; i++) {
  const x = 250 + rnd() * 520;
  const y = 405 + rnd() * 125;
  if (!inEllipse(x, y, 512, 470, 288, 80)) continue;
  const r = 6 + rnd() * 3;
  ellipseStroke(x, y, r, r * 0.8, 3.5, [87, 168, 62], 1, 0, 1024);
  fillCircle(x, y, r * 0.35, [124, 195, 90], 1);
}
// Sesame seeds on the noodles.
for (let i = 0; i < 22; i++) {
  const x = 250 + rnd() * 520;
  const y = 405 + rnd() * 125;
  if (!inEllipse(x, y, 512, 470, 288, 80)) continue;
  fillCircle(x, y, 2.4, [247, 232, 200], 0.95);
}
// Chilli-oil droplets: glossy red-orange.
for (let i = 0; i < 7; i++) {
  const x = 260 + rnd() * 500;
  const y = 410 + rnd() * 115;
  if (!inEllipse(x, y, 512, 470, 286, 78)) continue;
  const r = 6 + rnd() * 4;
  fillCircle(x, y, r, [212, 61, 18], 0.95);
  fillCircle(x - r * 0.3, y - r * 0.3, r * 0.28, [255, 140, 90], 0.9);
}

// --------------------------------------------------------------- chopsticks
// Two sticks resting diagonally across the rim, tips dipping into the broth.
line(742, 168, 588, 442, 13, [110, 63, 28], 1);
line(786, 196, 626, 452, 13, [110, 63, 28], 1);
line(742, 165, 588, 439, 4, [168, 106, 53], 1);
line(786, 193, 626, 449, 4, [168, 106, 53], 1);
fillCircle(588, 442, 7, [96, 54, 24], 1);
fillCircle(626, 452, 7, [96, 54, 24], 1);

// -------------------------------------------------------------------- steam
// Soft white wisps rising from the broth: wide faint strokes, then narrower.
function steam(xBase: number, phase: number, top: number, bottom: number): void {
  const passes: Array<[number, number]> = [[24, 0.06], [13, 0.09], [6, 0.12]];
  for (const [wd, al] of passes) {
    let prevX = xBase;
    let prevY = bottom;
    for (let y = bottom; y >= top; y -= 8) {
      const sway = 20 * Math.sin((bottom - y) / 62 + phase) + 8 * Math.sin((bottom - y) / 27 + phase * 2);
      const x = xBase + sway;
      line(prevX, prevY, x, y, wd, [255, 244, 228], al);
      prevX = x;
      prevY = y;
    }
  }
}
steam(392, 0.4, 150, 428);
steam(478, 1.9, 118, 420);
steam(566, 3.1, 132, 424);
steam(646, 4.6, 168, 432);

// ----------------------------------------------------------------- vignette
for (let k = 0; k < 10; k++) {
  const r = 560 + k * 22;
  ellipseStroke(512, 512, r, r, 24, [0, 0, 0], 0.03 + k * 0.008, 0, 1024);
}

// ---------------------------------------------------------------- PNG encode
const CRC_TABLE: Uint32Array = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // colour type RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

// Raw scanlines: filter byte 0 + RGBA rows.
const raw = Buffer.alloc(H * (1 + W * 4));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 4)] = 0;
  buf.copy(raw, y * (1 + W * 4) + 1, y * W * 4, (y + 1) * W * 4);
}
const idat = deflateSync(raw, { level: 9 });

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
]);

mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(join(OUTPUT_DIR, 'entry.png'), png);
