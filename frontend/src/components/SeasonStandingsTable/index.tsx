import { Link } from "react-router-dom";
import { useSeasonStandings } from "../../hooks/useSeasonStandings";
import { displayImage } from "../../utils/displayImage";
import "./style.css";

type SeasonStandingRow = {
  driver_season_id: number;
  points: number;
  driver: {
    display_name: string;
    profile_image?: string | null;
  };
  team: {
    name: string;
    logo_image?: string | null;
  };
};

export function SeasonStandingsTable({ seasonId, limit }: { seasonId: number; limit?: number }) {
  const { data, isLoading, error } = useSeasonStandings(seasonId);

  if (isLoading) {
    return (
      <div className="card standings-card">
        <div className="card-header">Driver Standings</div>
        <div className="standings-skeleton">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton-row" />
          ))}
        </div>
      </div>
    );
  }

  if (error) return <p className="standings-state-error">Failed to load standings.</p>;
  if (!data?.length) return <p className="standings-muted">No results.</p>;

  const allRows = (data as SeasonStandingRow[]).slice().sort((a, b) => b.points - a.points);
  const rows = limit ? allRows.slice(0, limit) : allRows;
  const hasMore = limit != null && allRows.length > limit;

  return (
    <div className="card standings-card">
      <div className="card-header">Driver Standings</div>
      <div className="standings-list">
        {rows.map((row, idx) => {
          const pos = idx + 1;
          const avatar = row.driver?.profile_image
            ? displayImage(row.driver.profile_image, "driver")
            : null;
          const teamLogo = row.team?.logo_image
            ? displayImage(row.team.name, "team")
            : null;

          return (
            <div key={row.driver_season_id} className={`standings-row pos-${Math.min(pos, 4)}`}>
              <span className="standings-pos">{pos}</span>
              <div className="standings-avatar">
                {avatar
                  ? <img src={avatar} alt={row.driver.display_name} />
                  : <div className="standings-avatar-fallback" />}
              </div>
              <div className="standings-info">
                <div className="standings-name">{row.driver.display_name}</div>
                <div className="standings-team">
                  {teamLogo && (
                    <img className="standings-team-logo" src={teamLogo} alt={row.team.name} />
                  )}
                  <span>{row.team.name}</span>
                </div>
              </div>
              <div className="standings-points">{row.points}</div>
            </div>
          );
        })}
      </div>
      {hasMore && (
        <Link to={`/seasons/${seasonId}`} className="standings-see-all">
          Full standings →
        </Link>
      )}
    </div>
  );
}
