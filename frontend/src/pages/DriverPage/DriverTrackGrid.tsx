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
          const flagImg = row.track.country
            ? displayImage(row.track.country, "flags")
            : undefined;

          return (
            <a key={row.track.id} className="dtg-card" href={`/tracks/${row.track.id}`}>
              <div className="dtg-track-name">
                {flagImg && <img className="dtg-flag" src={flagImg} alt={row.track.country} />}
                <span>{row.track.name}</span>
              </div>
              <div className="dtg-stats">
                <span className="dtg-stat-value">{row.total_points}</span>
                <span className="dtg-stat-sep">pts</span>
                {row.wins > 0 && (
                  <>
                    <span className="dtg-stat-sep">·</span>
                    <span className="dtg-stat-wins">{row.wins}W</span>
                  </>
                )}
                {row.avg_finish_position != null && (
                  <>
                    <span className="dtg-stat-sep">·</span>
                    <span>P{row.avg_finish_position} avg</span>
                  </>
                )}
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
