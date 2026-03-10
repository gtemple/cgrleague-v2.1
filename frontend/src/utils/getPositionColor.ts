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
 * Four-stop semantic gradient:
 *   P20 → near-black purple (backmarker)
 *   ~P10 → deep crimson (points boundary)
 *   ~P3  → vivid orange (podium glow)
 *   P1   → gold (winner)
 */
export function getPositionColor(positionString: string): string {
  const VOID: RGB   = [18,  8, 28];    // near-black purple — back of the grid
  const CRIMSON: RGB = [165, 22, 22];  // deep red — around the points cutoff
  const ORANGE: RGB  = [255, 110, 20]; // vivid orange — podium territory
  const GOLD: RGB    = [255, 199, 14]; // bright gold — winner

  const pos = parseInt(positionString, 10);
  if (isNaN(pos) || pos < 1 || pos > 20) return toRgbString(VOID);

  const tLinear = (20 - pos) / 19; // 20→0 (worst), 1→1 (best)
  const t = easeInPower(tLinear, 1.6);

  // Stop positions are in eased t-space:
  //   P20 → t≈0.000, P10 → t≈0.343, P3 → t≈0.826, P1 → t=1.000
  const color = interpolateMultiStop(
    [
      { at: 0.000, color: VOID },
      { at: 0.343, color: CRIMSON },
      { at: 0.826, color: ORANGE },
      { at: 1.000, color: GOLD },
    ],
    t
  );

  return toRgbString(color);
}
