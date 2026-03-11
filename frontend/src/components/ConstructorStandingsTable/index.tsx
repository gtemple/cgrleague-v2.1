import { useConstructorStandings } from "../../hooks/useConstructorStandings";
import { displayImage } from "../../utils/displayImage";
import "./style.css";

type ConstructorRow = {
  team_season_id: number;
  team: {
    id: number;
    name: string;
    display_name?: string | null;
    logo_image?: string | null;
  };
  points: number;
};

export function ConstructorStandingsTable({ seasonId }: { seasonId: number }) {
  const { data, isLoading, error } = useConstructorStandings(seasonId);

  if (isLoading) {
    return (
      <div className="card standings-card">
        <div className="card-header">Constructor Standings</div>
        <div className="standings-skeleton">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-row" />
          ))}
        </div>
      </div>
    );
  }

  if (error) return <p className="standings-state-error">Failed to load standings.</p>;
  if (!data?.length) return <p className="standings-muted">No results.</p>;

  const rows = [...(data as ConstructorRow[])].sort((a, b) => b.points - a.points);

  return (
    <div className="card standings-card">
      <div className="card-header">Constructor Standings</div>
      <div className="standings-list">
        {rows.map((row, idx) => {
          const pos = idx + 1;
          const label = row.team.display_name || row.team.name;
          const logoKey = row.team.logo_image || row.team.name;
          const logo = displayImage(logoKey, "team");

          return (
            <div key={row.team.id ?? row.team.name} className={`standings-row pos-${Math.min(pos, 4)}`}>
              <span className="standings-pos">{pos}</span>
              <div className="standings-team-logo-wrap">
                {logo
                  ? <img src={logo} alt={label} />
                  : <div className="standings-avatar-fallback" />}
              </div>
              <div className="standings-info">
                <div className="standings-name">{label}</div>
              </div>
              <div className="standings-points">{row.points}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
