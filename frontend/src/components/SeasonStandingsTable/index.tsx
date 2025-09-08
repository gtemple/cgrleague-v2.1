import React, { useState } from "react";
import { useSeasonStandings } from "../../hooks/useSeasonStandings";
import { displayImage } from "../../utils/displayImage";
import "./styles.css"

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

export function SeasonStandingsTable({ seasonId }: { seasonId: number }) {
  const { data, isLoading, error } = useSeasonStandings(seasonId);
  const [visibleStart, setVisibleStart] = useState(0);
  const PAGE_SIZE = 5;

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
  const visibleRows = rows.slice(visibleStart, visibleStart + PAGE_SIZE);
  const hasMore = visibleStart + PAGE_SIZE < rows.length;

  return (
    <div className="standings-card">
      <div className="standings-header">
        <h3>Driver Standings</h3>
      </div>

      <div className="table-scroll">
        <div className="standings-table" aria-label="Season driver standings">
          {visibleRows.map((row, idx) => {
            const position = visibleStart + idx + 1;
            return (
              <React.Fragment key={row.driver_season_id}>
                <div className="standings-divider" />

                <div className="driver-row">
                  <div className="pos">
                    <span className="pos-badge">{position}</span>
                  </div>
                  <div className="avatar">
                    {row.driver?.profile_image ? (
                      <img src={displayImage(row.driver.display_name, 'driver')} alt={`${row.driver.display_name} portrait`} />
                    ) : (
                      <div className="avatar avatar-fallback" aria-hidden />
                    )}
                  </div>
                  <div className='driver-info'>
                    <div className="driver">{row.driver.display_name}</div>
                    <div className="team-cell">
                      <div className="team-logo">
                        {row.team?.logo_image ? (
                          <img src={displayImage(row.team.name, 'team')} alt={`${row.team.name[0]}`} />
                        ) : (
                          <div className="team-logo team-logo-fallback" aria-hidden />
                        )}
                      </div>
                      <span className="team-name">{row.team.name}</span>
                    </div>
                  </div>
                  <div className="points">{row.points}</div>
                </div>
              </React.Fragment>
            );
          })}
          <div className="arrow-controls">
            {visibleStart > 0 ? (
              <button
                className="standings-arrow-btn"
                aria-label="Show previous"
                onClick={() => setVisibleStart(Math.max(0, visibleStart - PAGE_SIZE))}
              >
                &#9660;
              </button>
            ) : (
              <span className="arrow-placeholder" />
            )}
            {hasMore ? (
              <button
                className="standings-arrow-btn"
                aria-label="Show more"
                onClick={() => setVisibleStart(visibleStart + PAGE_SIZE)}
              >
                &#9650;
              </button>
            ) : (
              <span className="arrow-placeholder" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}