import { Link } from "react-router-dom";
import { useHistoryTeaser } from "../../hooks/useHistoryTeaser";
import { displayImage } from "../../utils/displayImage";
import "./style.css";

export function HistoryTeaser() {
  const { data, isLoading } = useHistoryTeaser();

  if (isLoading || !data) return null;

  const { season_id, race, results, blurb } = data;
  const winner = results[0];
  if (!winner) return null;

  const trackImg = race.track.image
    ? displayImage(race.track.image, "trackImage")
    : null;
  const flagImg = race.track.country
    ? displayImage(race.track.country, "flags")
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
        {/* Header */}
        <div className="ht-header">
          <span className="ht-eyebrow">This Round in CGR History</span>
          <span className="ht-meta">
            {flagImg && <img className="ht-flag" src={flagImg} alt={race.track.country} />}
            Season {season_id} · R{race.round} · {race.track.name}
          </span>
        </div>

        {/* AI blurb */}
        {blurb && <p className="ht-blurb">{blurb}</p>}

        {/* Horizontal podium */}
        <div className="ht-podium">
          {results.map((r) => {
            const avatar = r.driver.profile_image
              ? displayImage(r.driver.profile_image, "driver")
              : null;
            const isWinner = r.finish_position === 1;
            return (
              <Link
                key={r.driver.id}
                to={`/drivers/${r.driver.id}`}
                className={`ht-driver${isWinner ? " ht-driver--winner" : ""}`}
              >
                <div className="ht-avatar">
                  {avatar
                    ? <img src={avatar} alt={r.driver.display_name} />
                    : <div className="ht-avatar-fallback" />}
                </div>
                <span className={`ht-pos-badge ht-pos-${r.finish_position}`}>
                  P{r.finish_position}
                </span>
                <span className="ht-driver-name">{r.driver.display_name}</span>
                <span className="ht-driver-team">{r.team.name}</span>
                {(r.pole_position || r.fastest_lap) && (
                  <div className="ht-chips">
                    {r.pole_position && <span className="ht-chip ht-chip--pole">Pole</span>}
                    {r.fastest_lap && <span className="ht-chip ht-chip--fl">FL</span>}
                  </div>
                )}
              </Link>
            );
          })}
        </div>

        <Link to={`/seasons/${season_id}/races/${race.round}`} className="ht-link">
          View full race →
        </Link>
      </div>
    </section>
  );
}
