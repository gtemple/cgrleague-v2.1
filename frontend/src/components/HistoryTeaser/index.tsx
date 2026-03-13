import { Link } from "react-router-dom";
import { useHistoryTeaser } from "../../hooks/useHistoryTeaser";
import { displayImage } from "../../utils/displayImage";
import "./style.css";

const POSITION_LABELS: Record<number, string> = { 1: "P1", 2: "P2", 3: "P3" };

export function HistoryTeaser() {
  const { data, isLoading } = useHistoryTeaser();

  if (isLoading || !data) return null;

  const { season_id, race, results } = data;
  const winner = results[0];
  if (!winner) return null;

  const trackImg = race.track.image
    ? displayImage(race.track.image, "trackImage")
    : null;
  const flagImg = race.track.country
    ? displayImage(race.track.country, "flags")
    : null;
  const winnerAvatar = winner.driver.profile_image
    ? displayImage(winner.driver.profile_image, "driver")
    : null;

  return (
    <section className="ht-card">
      {trackImg && (
        <>
          <img className="ht-bg" src={trackImg} alt="" aria-hidden="true" />
          <div className="ht-overlay" />
        </>
      )}

      <div className="ht-content">
        <div className="ht-header">
          <span className="ht-eyebrow">This Round in CGR History</span>
          <span className="ht-meta">
            {flagImg && <img className="ht-flag" src={flagImg} alt={race.track.country} />}
            Season {season_id} · Round {race.round} · {race.track.name}
          </span>
        </div>

        <div className="ht-podium">
          {/* Winner — prominent */}
          <Link to={`/drivers/${winner.driver.id}`} className="ht-winner">
            <div className="ht-winner-avatar">
              {winnerAvatar
                ? <img src={winnerAvatar} alt={winner.driver.display_name} />
                : <div className="ht-avatar-fallback" />}
            </div>
            <div className="ht-winner-info">
              <span className="ht-pos-badge ht-pos-1">P1</span>
              <span className="ht-winner-name">{winner.driver.display_name}</span>
              <span className="ht-winner-team">{winner.team.name}</span>
            </div>
            <div className="ht-winner-chips">
              {winner.pole_position && <span className="ht-chip ht-chip--pole">Pole</span>}
              {winner.fastest_lap && <span className="ht-chip ht-chip--fl">FL</span>}
            </div>
          </Link>

          {/* P2 + P3 */}
          {results.slice(1).map((r) => {
            const avatar = r.driver.profile_image
              ? displayImage(r.driver.profile_image, "driver")
              : null;
            const label = POSITION_LABELS[r.finish_position] ?? `P${r.finish_position}`;
            return (
              <Link key={r.driver.id} to={`/drivers/${r.driver.id}`} className="ht-row">
                <div className="ht-row-avatar">
                  {avatar
                    ? <img src={avatar} alt={r.driver.display_name} />
                    : <div className="ht-avatar-fallback ht-avatar-fallback--sm" />}
                </div>
                <span className={`ht-pos-badge ht-pos-${r.finish_position}`}>{label}</span>
                <span className="ht-row-name">{r.driver.display_name}</span>
                <span className="ht-row-team">{r.team.name}</span>
                {r.fastest_lap && <span className="ht-chip ht-chip--fl">FL</span>}
              </Link>
            );
          })}
        </div>

        <Link
          to={`/seasons/${season_id}/races/${race.round}`}
          className="ht-link"
        >
          View full race →
        </Link>
      </div>
    </section>
  );
}
