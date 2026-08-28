import { Link } from "react-router-dom";
import type { SessionData, SessionRaceEntry, SessionDriverEntry } from "../../hooks/useArticles";
import { displayImage } from "../../utils/displayImage";
import "./session.css";

function RaceChapter({
  entry,
  index,
  total,
  seasonId,
}: {
  entry: SessionRaceEntry;
  index: number;
  total: number;
  seasonId: number | null;
}) {
  const flag = entry.track_country ? displayImage(entry.track_country, "flags") : null;
  const heading = (
    <>
      {flag && <img loading="lazy" className="ses-chapter-flag" src={flag} alt="" />}
      {entry.track_name}
    </>
  );

  return (
    <li className="ses-chapter">
      <div className="ses-chapter-marker">
        <span className="ses-chapter-index">{index + 1}</span>
        {index < total - 1 && <span className="ses-chapter-line" />}
      </div>
      <div className="ses-chapter-body">
        <div className="ses-chapter-meta">
          Round {entry.round}
          {entry.is_sprint && <span className="ses-sprint-tag">Sprint</span>}
        </div>
        <div className="ses-chapter-track">
          {seasonId != null ? (
            <Link to={`/seasons/${seasonId}/races/${entry.round}`}>{heading}</Link>
          ) : (
            heading
          )}
        </div>
        {entry.beat && <p className="ses-chapter-beat">{entry.beat}</p>}
        {entry.podium.length > 0 && (
          <ol className="ses-podium">
            {entry.podium.map((name, i) => (
              <li key={name} className={`ses-podium-slot ses-podium-slot--p${i + 1}`}>
                <span className="ses-podium-pos">P{i + 1}</span>
                <span className="ses-podium-name">{name}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </li>
  );
}

function PointsRow({ entry, rank, best }: { entry: SessionDriverEntry; rank: number; best: number }) {
  const width = best > 0 ? Math.max((entry.points / best) * 100, 2) : 0;
  const avatar = entry.profile_image ? displayImage(entry.profile_image, "driver") : null;
  const color = entry.team_color || "var(--cgr-text-faint)";

  return (
    <li className="ses-points-row">
      <span className="ses-points-rank">{rank}</span>
      <span className="ses-points-avatar" style={{ borderColor: color }}>
        {avatar ? <img loading="lazy" src={avatar} alt="" /> : null}
      </span>
      <span className="ses-points-driver">
        <span className="ses-points-name">
          {entry.name}
          {entry.is_human && <span className="ses-human-dot" />}
        </span>
        <span className="ses-points-team" style={{ color }}>{entry.team}</span>
      </span>
      <span className="ses-points-bar">
        <span className="ses-points-fill" style={{ width: `${width}%`, background: color }} />
      </span>
      <span className="ses-points-tally">
        {entry.wins > 0 && <span className="ses-tally-chip ses-tally-chip--win">{entry.wins}W</span>}
        {entry.podiums > 0 && <span className="ses-tally-chip">{entry.podiums}P</span>}
      </span>
      <span className="ses-points-value">{entry.points}</span>
    </li>
  );
}

export function SessionPanels({ data, seasonId }: { data: SessionData; seasonId: number | null }) {
  const best = data.session_points[0]?.points ?? 0;
  const movers = [...data.standings_swing]
    .filter((s) => s.pos_delta !== null && s.pos_delta !== 0)
    .sort((a, b) => Math.abs(b.pos_delta!) - Math.abs(a.pos_delta!))
    .slice(0, 5);

  return (
    <div className="ses-panels">
      <section className="ses-panel">
        <div className="ses-panel-label">The Session · {data.race_count} Races</div>
        <ol className="ses-chapters">
          {data.races.map((entry, i) => (
            <RaceChapter
              key={entry.race_id}
              entry={entry}
              index={i}
              total={data.races.length}
              seasonId={seasonId}
            />
          ))}
        </ol>
      </section>

      {data.driver_of_the_session && (
        <section className="ses-panel ses-dots">
          <div className="ses-panel-label">Driver of the Session</div>
          <div className="ses-dots-name">{data.driver_of_the_session.name}</div>
          <p className="ses-dots-reason">{data.driver_of_the_session.reason}</p>
        </section>
      )}

      <section className="ses-panel">
        <div className="ses-panel-label">Points Won Across the Session</div>
        <ol className="ses-points">
          {data.session_points.map((entry, i) => (
            <PointsRow key={entry.driver_id} entry={entry} rank={i + 1} best={best} />
          ))}
        </ol>
      </section>

      {movers.length > 0 && (
        <section className="ses-panel">
          <div className="ses-panel-label">Championship Swing</div>
          <ul className="ses-swing">
            {movers.map((s) => (
              <li key={s.name} className="ses-swing-row">
                <span className="ses-swing-name">
                  {s.name}
                  {s.is_human && <span className="ses-human-dot" />}
                </span>
                <span className="ses-swing-move">
                  P{s.prev_pos} <span className="ses-swing-arrow">→</span> P{s.pos}
                </span>
                <span className={`ses-swing-delta ses-swing-delta--${s.pos_delta! > 0 ? "up" : "down"}`}>
                  {s.pos_delta! > 0 ? `▲${s.pos_delta}` : `▼${Math.abs(s.pos_delta!)}`}
                </span>
                <span className="ses-swing-points">+{s.points_gained} pts</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
