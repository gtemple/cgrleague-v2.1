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
const CONSTRUCTOR_COLORS = [
  "#f87171", "#60a5fa", "#34d399", "#fbbf24",
  "#a78bfa", "#f472b6", "#38bdf8", "#fb923c",
  "#e879f9", "#4ade80",
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

interface SeriesItem {
  name: string;
  color: string;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  humanNames: Set<string>;
}

function CustomTooltip({ active, payload, label, humanNames }: TooltipProps) {
  if (!active || !payload?.length) return null;

  const sorted = [...payload].sort((a, b) => b.value - a.value);

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

type ViewMode = "mixed" | "humans" | "all";
type ChartType = "drivers" | "constructors";

export function ChampionshipTimeline({ seasonId }: Props) {
  const { data, isLoading } = useChampionshipTimeline(seasonId);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("mixed");
  const [chartType, setChartType] = useState<ChartType>("drivers");

  const driversWithColors = useMemo(
    () => (data ? assignColors(data.drivers) : []),
    [data]
  );

  const visibleDrivers = useMemo(() => {
    if (viewMode === "humans") return driversWithColors.filter((d) => d.is_human);
    if (viewMode === "all") return driversWithColors;
    const humanCount = driversWithColors.filter((d) => d.is_human).length;
    const maxAI = Math.max(0, 8 - humanCount);
    const aiDrivers = driversWithColors.filter((d) => !d.is_human).slice(0, maxAI);
    return [...driversWithColors.filter((d) => d.is_human), ...aiDrivers];
  }, [driversWithColors, viewMode]);

  const driverChartData = useMemo(() => {
    if (!data) return [];
    return data.races.map((race, i) => {
      const point: Record<string, string | number | null> = {
        label: race.label,
        completed: race.completed ? 1 : 0,
      };
      for (const d of driversWithColors) {
        point[d.name] = d.points_by_race[i] ?? null;
      }
      return point;
    });
  }, [data, driversWithColors]);

  // Constructor data: de-cumulate per driver → group by team → re-cumulate
  const constructors = useMemo(() => {
    if (!data) return [];
    const numRaces = data.races.length;
    const lastCompletedIdx = data.races.reduce((acc, r, i) => (r.completed ? i : acc), -1);

    const teamMap = new Map<string, number[]>();
    for (const d of data.drivers) {
      const perRace: number[] = [];
      for (let i = 0; i < numRaces; i++) {
        const cur = d.points_by_race[i];
        if (cur === null || cur === undefined) {
          perRace.push(0);
        } else {
          const prev = i > 0 ? (d.points_by_race[i - 1] ?? 0) : 0;
          perRace.push(cur - (prev as number));
        }
      }
      if (!teamMap.has(d.team)) {
        teamMap.set(d.team, Array(numRaces).fill(0));
      }
      const teamArr = teamMap.get(d.team)!;
      for (let i = 0; i <= lastCompletedIdx; i++) {
        teamArr[i] += perRace[i];
      }
    }

    let colorIdx = 0;
    return Array.from(teamMap.entries())
      .map(([name, perRaceArr]) => {
        const points_by_race: (number | null)[] = [];
        let running = 0;
        for (let i = 0; i < numRaces; i++) {
          if (i <= lastCompletedIdx) {
            running += perRaceArr[i];
            points_by_race.push(running);
          } else {
            points_by_race.push(null);
          }
        }
        return {
          name,
          color: CONSTRUCTOR_COLORS[colorIdx++ % CONSTRUCTOR_COLORS.length],
          final_points: running,
          points_by_race,
        };
      })
      .sort((a, b) => b.final_points - a.final_points);
  }, [data]);

  const constructorChartData = useMemo(() => {
    if (!data) return [];
    return data.races.map((race, i) => {
      const point: Record<string, string | number | null> = {
        label: race.label,
        completed: race.completed ? 1 : 0,
      };
      for (const c of constructors) {
        point[c.name] = c.points_by_race[i] ?? null;
      }
      return point;
    });
  }, [data, constructors]);

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

  const isConstructors = chartType === "constructors";
  const activeSeries: SeriesItem[] = isConstructors ? constructors : visibleDrivers;
  const activeChartData = isConstructors ? constructorChartData : driverChartData;
  const humanNames = isConstructors
    ? new Set<string>()
    : new Set(driversWithColors.filter((d) => d.is_human).map((d) => d.name));

  return (
    <div className="ct-card">
      <div className="ct-header">
        <span className="ct-title">Championship Battle</span>
        <div className="ct-header-controls">
          {/* Drivers / Constructors toggle */}
          <div className="ct-view-modes">
            {(["drivers", "constructors"] as ChartType[]).map((t) => (
              <button
                key={t}
                className={`ct-toggle-btn${chartType === t ? " ct-toggle-btn--active" : ""}`}
                onClick={() => setChartType(t)}
              >
                {t === "drivers" ? "Drivers" : "Constructors"}
              </button>
            ))}
          </div>

          {/* Human / Mixed / All — drivers only */}
          {!isConstructors && (
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
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={activeChartData} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
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
            content={<CustomTooltip humanNames={humanNames} />}
            cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
          />

          {sprintRounds.map((r) => (
            <ReferenceLine
              key={r.i}
              x={r.label}
              stroke="rgba(255,199,14,0.15)"
              strokeDasharray="4 3"
            />
          ))}

          {lastCompletedLabel && (
            <ReferenceLine
              x={lastCompletedLabel}
              stroke="rgba(255,255,255,0.15)"
              strokeDasharray="3 3"
            />
          )}

          {activeSeries.map((item) => {
            const isHuman = !isConstructors && (item as TimelineDriver & { color: string }).is_human;
            return (
              <Line
                key={item.name}
                type="monotone"
                dataKey={item.name}
                stroke={hidden.has(item.name) ? "transparent" : item.color}
                strokeWidth={isHuman || isConstructors ? 2.5 : 1.5}
                strokeOpacity={isHuman || isConstructors ? 1 : 0.55}
                strokeDasharray={isHuman || isConstructors ? undefined : "5 3"}
                dot={false}
                activeDot={hidden.has(item.name) ? false : { r: 4, strokeWidth: 0 }}
                isAnimationActive={false}
                connectNulls={false}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="ct-legend">
        {isConstructors ? (
          <div className="ct-legend-group">
            <div className="ct-legend-items">
              {constructors.map((c) => (
                <button
                  key={c.name}
                  className={`ct-legend-item${hidden.has(c.name) ? " ct-legend-item--hidden" : ""}`}
                  onClick={() => toggleDriver(c.name)}
                >
                  <span className="ct-legend-line" style={{ background: c.color }} />
                  <span className="ct-legend-name">{c.name}</span>
                  <span className="ct-legend-pts">{c.final_points}p</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
