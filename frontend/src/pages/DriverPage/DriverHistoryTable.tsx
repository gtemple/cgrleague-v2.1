// src/pages/DriverPage/DriverHistoryTable.tsx
import { displayImage } from "../../utils/displayImage";
import { Loader } from "../../components/Loader";
import { useDriverHistory } from "../../hooks/useDriverHistory";

export function DriverHistoryTable({ driverId }: { driverId?: string }) {
  const { data, isLoading, error } = useDriverHistory(driverId);

  if (isLoading) {
    return (
      <section className="border history-section">
        <h2 className="section-title">Career by Season</h2>
        <Loader label="Loading history…" full />
      </section>
    );
  }

  if (error) {
    return (
      <section className="border history-section">
        <h2 className="section-title">Career by Season</h2>
        <div className="state state-error">Failed to load history.</div>
      </section>
    );
  }

  const rows = data?.history ?? [];
  if (!rows.length) {
    return (
      <section className="border history-section">
        <h2 className="section-title">Career by Season</h2>
        <div className="state">No history yet.</div>
      </section>
    );
  }

  return (
    <section className="border history-section">
      <h2 className="section-title">Career by Season</h2>

      <div className="table-wrap">
        <div className="table-hint">Drag sideways to see more →</div>
        <table className="history-table">
          <thead>
            <tr>
              <th className="col-season">Season</th>
              <th className="col-team">Team</th>
              <th>Pts</th>
              <th>Wins</th>
              <th>Podiums</th>
              <th>Poles</th>
              <th>FL</th>
              <th>Laps</th>
              <th>Races</th>
              <th>Finished</th>
              <th>DNFs</th>
              <th>Avg Fin</th>
              <th>Best</th>
              <th>Team Pts</th>
              <th>PoP %</th>
              <th>Cleanest</th>
              <th>Most Ovt.</th>
              <th>DOTD</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const seasonLabel = r.season.year ?? r.season.name ?? `S${r.season.id}`;
              return (
                <tr key={r.season.id}>
                  <td className="col-season">
                    <div className="season-cell">
                      <span className="season-pill">{seasonLabel}</span>
                    </div>
                  </td>

                  <td className="col-team">
                    <div className="team-cell">
                      {r.team.logo_image ? (
                        <div className="team-logo sm">
                          <img src={displayImage(r.team.logo_image, "team")} alt={r.team.display_name} />
                        </div>
                      ) : (
                        <div className="team-logo team-logo-fallback sm" aria-hidden />
                      )}
                      <span className="team-name">{r.team.display_name}</span>
                    </div>
                  </td>

                  <td title={`Base ${r.points_breakdown.base} + FL ${r.points_breakdown.fastest_lap_bonus}`}>
                    {r.points}
                  </td>
                  <td>{r.wins}</td>
                  <td>{r.podiums}</td>
                  <td>{r.poles}</td>
                  <td>{r.fastest_laps}</td>
                  <td>{r.laps}</td>
                  <td>{r.races}</td>
                  <td>{r.races_completed}</td>
                  <td>{r.dnfs}</td>
                  <td>{r.avg_finish != null ? r.avg_finish.toFixed(1) : "—"}</td>
                  <td>{r.best_finish ?? "—"}</td>
                  <td>{r.team_points}</td>
                  <td>{r.pop_share != null ? r.pop_share.toFixed(1) : "—"}</td>
                  <td>{r.cleanest_awards}</td>
                  <td>{r.most_overtakes_awards}</td>
                  <td>{r.dotds}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
