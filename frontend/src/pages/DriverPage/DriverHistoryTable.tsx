// src/pages/DriverPage/DriverHistoryTable.tsx
import { displayImage } from "../../utils/displayImage";
import { Loader } from "../../components/Loader";
import { useDriverHistory } from "../../hooks/useDriverHistory";

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="dp-info-tooltip">
      <span className="dp-info-tooltip-icon">?</span>
      <span className="dp-info-tooltip-text">{text}</span>
    </span>
  );
}

const GRID_NOTE = "Grid position has been recorded from Season 7";

export function DriverHistoryTable({ driverId }: { driverId?: string }) {
  const { data, isLoading, error } = useDriverHistory(driverId);

  if (isLoading) {
    return (
      <section className="dp-history-section">
        <h2 className="dp-section-title">Career by Season</h2>
        <Loader label="Loading history…" full />
      </section>
    );
  }

  if (error) {
    return (
      <section className="dp-history-section">
        <h2 className="dp-section-title">Career by Season</h2>
        <div className="dp-state dp-state-error">Failed to load history.</div>
      </section>
    );
  }

  const rows = data?.history ?? [];
  if (!rows.length) {
    return (
      <section className="dp-history-section">
        <h2 className="dp-section-title">Career by Season</h2>
        <div className="dp-state">No history yet.</div>
      </section>
    );
  }

  return (
    <section className="dp-history-section">
      <h2 className="dp-section-title">Career by Season</h2>

      <div className="dp-table-wrap">
        <div className="dp-table-hint">Drag sideways to see more →</div>
        <table className="dp-history-table">
          <thead>
            <tr>
              <th className="dp-col-season">Season</th>
              <th className="dp-col-team">Team</th>
              <th>Pts</th>
              <th>
                PPR
                <InfoTooltip text="Average points scored per race" />
              </th>
              <th>Wins</th>
              <th>Podiums</th>
              <th>Poles</th>
              <th>
                P→W%
                <InfoTooltip text={`Pole to win conversion rate. ${GRID_NOTE}`} />
              </th>
              <th>
                Pts%
                <InfoTooltip text="% of races where the driver scored points (finished P1–P10)" />
              </th>
              <th>
                Fin%
                <InfoTooltip text="% of races completed without retiring (DNF/DSQ)" />
              </th>
              <th>
                FL
                <InfoTooltip text="Fastest Lap awards" />
              </th>
              <th>
                Laps
                <InfoTooltip text="Total laps completed across all races" />
              </th>
              <th>Races</th>
              <th>
                Finished
                <InfoTooltip text="Races classified as Finished (not DNF/DSQ/DNS)" />
              </th>
              <th>DNFs</th>
              <th>
                Avg Fin
                <InfoTooltip text="Average finish position across classified results" />
              </th>
              <th>
                Best
                <InfoTooltip text="Best (lowest) finish position of the season" />
              </th>
              <th>
                Avg +/−
                <InfoTooltip text={`Average positions gained vs. starting grid position. ${GRID_NOTE}`} />
              </th>
              <th>
                Team Pts
                <InfoTooltip text="Total points scored by both drivers on this team that season" />
              </th>
              <th>
                PoP %
                <InfoTooltip text="Percentage of the team's total points scored by this driver" />
              </th>
              <th>
                Cleanest
                <InfoTooltip text="Cleanest Driver award wins" />
              </th>
              <th>
                Most Ovt.
                <InfoTooltip text="Most Overtakes award wins" />
              </th>
              <th>
                DOTD
                <InfoTooltip text="Driver of the Day award wins" />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const seasonLabel = r.season.year ?? r.season.name ?? `S${r.season.id}`;
              const apg = r.avg_positions_gained;
              return (
                <tr key={r.season.id}>
                  <td className="dp-col-season">
                    <div className="dp-season-cell">
                      <span className="dp-season-pill">{seasonLabel}</span>
                    </div>
                  </td>

                  <td className="dp-col-team">
                    <div className="dp-team-cell">
                      {r.team.logo_image ? (
                        <div className="dht-team-logo">
                          <img loading="lazy" src={displayImage(r.team.logo_image, "team")} alt={r.team.display_name} />
                        </div>
                      ) : (
                        <div className="dht-team-logo-fallback" aria-hidden />
                      )}
                      <span className="dht-team-name">{r.team.display_name}</span>
                    </div>
                  </td>

                  <td className="dp-pts-cell" title={`Base ${r.points_breakdown.base} + FL ${r.points_breakdown.fastest_lap_bonus}`}>
                    {r.points}
                  </td>
                  <td>{r.ppr != null ? r.ppr.toFixed(1) : "—"}</td>
                  <td>{r.wins}</td>
                  <td>{r.podiums}</td>
                  <td>{r.poles}</td>
                  <td>{r.pole_to_win_rate != null ? `${r.pole_to_win_rate.toFixed(0)}%` : "—"}</td>
                  <td>{r.points_finish_rate != null ? `${r.points_finish_rate.toFixed(0)}%` : "—"}</td>
                  <td>{r.finish_rate != null ? `${r.finish_rate.toFixed(0)}%` : "—"}</td>
                  <td>{r.fastest_laps}</td>
                  <td>{r.laps}</td>
                  <td>{r.races}</td>
                  <td>{r.races_completed}</td>
                  <td>{r.dnfs}</td>
                  <td>{r.avg_finish != null ? r.avg_finish.toFixed(1) : "—"}</td>
                  <td>{r.best_finish ?? "—"}</td>
                  <td className={apg != null ? (apg >= 0 ? "dp-stat-positive" : "dp-stat-negative") : ""}>
                    {apg != null ? (apg >= 0 ? "+" : "") + apg.toFixed(1) : "—"}
                  </td>
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
