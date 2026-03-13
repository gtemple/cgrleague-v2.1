import { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Link } from "react-router-dom";
import type { RankingsHistory, RankingsHistoryDriver } from "../../hooks/useArticles";

const HUMAN_COLORS = [
  "#f87171", "#60a5fa", "#34d399", "#fbbf24",
  "#a78bfa", "#f472b6", "#38bdf8", "#fb923c",
];
const AI_COLORS = [
  "#7f3f3f", "#2d4f7a", "#1f6b4c", "#7a5c12",
  "#4c3d7a", "#7a3059", "#1a5f7a", "#7a4020",
];

function assignColors(drivers: RankingsHistoryDriver[]) {
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
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const sorted = [...payload]
    .filter((e) => e.value != null)
    .sort((a, b) => a.value - b.value);
  return (
    <div className="prh-tooltip">
      <div className="prh-tooltip-label">{label}</div>
      {sorted.map((entry) => (
        <div key={entry.name} className="prh-tooltip-row">
          <span className="prh-tooltip-dot" style={{ background: entry.color }} />
          <span className="prh-tooltip-name">{entry.name}</span>
          <span className="prh-tooltip-rank">P{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

interface Props {
  history: RankingsHistory;
  seasonId: number | null;
}

export function PowerRankingsHistory({ history, seasonId }: Props) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [humansOnly, setHumansOnly] = useState(false);

  const driversWithColors = useMemo(() => assignColors(history.drivers), [history]);
  const humanDrivers = driversWithColors.filter((d) => d.is_human);
  const aiDrivers = driversWithColors.filter((d) => !d.is_human);
  const visibleDrivers = humansOnly ? humanDrivers : driversWithColors;

  const maxRank = useMemo(() => {
    let max = 1;
    for (const d of history.drivers) {
      for (const r of d.ranks) {
        if (r != null && r > max) max = r;
      }
    }
    return max;
  }, [history]);

  const chartData = useMemo(() => {
    return history.rounds.map((round, i) => {
      const point: Record<string, string | number | null | boolean> = {
        label: `R${round.round}`,
        full_name: round.track_name,
        is_current: round.is_current,
      };
      for (const d of driversWithColors) {
        point[d.name] = d.ranks[i] ?? null;
      }
      return point;
    });
  }, [history, driversWithColors]);

  const currentLabel = history.rounds.find((r) => r.is_current);

  const toggle = (name: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div className="prh-card">
      <div className="prh-header">
        <span className="prh-title">Rankings History</span>
        <div className="prh-header-controls">
          {aiDrivers.length > 0 && (
            <button
              className={`prh-filter-btn${humansOnly ? " prh-filter-btn--active" : ""}`}
              onClick={() => setHumansOnly((v) => !v)}
            >
              Humans only
            </button>
          )}
          {seasonId && (
            <Link to={`/seasons/${seasonId}`} className="prh-season-link">
              View season →
            </Link>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
            tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
          />
          <YAxis
            domain={[1, maxRank]}
            reversed
            tickCount={maxRank}
            allowDecimals={false}
            tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={28}
            tickFormatter={(v) => `P${v}`}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
          />

          {currentLabel && (
            <ReferenceLine
              x={`R${currentLabel.round}`}
              stroke="rgba(255,199,14,0.3)"
              strokeDasharray="4 3"
              label={{
                value: "Now",
                position: "top",
                fill: "rgba(255,199,14,0.5)",
                fontSize: 10,
              }}
            />
          )}

          {visibleDrivers.map((d) => (
            <Line
              key={d.name}
              type="monotone"
              dataKey={d.name}
              stroke={hidden.has(d.name) ? "transparent" : d.color}
              strokeWidth={d.is_human ? 2.5 : 1.5}
              strokeOpacity={d.is_human ? 1 : 0.5}
              strokeDasharray={d.is_human ? undefined : "5 3"}
              dot={false}
              activeDot={hidden.has(d.name) ? false : { r: 4, strokeWidth: 0 }}
              isAnimationActive={false}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <div className="prh-legend">
        {humanDrivers.length > 0 && (
          <div className="prh-legend-group">
            <span className="prh-legend-label">Human</span>
            <div className="prh-legend-items">
              {humanDrivers.map((d) => (
                <button
                  key={d.name}
                  className={`prh-legend-item${hidden.has(d.name) ? " prh-legend-item--hidden" : ""}`}
                  onClick={() => toggle(d.name)}
                >
                  <span className="prh-legend-line" style={{ background: d.color }} />
                  <span>{d.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {!humansOnly && aiDrivers.length > 0 && (
          <div className="prh-legend-group">
            <span className="prh-legend-label">AI</span>
            <div className="prh-legend-items">
              {aiDrivers.map((d) => (
                <button
                  key={d.name}
                  className={`prh-legend-item prh-legend-item--ai${hidden.has(d.name) ? " prh-legend-item--hidden" : ""}`}
                  onClick={() => toggle(d.name)}
                >
                  <span className="prh-legend-line prh-legend-line--dashed" style={{ background: d.color }} />
                  <span>{d.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
