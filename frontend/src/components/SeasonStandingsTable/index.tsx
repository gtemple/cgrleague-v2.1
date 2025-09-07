import { useSeasonStandings } from "../../hooks/useSeasonStandings";
import "./styles.css"

type SeasonStandingRow = {
  driver_season_id: number;
  points: number;
  driver: {
    display_name: string;
    img?: string | null; // portrait URL
  };
  team: {
    name: string;
    logo?: string | null; // logo URL
  };
};

export function SeasonStandingsTable({ seasonId }: { seasonId: number }) {
  const { data, isLoading, error } = useSeasonStandings(seasonId);

  if (isLoading) {
    return (
      <div className="standings-card">
        <div className="standings-header">
          <h3>Driver Standings</h3>
        </div>
        <div className="standings-skeleton">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton-row" />
          ))}
        </div>
      </div>
    );
  }

  if (error) return <p className="state state-error">Failed: {error.message}</p>;
  if (!data?.length) return <p className="state">No results.</p>;

  const rows = (data as SeasonStandingRow[]).slice().sort((a, b) => b.points - a.points);
  const maxPts = Math.max(...rows.map((r) => r.points));

  return (
    <div className="standings-card">
      <div className="standings-header">
        <h3>Driver Standings</h3>
      </div>

      <div className="table-scroll">
        <table className="standings-table" aria-label="Season driver standings">
          <colgroup>
            <col style={{ width: "4rem" }} />
            <col />
            <col />
            <col style={{ width: "6rem" }} />
          </colgroup>
          <thead>
            <tr>
              <th>#</th>
              <th>Driver</th>
              <th>Team</th>
              <th>Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const position = idx + 1;
              const podium =
                position === 1 ? "pos-gold" : position === 2 ? "pos-silver" : position === 3 ? "pos-bronze" : "";
              const pct = maxPts > 0 ? Math.round((row.points / maxPts) * 100) : 0;

              return (
                <tr key={row.driver_season_id} className={podium}>
                  <td className="pos">
                    <span className="pos-badge">{position}</span>
                  </td>

                  <td className="driver-cell">
                    {row.driver?.img ? (
                      <img className="avatar" src={row.driver.img} alt={`${row.driver.display_name} portrait`} />
                    ) : (
                      <div className="avatar avatar-fallback" aria-hidden />
                    )}
                    <span className="driver-name">{row.driver.display_name}</span>
                  </td>

                  <td className="team-cell">
                    {row.team?.logo ? (
                      <img className="team-logo" src={row.team.logo} alt={`${row.team.name} logo`} />
                    ) : (
                      <div className="team-logo team-logo-fallback" aria-hidden />
                    )}
                    <span className="team-name">{row.team.name}</span>
                  </td>

                  <td className="points-cell">
                    <div className="points">{row.points}</div>
                    <div className="bar">
                      <span className="fill" style={{ width: `${pct}%` }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
