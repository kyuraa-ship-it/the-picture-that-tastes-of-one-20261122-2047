// The picture that tastes of one ingredient — steaming bowl of ramen.
// Fresh build: self-contained Node 22 rasteriser + hand-rolled PNG encoder.
// Stdlib only, no network, no assets, no text in the image.
// Deterministic: seeded RNG, no clock / Math.random / env.
import * as fs from "node:fs";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;
const buf = Buffer.alloc(W * H * 4);

// ---- deterministic RNG (mulberry32) ----
let seed = 20261122;
function rnd(): number {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function rr(a: number, b: number): number { return a + rnd() * (b - a); }

// ---- colour helpers ----
type RGB = [number, number, number];
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
function mix(c1: RGB, c2: RGB, t: number): RGB {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

// ---- pixel plotting (source-over alpha) ----
function px(x: number, y: number, c: RGB, a: number): void {
  const ix = Math.round(x), iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= W || iy >= H) return;
  const o = (iy * W + ix) * 4;
  const inv = 1 - a;
  buf[o] = Math.round(c[0] * a + buf[o] * inv);
  buf[o + 1] = Math.round(c[1] * a + buf[o + 1] * inv);
  buf[o + 2] = Math.round(c[2] * a + buf[o + 2] * inv);
  buf[o + 3] = 255;
}
function disc(cx: number, cy: number, r: number, c: RGB, a: number): void {
  const r2 = r * r;
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r2) px(x, y, c, a);
    }
  }
}
function ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB, a: number): void {
  const x0 = Math.max(0, Math.floor(cx - rx)), x1 = Math.min(W - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(H - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    const ny = (y - cy) / ry;
    const span = rx * Math.sqrt(Math.max(0, 1 - ny * ny));
    for (let x = Math.max(x0, Math.ceil(cx - span)); x <= Math.min(x1, Math.floor(cx + span)); x++) {
      px(x, y, c, a);
    }
  }
}
function ellipseGrad(cx: number, cy: number, rx: number, ry: number, top: RGB, bot: RGB): void {
  const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(H - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    const t = (y - (cy - ry)) / (2 * ry);
    const c = mix(top, bot, t);
    const ny = (y - cy) / ry;
    const span = rx * Math.sqrt(Math.max(0, 1 - ny * ny));
    const x0 = Math.max(0, Math.ceil(cx - span)), x1 = Math.min(W - 1, Math.floor(cx + span));
    for (let x = x0; x <= x1; x++) px(x, y, c, 1);
  }
}
// Ellipse outline by sampling points with soft discs.
function ellipseRing(cx: number, cy: number, rx: number, ry: number, w: number, c: RGB, a: number): void {
  const n = Math.max(64, Math.floor((rx + ry) * 2));
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    disc(cx + Math.cos(t) * rx, cy + Math.sin(t) * ry, w / 2, c, a);
  }
}
// Thick line as a chain of discs.
function stroke(x1: number, y1: number, x2: number, y2: number, w: number, c: RGB, a: number): void {
  const d = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.max(2, Math.ceil(d / (w * 0.4)));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    disc(lerp(x1, x2, t), lerp(y1, y2, t), w / 2, c, a);
  }
}
// Wavy polyline.
function wave(x1: number, y1: number, x2: number, y2: number, amp: number, freq: number, ph: number, w: number, c: RGB, a: number): void {
  const steps = Math.max(8, Math.floor(Math.abs(x2 - x1) / 3));
  let px0 = x1, py0 = y1;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = lerp(x1, x2, t);
    const y = lerp(y1, y2, t) + Math.sin(t * Math.PI * freq + ph) * amp;
    stroke(px0, py0, x, y, w, c, a);
    px0 = x; py0 = y;
  }
}
function inEllipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean {
  const dx = (x - cx) / rx, dy = (y - cy) / ry;
  return dx * dx + dy * dy <= 1;
}
// Rotated rectangle (for the nori sheet) via sampling.
function rotRect(cx: number, cy: number, hw: number, hh: number, ang: number, c: RGB, a: number): void {
  const cos = Math.cos(ang), sin = Math.sin(ang);
  const steps = Math.ceil(hw * 2 / 3);
  for (let i = -steps; i <= steps; i++) {
    for (let j = -Math.ceil(hh); j <= Math.ceil(hh); j++) {
      const lx = (i / steps) * hw, ly = j;
      const x = cx + lx * cos - ly * sin;
      const y = cy + lx * sin + ly * cos;
      px(x, y, c, a);
    }
  }
}

// ================= BACKGROUND =================
const BG_TOP: RGB = [46, 26, 17];
const BG_BOT: RGB = [22, 13, 8];
for (let y = 0; y < H; y++) {
  const c = mix(BG_TOP, BG_BOT, y / H);
  for (let x = 0; x < W; x++) px(x, y, c, 1);
}
// Warm amber radial glow behind the bowl.
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const d = Math.hypot(x - 512, y - 560) / 460;
    if (d < 1) {
      const a = 0.34 * (1 - d * d);
      px(x, y, [214, 132, 52], a);
    }
  }
}
// Table band across the lower third.
for (let y = 700; y < H; y++) {
  const c = mix([58, 36, 26], [34, 20, 14], (y - 700) / 324);
  for (let x = 0; x < W; x++) px(x, y, c, 1);
}
stroke(0, 700, 1024, 700, 3, [120, 78, 48], 0.5);

// Soft shadow tucked tight under the bowl base.
ellipse(512, 872, 320, 40, [0, 0, 0], 0.42);
ellipse(512, 866, 260, 30, [0, 0, 0], 0.35);

// ================= BOWL =================
// Lacquer body: vertical red gradient.
ellipseGrad(512, 622, 362, 232, [196, 38, 40], [110, 14, 16]);
// Gold band low on the bowl: front (lower) arc only, so it sits on the
// bowl body instead of looping below the foot like a hoop.
for (let i = 0; i <= 200; i++) {
  const t = (i / 200) * Math.PI;
  const bx = 512 + Math.cos(t) * 340, by = 640 + Math.sin(t) * 150;
  disc(bx, by, 5, [212, 168, 74], 0.95);
  disc(bx, by, 2, [240, 205, 110], 0.8);
}
// Left lacquer highlight.
ellipse(330, 600, 42, 130, [255, 120, 110], 0.16);
ellipse(300, 590, 20, 90, [255, 170, 150], 0.14);
// Bowl foot.
ellipse(512, 842, 150, 30, [84, 10, 12], 1);
ellipse(512, 838, 150, 26, [150, 26, 28], 1);

// Cream rim.
ellipse(512, 520, 362, 118, [245, 232, 208], 1);
ellipse(512, 520, 352, 110, [232, 214, 184], 1);
// Broth: glossy amber.
ellipseGrad(512, 520, 332, 102, [240, 168, 64], [178, 104, 28]);
ellipse(512, 520, 332, 102, [240, 168, 64], 0.25);
// Broth gloss streak.
ellipse(400, 478, 120, 22, [255, 220, 150], 0.35);
ellipse(620, 560, 90, 16, [255, 205, 130], 0.22);
// Broth swirls.
for (let i = 0; i < 5; i++) {
  ellipseRing(512 + rr(-90, 90), 520 + rr(-30, 30), rr(40, 90), rr(14, 28), 5, [150, 86, 22], 0.25);
}

// ================= NOODLES (clipped to broth) =================
const NOODLE_TONES: RGB[] = [[247, 227, 176], [239, 201, 120], [217, 169, 79]];
for (let s = 0; s < 34; s++) {
  const yBase = rr(452, 588);
  const x1 = rr(210, 330), x2 = rr(700, 815);
  const tone = NOODLE_TONES[s % 3];
  const amp = rr(6, 16), freq = rr(2.5, 5), ph = rr(0, Math.PI * 2);
  const w = rr(4.5, 7);
  const steps = 60;
  let px0 = x1, py0 = yBase + Math.sin(ph) * amp;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = lerp(x1, x2, t);
    const y = lerp(yBase, yBase + rr(-6, 6), t) + Math.sin(t * Math.PI * freq + ph) * amp;
    if (inEllipse(x, y, 512, 520, 326, 96) && inEllipse(px0, py0, 512, 520, 326, 96)) {
      stroke(px0, py0, x, y, w, tone, 0.95);
    }
    px0 = x; py0 = y;
  }
}

// ================= TOPPINGS =================
// Nori sheet at the back, poking just above the broth.
rotRect(700, 448, 62, 78, -0.22, [24, 52, 32], 1);
rotRect(700, 448, 56, 72, -0.22, [34, 72, 44], 1);
stroke(668, 400, 668, 500, 4, [52, 100, 62], 0.5);
stroke(700, 392, 700, 500, 4, [52, 100, 62], 0.5);

// Chashu slices: pink disc, darker rim, inner swirl.
function chashu(cx: number, cy: number, r: number): void {
  disc(cx, cy, r, [196, 110, 92], 1);
  disc(cx, cy, r - 7, [232, 168, 148], 1);
  disc(cx, cy, r - 20, [214, 140, 122], 1);
  ellipseRing(cx, cy, r - 30, r - 30, 7, [190, 104, 88], 0.8);
  disc(cx - r * 0.3, cy - r * 0.3, r * 0.18, [246, 200, 182], 0.7);
}
chashu(372, 540, 58);
chashu(648, 505, 52);

// Soft-egg halves: white + glossy orange yolk + highlight.
function egg(cx: number, cy: number): void {
  ellipse(cx, cy, 64, 46, [255, 246, 232], 1);
  ellipse(cx, cy, 58, 40, [250, 238, 218], 1);
  disc(cx, cy, 30, [242, 140, 30], 1);
  disc(cx, cy, 24, [250, 164, 52], 1);
  disc(cx - 9, cy - 10, 9, [255, 205, 110], 0.9);
  disc(cx + 6, cy + 8, 5, [255, 220, 140], 0.6);
}
egg(452, 566);
egg(596, 572);

// Narutomaki: white disc with pink spiral.
disc(516, 470, 42, [255, 250, 244], 1);
disc(516, 470, 36, [248, 236, 228], 1);
for (let a = 0; a < Math.PI * 5; a += 0.25) {
  const r = 4 + (a / (Math.PI * 5)) * 30;
  disc(516 + Math.cos(a) * r, 470 + Math.sin(a) * r, 4.5, [240, 150, 168], 0.95);
}
disc(516, 470, 6, [240, 150, 168], 1);

// Green-onion rings.
for (let i = 0; i < 16; i++) {
  const x = rr(240, 790), y = rr(452, 592);
  if (!inEllipse(x, y, 512, 520, 320, 96)) continue;
  const r = rr(9, 13);
  disc(x, y, r, [52, 140, 72], 1);
  disc(x, y, r - 4, [120, 200, 110], 1);
  disc(x, y, r - 7, [60, 150, 80], 1);
}
// Sesame seeds.
for (let i = 0; i < 40; i++) {
  const x = rr(230, 800), y = rr(450, 590);
  if (!inEllipse(x, y, 512, 520, 322, 98)) continue;
  disc(x, y, rr(2, 3.2), rnd() < 0.6 ? [250, 235, 205] : [214, 178, 120], 0.95);
}
// Chilli-oil droplets.
for (let i = 0; i < 12; i++) {
  const x = rr(250, 780), y = rr(455, 585);
  if (!inEllipse(x, y, 512, 520, 320, 96)) continue;
  disc(x, y, rr(4, 8), [198, 52, 18], 0.85);
  disc(x - 1, y - 1, rr(1.5, 2.5), [255, 120, 60], 0.8);
}

// ================= CHOPSTICKS =================
// Two wooden chopsticks resting diagonally, tips in the broth.
stroke(742, 168, 588, 512, 13, [139, 90, 43], 1);
stroke(742, 168, 588, 512, 6, [172, 118, 62], 0.9);
stroke(776, 196, 622, 520, 13, [122, 78, 36], 1);
stroke(776, 196, 622, 520, 6, [158, 106, 56], 0.9);
disc(588, 512, 7, [96, 60, 28], 1);
disc(622, 520, 7, [88, 54, 24], 1);

// ================= STEAM =================
// Four soft rising wisps, three passes each (wide faint -> thin brighter).
function steamWisp(x0: number, top: number, bot: number, drift: number): void {
  const passes: Array<[number, number]> = [[26, 0.05], [14, 0.08], [7, 0.13]];
  for (const [w, a] of passes) {
    const steps = 40;
    let px0 = x0, py0 = bot;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const y = lerp(bot, top, t);
      const x = x0 + Math.sin(t * Math.PI * 2.2 + x0) * drift * t;
      stroke(px0, py0, x, y, w * (1 - t * 0.45), [255, 244, 230], a);
      px0 = x; py0 = y;
    }
  }
}
steamWisp(400, 120, 470, 34);
steamWisp(500, 88, 462, 42);
steamWisp(600, 110, 466, 36);
steamWisp(680, 150, 470, 26);

// ================= PNG ENCODE =================
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 4)] = 0; // filter: none
    buf.copy(raw, y * (1 + W * 4) + 1, y * W * 4, (y + 1) * W * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

const png = encodePNG();
fs.mkdirSync("/output", { recursive: true });
fs.writeFileSync("/output/entry.png", png);
console.log(`wrote /output/entry.png ${png.length} bytes ${W}x${H}`);
