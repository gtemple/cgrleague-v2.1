// src/components/ConstructorStandingsTable/index.tsx
import React from "react";
import { useConstructorStandings } from "../../hooks/useConstructorStandings";
import { PortraitContainerTeam } from "../PortraitContainerTeam/index";

type ConstructorRow = {
  team_season_id: number;
  team: {
    id: number;
    name: string;
    display_name?: string | null;   // use if your API returns it
    logo_image?: string | null;     // use if your API returns it
  };
  points: number;
};

export function ConstructorStandingsTable({ seasonId }: { seasonId: number }) {
  const { data, isLoading, error } = useConstructorStandings(seasonId);

  if (isLoading) {
    return (
      <div className="standings-card">
        <div className="standings-header">
          <h3>Constructor Standings</h3>
        </div>
        <div className="standings-skeleton">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-row" />
          ))}
        </div>
      </div>
    );
  }
  if (error) return <p className="state state-error">Failed to load standings.</p>;
  if (!data?.length) return <p className="state">No results.</p>;

  const rows = [...(data as ConstructorRow[])].sort((a, b) => b.points - a.points);

  return (
    <div>
      <div className="standings-header">
        <h3>Constructor Standings</h3>
      </div>
      <div className="standings-card">
        <div className="table-scroll">
          <div className="standings-table" aria-label="Constructor standings">
            {rows.map((row, idx) => {
              const position = idx + 1;
              const teamLabel = row.team.display_name || row.team.name;
              const logoKey = row.team.logo_image || row.team.name;

              return (
                <React.Fragment key={row.team_season_id}>
                  {/* no top divider on first element */}
                  {idx > 0 && <div className="standings-divider" />}

                  <div className="driver-row">
                    <div className="pos">
                      <span className="pos-badge">{position}</span>
                    </div>

                    <div>
                      {PortraitContainerTeam(logoKey)}
                    </div>

                    <div className="driver-info">
                      <div className="driver">{teamLabel}</div>
                    </div>

                    <div className="points">{row.points}</div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
