import { useDriverTrackStats } from "../../hooks/useDriverTrackStats";
import { displayImage } from "../../utils/displayImage";
import { Loader } from "../../components/Loader";

export function DriverTrackGrid({ driverId }: { driverId?: string }) {
  const { data, isLoading, error } = useDriverTrackStats(driverId);

  if (isLoading) {
    return (
      <section className="dtg-section">
        <h2 className="section-title">Track Record</h2>
        <Loader label="Loading tracks…" full />
      </section>
    );
  }

  if (error || !data?.length) return null;

  return (
    <section className="dtg-section">
      <h2 className="section-title">Track Record</h2>
      <div className="dtg-grid">
        {data.map((row) => {
          const trackImg = row.track.image
            ? displayImage(row.track.image, "trackImage")
            : undefined;
          const flagImg = row.track.country
            ? displayImage(row.track.country, "flags")
            : undefined;

          return (
            <a
              key={row.track.id}
              className="dtg-card"
              href={`/tracks/${row.track.id}`}
            >
              {trackImg && (
                <div className="dtg-card-bg">
                  <img src={trackImg} alt="" aria-hidden />
                </div>
              )}
              <div className="dtg-card-body">
                <div className="dtg-track-name">
                  {flagImg && (
                    <img className="dtg-flag" src={flagImg} alt={row.track.country} />
                  )}
                  <span>{row.track.name}</span>
                </div>
                <div className="dtg-stats">
                  <div className="dtg-stat">
                    <span className="dtg-stat-value">{row.total_points}</span>
                    <span className="dtg-stat-label">Pts</span>
                  </div>
                  <div className="dtg-stat">
                    <span className="dtg-stat-value">{row.wins}</span>
                    <span className="dtg-stat-label">Wins</span>
                  </div>
                  <div className="dtg-stat">
                    <span className="dtg-stat-value">{row.podiums}</span>
                    <span className="dtg-stat-label">Pods</span>
                  </div>
                  <div className="dtg-stat">
                    <span className="dtg-stat-value">
                      {row.avg_finish_position ?? "—"}
                    </span>
                    <span className="dtg-stat-label">Avg Fin</span>
                  </div>
                  <div className="dtg-stat">
                    <span className="dtg-stat-value">{row.races_count}</span>
                    <span className="dtg-stat-label">Races</span>
                  </div>
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
