import { useEffect, useMemo, useRef, useState } from "react";
import type { RivalryTimelineEntry } from "../../hooks/useRivalry";

const PAD = { top: 18, right: 16, bottom: 26, left: 44 };

type Props = {
  timeline: RivalryTimelineEntry[];
  nameA: string;
  nameB: string;
  colorA: string;
  colorB: string;
};

export function MomentumChart({ timeline, nameA, nameB, colorA, colorB }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const [W, setW] = useState(900);
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLElement>(null);

  // Match the viewBox to real pixel width so labels never downscale on phones.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      setW(Math.max(300, Math.round(entry.contentRect.width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = W < 520 ? 190 : 260;

  const model = useMemo(() => {
    const deltas = timeline.map((t) => t.cum_a - t.cum_b);
    const peak = Math.max(10, ...deltas.map(Math.abs));
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;

    const x = (i: number) =>
      PAD.left + (timeline.length < 2 ? innerW / 2 : (i / (timeline.length - 1)) * innerW);
    const y = (d: number) => PAD.top + innerH / 2 - (d / peak) * (innerH / 2);

    const line = deltas.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d).toFixed(1)}`).join(" ");
    const area = `${line} L${x(deltas.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;

    // One tick per season, placed at the season's first shared race.
    const seasonTicks: { i: number; label: string }[] = [];
    timeline.forEach((t, i) => {
      if (i === 0 || t.season_id !== timeline[i - 1].season_id) {
        seasonTicks.push({ i, label: `S${t.season_id}` });
      }
    });

    return { deltas, peak, x, y, line, area, seasonTicks, zeroY: y(0) };
  }, [timeline, W, H]);

  if (timeline.length < 2) return null;

  const { deltas, peak, x, y, line, area, seasonTicks, zeroY } = model;
  const finalDelta = deltas[deltas.length - 1];

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const ratio = (px - PAD.left) / (W - PAD.left - PAD.right);
    const i = Math.round(ratio * (timeline.length - 1));
    setHover(i >= 0 && i < timeline.length ? i : null);
  }

  const active = hover != null ? timeline[hover] : null;

  return (
    <figure className="rv-chart" ref={wrapRef}>
      <figcaption className="rv-chart-cap">
        <span className="rv-chart-title">MOMENTUM</span>
        <span className="rv-chart-sub">
          Cumulative points lead across {timeline.length} shared races
        </span>
      </figcaption>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="rv-chart-svg"
        role="img"
        aria-label={`Cumulative points lead. ${
          finalDelta === 0
            ? "Dead level."
            : `${finalDelta > 0 ? nameA : nameB} leads by ${Math.abs(finalDelta)} points.`
        }`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <clipPath id="rv-clip-a"><rect x="0" y="0" width={W} height={zeroY} /></clipPath>
          <clipPath id="rv-clip-b"><rect x="0" y={zeroY} width={W} height={H - zeroY} /></clipPath>
        </defs>

        <text x={PAD.left - 8} y={y(peak) + 4} className="rv-axis-label" textAnchor="end">+{Math.round(peak)}</text>
        <text x={PAD.left - 8} y={zeroY + 4} className="rv-axis-label" textAnchor="end">0</text>
        <text x={PAD.left - 8} y={y(-peak) + 4} className="rv-axis-label" textAnchor="end">-{Math.round(peak)}</text>

        {seasonTicks.map((t) => (
          <g key={t.i}>
            <line x1={x(t.i)} y1={PAD.top} x2={x(t.i)} y2={H - PAD.bottom} className="rv-season-rule" />
            <text x={x(t.i) + 4} y={H - PAD.bottom + 16} className="rv-axis-label">{t.label}</text>
          </g>
        ))}

        <path d={area} fill={colorA} fillOpacity={0.22} clipPath="url(#rv-clip-a)" />
        <path d={area} fill={colorB} fillOpacity={0.22} clipPath="url(#rv-clip-b)" />

        <line x1={PAD.left} y1={zeroY} x2={W - PAD.right} y2={zeroY} className="rv-zero-rule" />

        <path d={line} fill="none" stroke={colorA} strokeWidth={2} clipPath="url(#rv-clip-a)" vectorEffect="non-scaling-stroke" />
        <path d={line} fill="none" stroke={colorB} strokeWidth={2} clipPath="url(#rv-clip-b)" vectorEffect="non-scaling-stroke" />

        {/* Anchored left: the series always starts at zero, so the two far
            corners stay clear no matter how the line diverges. */}
        <text x={PAD.left + 6} y={PAD.top + 10} className="rv-series-label" fill={colorA}>
          {nameA} ahead
        </text>
        <text x={PAD.left + 6} y={H - PAD.bottom - 4} className="rv-series-label" fill={colorB}>
          {nameB} ahead
        </text>

        {active && hover != null && (
          <g>
            <line x1={x(hover)} y1={PAD.top} x2={x(hover)} y2={H - PAD.bottom} className="rv-crosshair" />
            <circle
              cx={x(hover)}
              cy={y(deltas[hover])}
              r={5}
              fill={deltas[hover] >= 0 ? colorA : colorB}
              stroke="var(--bg)"
              strokeWidth={2}
            />
          </g>
        )}
      </svg>

      <div className="rv-chart-readout" aria-live="polite">
        {active ? (
          <>
            <span className="rv-readout-race">
              S{active.season_id} R{active.round} · {active.track}
            </span>
            <span className="rv-readout-pos">
              P{active.a_finish} <span className="rv-readout-v">v</span> P{active.b_finish}
            </span>
            <span className="rv-readout-delta">
              {deltas[hover!] === 0
                ? "level"
                : `${deltas[hover!] > 0 ? nameA : nameB} +${Math.abs(deltas[hover!])}`}
            </span>
          </>
        ) : (
          <span className="rv-readout-hint">
            {finalDelta === 0
              ? "Dead level on points."
              : `${finalDelta > 0 ? nameA : nameB} leads by ${Math.abs(finalDelta)} points overall.`}
          </span>
        )}
      </div>
    </figure>
  );
}
