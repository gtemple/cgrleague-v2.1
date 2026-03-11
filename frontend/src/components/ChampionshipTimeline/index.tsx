import { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { useChampionshipTimeline } from "../../hooks/useChampionshipTimeline";
import type { TimelineDriver } from "../../hooks/useChampionshipTimeline";
import "./style.css";

// Palette: vivid for human, muted for AI
const HUMAN_COLORS = [
  "#f87171", "#60a5fa", "#34d399", "#fbbf24",
  "#a78bfa", "#f472b6", "#38bdf8", "#fb923c",
];
const AI_COLORS = [
  "#7f3f3f", "#2d4f7a", "#1f6b4c", "#7a5c12",
  "#4c3d7a", "#7a3059", "#1a5f7a", "#7a4020",
];

function assignColors(drivers: TimelineDriver[]) {
  let hi = 0, ai = 0;
  return drivers.map((d) => ({
    ...d,
    color: d.is_human
      ? HUMAN_COLORS[hi++ % HUMAN_COLORS.length]
      : AI_COLORS[ai++ % AI_COLORS.length],
  }));
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; payload: Record<string, unknown> }>;
  label?: string;
  drivers: Array<TimelineDriver & { color: string }>;
}

function CustomTooltip({ active, payload, label, drivers }: TooltipProps) {
  if (!active || !payload?.length) return null;

  // Sort by value descending for tooltip
  const sorted = [...payload].sort((a, b) => b.value - a.value);
  const humanNames = new Set(drivers.filter((d) => d.is_human).map((d) => d.name));

  return (
    <div className="ct-tooltip">
      <div className="ct-tooltip-label">{label}</div>
      {sorted.map((entry) => (
        <div key={entry.name} className={`ct-tooltip-row${humanNames.has(entry.name) ? " ct-tooltip-row--human" : ""}`}>
          <span className="ct-tooltip-dot" style={{ background: entry.color }} />
          <span className="ct-tooltip-name">{entry.name}</span>
          <span className="ct-tooltip-pts">{entry.value} pts</span>
        </div>
      ))}
    </div>
  );
}

interface Props {
  seasonId: number;
}

export function ChampionshipTimeline({ seasonId }: Props) {
  const { data, isLoading } = useChampionshipTimeline(seasonId);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  type ViewMode = "mixed" | "humans" | "all";
  const [viewMode, setViewMode] = useState<ViewMode>("mixed");

  const driversWithColors = useMemo(
    () => (data ? assignColors(data.drivers) : []),
    [data]
  );

  const visibleDrivers = useMemo(() => {
    if (viewMode === "humans") return driversWithColors.filter((d) => d.is_human);
    if (viewMode === "all") return driversWithColors;
    // mixed: humans + top AI up to 8 total
    const humanCount = driversWithColors.filter((d) => d.is_human).length;
    const maxAI = Math.max(0, 8 - humanCount);
    const aiDrivers = driversWithColors.filter((d) => !d.is_human).slice(0, maxAI);
    return [...driversWithColors.filter((d) => d.is_human), ...aiDrivers];
  }, [driversWithColors, viewMode]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.races.map((race, i) => {
      const point: Record<string, string | number | null> = {
        label: race.label,
        completed: race.completed ? 1 : 0,
      };
      for (const d of driversWithColors) {
        // null for future races — recharts stops the line here
        point[d.name] = d.points_by_race[i] ?? null;
      }
      return point;
    });
  }, [data, driversWithColors]);

  // Label of the last completed race — used for the "now" reference line
  const lastCompletedLabel = useMemo(() => {
    if (!data) return null;
    const last = [...data.races].reverse().find((r) => r.completed);
    return last?.label ?? null;
  }, [data]);

  const toggleDriver = (name: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="ct-card">
        <div className="ct-header">
          <span className="ct-title">Championship Battle</span>
        </div>
        <div className="ct-skeleton" />
      </div>
    );
  }

  if (!data || data.races.length === 0) return null;

  const humanDrivers = driversWithColors.filter((d) => d.is_human);
  const aiDrivers = driversWithColors.filter((d) => !d.is_human);
  const sprintRounds = data.races
    .map((r, i) => ({ ...r, i }))
    .filter((r) => r.is_sprint);

  return (
    <div className="ct-card">
      <div className="ct-header">
        <span className="ct-title">Championship Battle</span>
        <div className="ct-view-modes">
          {(["humans", "mixed", "all"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              className={`ct-toggle-btn${viewMode === mode ? " ct-toggle-btn--active" : ""}`}
              onClick={() => setViewMode(mode)}
            >
              {mode === "humans" ? "Human" : mode === "mixed" ? "Mixed" : "All"}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
            interval="preserveStartEnd"
            tick={(props) => {
              const { x, y, payload } = props;
              const race = data?.races.find((r) => r.label === payload.value);
              const dim = race && !race.completed;
              return (
                <text
                  x={x} y={Number(y) + 10}
                  textAnchor="middle"
                  fontSize={11}
                  fill={dim ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.35)"}
                >
                  {payload.value}
                </text>
              );
            }}
          />
          <YAxis
            tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip
            content={<CustomTooltip drivers={driversWithColors} />}
            cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
          />

          {/* Sprint round markers */}
          {sprintRounds.map((r) => (
            <ReferenceLine
              key={r.i}
              x={r.label}
              stroke="rgba(255,199,14,0.15)"
              strokeDasharray="4 3"
            />
          ))}

          {/* "Now" marker — last completed race */}
          {lastCompletedLabel && (
            <ReferenceLine
              x={lastCompletedLabel}
              stroke="rgba(255,255,255,0.15)"
              strokeDasharray="3 3"
            />
          )}

          {visibleDrivers.map((driver) => (
            <Line
              key={driver.name}
              type="monotone"
              dataKey={driver.name}
              stroke={hidden.has(driver.name) ? "transparent" : driver.color}
              strokeWidth={driver.is_human ? 2.5 : 1.5}
              strokeOpacity={driver.is_human ? 1 : 0.55}
              strokeDasharray={driver.is_human ? undefined : "5 3"}
              dot={false}
              activeDot={hidden.has(driver.name) ? false : { r: 4, strokeWidth: 0 }}
              isAnimationActive={false}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="ct-legend">
        {humanDrivers.length > 0 && (
          <div className="ct-legend-group">
            <span className="ct-legend-group-label">Human</span>
            <div className="ct-legend-items">
              {humanDrivers.map((d) => (
                <button
                  key={d.name}
                  className={`ct-legend-item${hidden.has(d.name) ? " ct-legend-item--hidden" : ""}`}
                  onClick={() => toggleDriver(d.name)}
                >
                  <span className="ct-legend-line" style={{ background: d.color }} />
                  <span className="ct-legend-name">{d.name}</span>
                  <span className="ct-legend-pts">{d.final_points}p</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {viewMode !== "humans" && aiDrivers.length > 0 && (
          <div className="ct-legend-group">
            <span className="ct-legend-group-label">AI</span>
            <div className="ct-legend-items">
              {aiDrivers.map((d) => (
                <button
                  key={d.name}
                  className={`ct-legend-item ct-legend-item--ai${hidden.has(d.name) ? " ct-legend-item--hidden" : ""}`}
                  onClick={() => toggleDriver(d.name)}
                >
                  <span className="ct-legend-line ct-legend-line--dashed" style={{ background: d.color }} />
                  <span className="ct-legend-name">{d.name}</span>
                  <span className="ct-legend-pts">{d.final_points}p</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
