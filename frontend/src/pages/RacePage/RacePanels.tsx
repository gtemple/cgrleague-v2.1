import { Link } from "react-router-dom";
import { displayImage } from "../../utils/displayImage";
import type {
  RaceDetailResult,
  StandingsImpactRow,
  TrackHistoryRow,
} from "../../hooks/useRaceDetail";

/** Top three at display scale, so the page opens on the result, not a table. */
export function Podium({ results }: { results: RaceDetailResult[] }) {
  const top = results.filter((r) => r.finish_position != null && r.finish_position <= 3);
  if (top.length < 3) return null;
  // 2nd, 1st, 3rd — the winner stands in the middle and tallest.
  const order = [top[1], top[0], top[2]];

  return (
    <section className="rp-podium" aria-label="Podium">
      {order.map((r) => (
        <div
          key={r.driver.id}
          className={`rp-pod rp-pod--${r.finish_position}`}
          style={{ ["--pod-color" as string]: r.team.color || "var(--cgr-text-primary)" }}
        >
          <span className="rp-pod-pos">{r.finish_position}</span>
          <div className="rp-pod-avatar">
            {r.driver.profile_image
              ? <img loading="lazy" src={displayImage(r.driver.profile_image, "driver")} alt="" />
              : <span>{r.driver.initials}</span>}
          </div>
          <Link to={`/drivers/${r.driver.id}`} className="rp-pod-name">
            {r.driver.display_name}
          </Link>
          <span className="rp-pod-team">{r.team.name}</span>
          <span className="rp-pod-pts">{r.points} pts</span>
        </div>
      ))}
    </section>
  );
}

const AWARDS = [
  { key: "pole_position", label: "Pole position" },
  { key: "fastest_lap", label: "Fastest lap" },
  { key: "dotd", label: "Driver of the day" },
  { key: "cleanest_driver", label: "Cleanest driver" },
  { key: "most_overtakes", label: "Most overtakes" },
] as const;

/** The one-per-race honours, pulled out of the table where they were chips. */
export function Awards({ results }: { results: RaceDetailResult[] }) {
  const won = AWARDS.map((a) => ({
    ...a,
    holder: results.find((r) => r[a.key]),
  })).filter((a) => a.holder);
  if (!won.length) return null;

  return (
    <section className="rp-awards" aria-label="Race awards">
      {won.map((a) => (
        <div key={a.key} className="rp-award">
          <span className="rp-award-label">{a.label}</span>
          <span className="rp-award-name" style={{ color: a.holder!.team.color || undefined }}>
            {a.holder!.driver.display_name}
          </span>
        </div>
      ))}
    </section>
  );
}

/** Same car, same race — the only like-for-like comparison on the grid. */
export function TeammateBattles({ results }: { results: RaceDetailResult[] }) {
  const byTeam = new Map<string, RaceDetailResult[]>();
  for (const r of results) {
    if (!r.team.name) continue;
    byTeam.set(r.team.name, [...(byTeam.get(r.team.name) ?? []), r]);
  }
  const pairs = [...byTeam.entries()]
    .filter(([, rs]) => rs.length === 2)
    .map(([team, rs]) => {
      const [a, b] = [...rs].sort(
        (x, y) => (x.finish_position ?? 99) - (y.finish_position ?? 99),
      );
      return { team, color: a.team.color, winner: a, loser: b };
    })
    .sort((x, y) => (x.winner.finish_position ?? 99) - (y.winner.finish_position ?? 99));
  if (!pairs.length) return null;

  return (
    <section className="rp-panel" aria-label="Teammate battles">
      <h2 className="rp-panel-title">Teammate battles</h2>
      <ul className="rp-mates">
        {pairs.map((p) => (
          <li key={p.team} className="rp-mate">
            <span className="rp-mate-bar" style={{ background: p.color || "var(--cgr-border-card)" }} />
            <span className="rp-mate-team">{p.team}</span>
            <span className="rp-mate-driver is-win">{p.winner.driver.display_name}</span>
            <span className="rp-mate-score">
              {p.winner.finish_position ?? "—"} — {p.loser.finish_position ?? "—"}
            </span>
            <span className="rp-mate-driver">{p.loser.driver.display_name}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** What the round did to the championship. */
export function ChampionshipImpact({ rows }: { rows: StandingsImpactRow[] }) {
  if (!rows.length) return null;
  return (
    <section className="rp-panel" aria-label="Championship impact">
      <h2 className="rp-panel-title">Championship after this round</h2>
      <ol className="rp-impact">
        {rows.slice(0, 10).map((r) => (
          <li key={r.driver.id} className="rp-impact-row">
            <span className="rp-impact-pos">{r.position_after}</span>
            <Link to={`/drivers/${r.driver.id}`} className="rp-impact-name">
              {r.driver.display_name}
            </Link>
            {r.gained > 0 && <span className="rp-impact-gain">+{r.gained}</span>}
            <span className="rp-impact-pts">{r.points_after}</span>
            <span className={"rp-impact-move" + (r.move > 0 ? " is-up" : r.move < 0 ? " is-down" : "")}>
              {r.move > 0 ? `▲${r.move}` : r.move < 0 ? `▼${-r.move}` : "–"}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Grid slot to finishing position, one line per driver. */
export function GridFlow({ results }: { results: RaceDetailResult[] }) {
  const rows = results.filter((r) => r.grid_position != null && r.finish_position != null);
  if (rows.length < 4) return null;

  const n = Math.max(
    ...rows.map((r) => Math.max(r.grid_position!, r.finish_position!)),
  );
  const H = 300;
  const W = 260;
  const y = (pos: number) => 18 + ((pos - 1) / Math.max(n - 1, 1)) * (H - 36);

  return (
    <section className="rp-panel" aria-label="Grid to finish">
      <h2 className="rp-panel-title">Grid to finish</h2>
      <div className="rp-flow-scroll">
        <svg className="rp-flow" viewBox={`0 0 ${W} ${H}`} role="img"
             aria-label="Lines from each driver's starting slot to their finishing position">
          <text x="6" y="11" className="rp-flow-head">GRID</text>
          <text x={W - 6} y="11" className="rp-flow-head" textAnchor="end">FINISH</text>
          {rows.map((r) => {
            const y1 = y(r.grid_position!);
            const y2 = y(r.finish_position!);
            const colour = r.team.color || "var(--cgr-text-faint)";
            return (
              <g key={r.driver.id}>
                <path
                  d={`M 46 ${y1} C 110 ${y1}, 150 ${y2}, ${W - 46} ${y2}`}
                  fill="none"
                  stroke={colour}
                  strokeWidth={2}
                  opacity={0.85}
                />
                <text x="38" y={y1 + 3.5} className="rp-flow-lbl" textAnchor="end">
                  {r.grid_position}
                </text>
                <text x={W - 38} y={y2 + 3.5} className="rp-flow-lbl">
                  {r.driver.initials || r.finish_position}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

/** Who has won here before. */
export function CircuitHistory({ rows, trackName }: { rows: TrackHistoryRow[]; trackName: string }) {
  if (!rows.length) return null;
  return (
    <section className="rp-panel" aria-label="Circuit history">
      <h2 className="rp-panel-title">Previous winners at {trackName}</h2>
      <ul className="rp-history">
        {rows.map((r) => (
          <li key={`${r.season_id}-${r.round}`} className="rp-history-row">
            <Link to={`/seasons/${r.season_id}/races/${r.round}`} className="rp-history-season">
              S{r.season_id}
            </Link>
            <span className="rp-history-bar" style={{ background: r.team.color || "var(--cgr-border-card)" }} />
            <Link to={`/drivers/${r.driver.id}`} className="rp-history-name">
              {r.driver.display_name}
            </Link>
            <span className="rp-history-team">{r.team.name}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
