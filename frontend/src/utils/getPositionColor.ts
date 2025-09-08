// ---- Color helpers ----
type RGB = [number, number, number];

const toRgbString = ([r, g, b]: RGB) => `rgb(${r}, ${g}, ${b})`;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpColor(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ];
}

/**
 * Interpolate across multiple color stops.
 * stops: [{ at: 0..1, color: [r,g,b] }, ...] (must be sorted by `at`)
 */
function interpolateMultiStop(
  stops: { at: number; color: RGB }[],
  t: number
): RGB {
  if (t <= stops[0].at) return stops[0].color;
  if (t >= stops[stops.length - 1].at) return stops[stops.length - 1].color;

  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (t >= a.at && t <= b.at) {
      const span = (t - a.at) / (b.at - a.at);
      return lerpColor(a.color as RGB, b.color as RGB, span);
    }
  }
  return stops[stops.length - 1].color;
}

// Gentler early change, larger separation at the top.
// t' = t^(1.6) keeps P20–P11 clustered & spreads P10–P1.
const easeInPower = (t: number, power = 1.6) => Math.pow(Math.min(1, Math.max(0, t)), power);

// ---- Main API ----

/**
 * Returns a legend color for a finishing position "1".."20".
 * Three-stop gradient: brown (P20) → yellow (~P10) → red (P1).
 */
export function getPositionColor(positionString: string): string {
  // much darker starting brown
  const BROWN: RGB  = [40, 18, 6];      // near-black brown for worst finish
  const YELLOW: RGB = [255, 199, 14];   // bright for top finishes

  // Normalize 1..20 → t in [0..1], where 20→0 (worst) and 1→1 (best)
  const pos = parseInt(positionString, 10);
  if (isNaN(pos) || pos < 1 || pos > 20) return toRgbString(BROWN);

  const tLinear = (20 - pos) / 19; // 20→0, 1→1
  const t = easeInPower(tLinear, 1.6); // keeps P20–P11 clustered, spreads P10–P1

  // Two-stop interpolation (brown → yellow)
  const color = interpolateMultiStop(
    [
      { at: 0.0, color: BROWN },
      { at: 1.0, color: YELLOW },
    ],
    t
  );

  return toRgbString(color);
}
