/**
 * Real F1 liveries aren't a usable 2-series palette on their own: Red Bull vs
 * Racing Bulls and Ferrari vs Alfa Romeo both fall under the ΔE 15 legibility
 * floor, and several liveries sit outside the dark-surface lightness band.
 * This keeps each driver's actual team colour where it works and forces the
 * pair apart where it doesn't.
 */

type Lab = { L: number; a: number; b: number };

function srgbToLinear(c: number) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function linearToSrgb(c: number) {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function hexToLab(hex: string): Lab | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = srgbToLinear(((n >> 16) & 255) / 255);
  const g = srgbToLinear(((n >> 8) & 255) / 255);
  const b = srgbToLinear((n & 255) / 255);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m2 = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  return {
    L: 0.2104542553 * l + 0.793617785 * m2 - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m2 + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m2 - 0.808675766 * s,
  };
}

function labToHex({ L, a, b }: Lab): string {
  const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const rgb = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ].map((v) => {
    const c = Math.round(Math.min(1, Math.max(0, linearToSrgb(v))) * 255);
    return c.toString(16).padStart(2, "0");
  });
  return `#${rgb.join("")}`;
}

/** OKLab ΔE, ×100 to match the palette validator's scale. */
function deltaE(x: Lab, y: Lab) {
  return Math.hypot(x.L - y.L, x.a - y.a, x.b - y.b) * 100;
}

/** Keep hue, pull lightness into the band and cap chroma so it reads on dark. */
function normalise(lab: Lab, targetL: number): Lab {
  const chroma = Math.hypot(lab.a, lab.b);
  const hue = Math.atan2(lab.b, lab.a);
  const c = Math.min(chroma, 0.16);
  return { L: targetL, a: Math.cos(hue) * c, b: Math.sin(hue) * c };
}

export type RivalryPalette = { a: string; b: string; adjusted: boolean };

/**
 * Hue-contrast partners for when a livery can't carry series identity.
 * No magenta (teal-vs-pink collapses to ΔE 7 under protanopia) and no silver
 * (near-gray falls under the chroma floor and reads as "no data").
 */
const PARTNERS = ["#e8a33a", "#4aa3ff"];

/** Below this, a livery reads as gray and can't encode a series. */
const CHROMA_FLOOR = 0.05;

function chromaOf(lab: Lab) {
  return Math.hypot(lab.a, lab.b);
}

function hueOf(lab: Lab) {
  return Math.atan2(lab.b, lab.a);
}

/** Smallest angle between two hues, in degrees. */
function hueGap(x: Lab, y: Lab) {
  const d = Math.abs(hueOf(x) - hueOf(y)) * (180 / Math.PI);
  return d > 180 ? 360 - d : d;
}

function furthestPartner(from: Lab): Lab {
  return PARTNERS
    .map((hex) => normalise(hexToLab(hex)!, 0.66))
    .reduce((best, cand) => (hueGap(from, cand) > hueGap(from, best) ? cand : best));
}

/**
 * Resolve two team colours into a legible pair.
 *
 * ΔE alone isn't enough. Aston green and Mercedes teal clear the ΔE floor but
 * still read as one colour at 3px bar heights, because hue is what carries
 * series identity at a glance. A pair has to clear a ΔE floor AND a hue gap,
 * and each colour has to carry enough chroma to read as a colour at all;
 * whatever fails takes a contrasting partner hue instead.
 */
export function resolveRivalryColors(rawA?: string, rawB?: string): RivalryPalette {
  const labA = (rawA && hexToLab(rawA)) || null;
  const labB = (rawB && hexToLab(rawB)) || null;

  let a = labA ? normalise(labA, 0.62) : null;
  const b = labB ? normalise(labB, 0.62) : null;

  if (!a || chromaOf(a) < CHROMA_FLOOR) {
    a = normalise(hexToLab(PARTNERS[0])!, 0.62);
    return { a: labToHex(a), b: labToHex(furthestPartner(a)), adjusted: true };
  }

  const bUsable = b && chromaOf(b) >= CHROMA_FLOOR && deltaE(a, b) >= 15 && hueGap(a, b) >= 50;
  if (bUsable) return { a: labToHex(a), b: labToHex(b!), adjusted: false };

  return { a: labToHex(a), b: labToHex(furthestPartner(a)), adjusted: true };
}
