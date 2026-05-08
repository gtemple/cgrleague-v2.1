// src/pages/SeasonPage/index.tsx
import { useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useSeasonResultsMatrix } from "../../hooks/useSeasonResultsMatrix";
import { useSeasonLastRace, type SeasonLastRaceResponse } from "../../hooks/useSeasonLastRace";
import type { ResultsMatrixResponse } from "../../hooks/useSeasonResultsMatrix";
import { getPositionColor } from "../../utils/getPositionColor";
import { displayImage } from "../../utils/displayImage";
import { Loader } from "../../components/Loader";
import { ChampionshipTimeline } from "../../components/ChampionshipTimeline/index";

import './style.css'

type MatrixProps = {
  data?: ResultsMatrixResponse;
  seasonId?: number;
};

const LEGEND_ZONES = [
  { color: 'var(--accent)',      name: 'Win',     range: 'P1' },
  { color: 'rgb(255, 110, 20)', name: 'Podium',  range: 'P2–3' },
  { color: 'rgb(165, 22,  22)', name: 'Points',  range: 'P4–10' },
  { color: 'rgb(30,  12,  42)', name: 'Outside', range: 'P11+' },
] as const;

export function PositionLegend() {
  return (
    <div className="position-legend-container stats-card">
      <div className="stats-card-header">Position Key</div>
      <div className="legend-body">
        <div className="legend-gradient-bar" />
        <div className="legend-gradient-ends">
          <span>P20</span>
          <span>P1</span>
        </div>
        <div className="legend-zones">
          {LEGEND_ZONES.map(z => (
            <div key={z.name} className="legend-zone-item">
              <div className="legend-zone-dot" style={{ background: z.color }} />
              <span className="legend-zone-name">{z.name}</span>
              <span className="legend-zone-range">{z.range}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const MatrixChart = ({ data, seasonId }: MatrixProps) => {
  const [displayMode, setDisplayMode] = useState<'finishPosition' | 'finishPoints'>('finishPosition');
  const [showHeatMap, setShowHeatMap] = useState(false);

  if (!data) {
    return (
      <div className="stats-card">
        <div className="stats-card-header">Results Grid</div>
        <div style={{ padding: '16px' }}><Loader variant="skeleton" lines={10} full /></div>
      </div>
    );
  }

  const { results, races } = data;

  return (
    <div className="matrix-chart-container">
      <div className='stats-card'>
        <div className="stats-card-header">Results Grid</div>
        <div className="matrix-chart-inner">
        <div className="matrix-chart-row">
          <div className="matrix-chart-race-header-cell"></div>
          {races.map((row, raceIndex) => (
            <Link
              key={raceIndex}
              className="matrix-chart-flag-image-container"
              to={`/seasons/${seasonId}/races/${row.round}${row.is_sprint ? '?is_sprint=1' : ''}`}
              title={`Round ${row.round}${row.is_sprint ? ' (Sprint)' : ''} — ${row.track?.name ?? ''}`}
            >
              {row?.is_sprint && <div className="sprint-indicator">S</div>}
              {row?.track?.country ? (
                <img src={displayImage(row?.track?.country, 'flags')} />
              ) : (
                <div className="matrix-chart-driver-label"></div>
              )}
              <div className="round-label">R{row.round}</div>
            </Link>
          ))}
          <div className="matrix-chart-total-cell" aria-hidden="true" />
        </div>
        {results.map((row, driverIndex) => {
          const driver = row.driver_info;
          return (
            <div key={driverIndex} className="matrix-chart-row">
              <div className="matrix-driver-cell">
                <div className="matrix-chart-driver-image-container">
                  {driver.profile_image
                    ? <img src={displayImage(driver.profile_image, 'driver')} alt={`${driver.initials} portrait`} />
                    : null}
                </div>
                <span className="matrix-driver-code">{driver.initials}</span>
              </div>

              {row.finish_positions.map((finishPos, raceIndex) => {
                // @ts-expect-error finishPos can be number or string
                const bg = getPositionColor(finishPos);
                const cellStyle = showHeatMap && finishPos != null
                  ? { backgroundColor: bg.replace('rgb(', 'rgba(').replace(')', ', 0.45)') }
                  : {};

                return (
                  <div
                    key={raceIndex}
                    className="matrix-chart-cell"
                    style={cellStyle}
                  >
                    <div className="matrix-chart-cell-content">
                      <div
                        className={
                          'cell-data' +
                          (row.fastest_lap[raceIndex] ? ' fastest-lap' : '') +
                          (row.pole_positions[raceIndex] ? ' pole-position' : '')
                        }
                      >
                        {displayMode === 'finishPosition'
                          ? (row.statuses[raceIndex] === 'FIN' ? finishPos : row.statuses[raceIndex])
                          : row.finish_points[raceIndex]
                        }
                      </div>

                      <div className="matrix-chart-tooltip">
                        <div className="tooltip-header">
                          <div>
                            <h2>{row.driver_info.first_name} {row.driver_info.last_name}</h2>
                            <div>{row.driver_info.team_name}</div>
                          </div>
                          <div>{row.statuses[raceIndex] !== 'FIN' && (
                            <div><span className="tooltip-emphasis">{row.statuses[raceIndex] ?? '-'}</span></div>
                          )}</div>
                        </div>
                        <div className="tooltip-emphasis">{races[raceIndex]?.track.name}</div>
                        <div>Position: <span className="tooltip-emphasis">{finishPos ?? '-'}</span></div>
                        <div>Points: <span className="tooltip-emphasis">{row.finish_points[raceIndex] ?? 0}</span></div>
                        <div>Grid: <span className="tooltip-emphasis">{row.grid_positions[raceIndex] ?? '-'}</span></div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className='matrix-chart-total-cell'>
                {displayMode === 'finishPosition'
                  ? row.avg_finish_position !== null
                    ? Number(row.avg_finish_position).toFixed(1)
                    : '-'
                  : `${row.total_points} pts`}
              </div>
            </div>
          )
        })}
        </div>{/* matrix-chart-inner */}
      </div>
      <div className="matrix-chart-footer">
        <div className="matrix-chart-filters stats-card">
          <div className="stats-card-header">Display</div>
          <div className="filter-body">
          <div className="filter-row">
            <div className="filter-group">
              <div className="filter-segmented">
                <button className={displayMode === 'finishPosition' ? 'seg-active' : ''} onClick={() => setDisplayMode('finishPosition')}>
                  Position
                </button>
                <button className={displayMode === 'finishPoints' ? 'seg-active' : ''} onClick={() => setDisplayMode('finishPoints')}>
                  Points
                </button>
              </div>
            </div>
            <button
              className={`heatmap-toggle${showHeatMap ? ' active' : ''}`}
              onClick={() => setShowHeatMap(v => !v)}
            >
              Heat Map
            </button>
          </div>
          </div>{/* filter-body */}
        </div>
        <PositionLegend />
      </div>
    </div>
  );
}

const ConstructorsTable = ({ data }: MatrixProps) => {
  if (!data) {
    return (
      <div className="stats-card">
        <div className="stats-card-header">Constructors</div>
        <Loader variant="skeleton" lines={5} />
      </div>
    );
  }
  const { constructor_results } = data;

  const truncateName = (name: string, maxLength: number = 20) => {
    return name.length > maxLength ? name.substring(0, maxLength) + '...' : name;
  };

  const constructors = constructor_results.map((row) => ({
    constructor: row.team_display_name,
    displayName: truncateName(row.team_name, 20),
    profileImage: row.team_image,
    totalPoints: row.points,
    teamId: row.team_id,
  }));

  const max = constructors[0]?.totalPoints ?? 1;

  return (
    <div className="stats-card">
      <div className="stats-card-header">Constructors</div>
      <table className="table">
        <tbody>
          {constructors.map((constructor) => (
            <tr key={constructor.constructor}>
              <td><div className='team-logo'>{constructor?.profileImage && <img src={displayImage(constructor.profileImage, 'team')} alt={constructor.constructor} />}</div></td>
              <td>{constructor.teamId ? <Link to={`/teams/${constructor.teamId}`} style={{ textDecoration: "none", color: "inherit" }}>{constructor.displayName}</Link> : constructor.displayName}</td>
              <td className="stat-bar-cell">
                <div className="stat-bar-wrap">
                  <div className="stat-bar stat-bar-constructor" style={{ width: `${(constructor.totalPoints / max) * 100}%` }} />
                  <span className="stat-bar-count">{constructor.totalPoints}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const PodiumsTable = ({ data }: MatrixProps) => {
  if (!data) {
    return (
      <div className="stats-card">
        <div className="stats-card-header">Podiums</div>
        <Loader variant="skeleton" lines={5} />
      </div>
    );
  }
  const { results } = data;

  const podiums = results
    .map((row) => {
      const driver = row.driver_info;
      const podiumFinishes = row.finish_positions.filter((pos) => pos !== null && pos <= 3).length;
      return {
        driver: `${driver.first_name} ${driver.last_name}`,
        profileImage: driver.profile_image,
        podiumFinishes,
      };
    })
    .filter((driver) => driver.podiumFinishes > 0)
    .sort((a, b) => b.podiumFinishes - a.podiumFinishes)
    .slice(0, 5);

  const max = podiums[0]?.podiumFinishes ?? 1;

  return (
    <div className="stats-card">
      <div className="stats-card-header">Podiums</div>
      <table className="table">
        <tbody>
          {podiums.map((driver) => (
            <tr key={driver.driver}>
              <td><div className='avatar-sm'>{driver?.profileImage && <img src={displayImage(driver.profileImage, 'driver')} alt={driver.driver} />}</div></td>
              <td>{driver.driver}</td>
              <td className="stat-bar-cell">
                <div className="stat-bar-wrap">
                  <div className="stat-bar" style={{ width: `${(driver.podiumFinishes / max) * 100}%` }} />
                  <span className="stat-bar-count">{driver.podiumFinishes}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const FastestLapTable = ({ data }: MatrixProps) => {
  if (!data) {
    return (
      <div className="stats-card">
        <div className="stats-card-header">Fastest Laps</div>
        <Loader variant="skeleton" lines={5} />
      </div>
    );
  }
  const { results } = data;

  const fastestLaps = results
    .map((row) => {
      const driver = row.driver_info;
      const fastestLapCount = row.fastest_lap.filter((hasFastestLap) => hasFastestLap).length;
      return {
        driver: `${driver.first_name} ${driver.last_name}`,
        profileImage: driver.profile_image,
        fastestLapCount,
      };
    })
    .filter((driver) => driver.fastestLapCount > 0)
    .sort((a, b) => b.fastestLapCount - a.fastestLapCount)
    .slice(0, 5);

  const max = fastestLaps[0]?.fastestLapCount ?? 1;

  return (
    <div className="stats-card">
      <div className="stats-card-header">Fastest Laps</div>
      <table className="table">
        <tbody>
          {fastestLaps.map((driver) => (
            <tr key={driver.driver}>
              <td><div className='avatar-sm'>{driver?.profileImage && <img src={displayImage(driver.profileImage, 'driver')} alt={driver.driver} />}</div></td>
              <td>{driver.driver}</td>
              <td className="stat-bar-cell">
                <div className="stat-bar-wrap">
                  <div className="stat-bar stat-bar-fl" style={{ width: `${(driver.fastestLapCount / max) * 100}%` }} />
                  <span className="stat-bar-count">{driver.fastestLapCount}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const DotdsTable = ({ data }: MatrixProps) => {
  if (!data) {
    return (
      <div className="stats-card">
        <div className="stats-card-header">Driver of the Day</div>
        <Loader variant="skeleton" lines={5} />
      </div>
    );
  }
  const { results } = data;

  const dotds = results
    .map((row) => {
      const driver = row.driver_info;
      const dotdCount = row.dotds.filter((hasDotd) => hasDotd).length;
      return {
        driver: `${driver.first_name} ${driver.last_name}`,
        profileImage: driver.profile_image,
        dotdCount,
      };
    })
    .filter((driver) => driver.dotdCount > 0)
    .sort((a, b) => b.dotdCount - a.dotdCount)
    .slice(0, 5);

  const max = dotds[0]?.dotdCount ?? 1;

  return (
    <div className="stats-card">
      <div className="stats-card-header">Driver of the Day</div>
      <table className="table">
        <tbody>
          {dotds.map((driver) => (
            <tr key={driver.driver}>
              <td><div className='avatar-sm'>{driver?.profileImage && <img src={displayImage(driver.profileImage, 'driver')} alt={driver.driver} />}</div></td>
              <td>{driver.driver}</td>
              <td className="stat-bar-cell">
                <div className="stat-bar-wrap">
                  <div className="stat-bar stat-bar-dotd" style={{ width: `${(driver.dotdCount / max) * 100}%` }} />
                  <span className="stat-bar-count">{driver.dotdCount}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SeasonSelector = ({
  currentSeasonId,
  setCurrentSeason,
}: {
  currentSeasonId: number;
  setCurrentSeason: (season: number) => void;
}) => {
  const seasons = [1, 2, 3, 4, 5, 6, 7];

  return (
    <div className="season-tabs">
      {seasons.map((season) => (
        <button
          key={season}
          className={`season-tab${season === currentSeasonId ? ' season-tab-active' : ''}`}
          onClick={() => setCurrentSeason(season)}
        >
          S{season}
        </button>
      ))}
    </div>
  );
};

const LastRaceResults = ({ data, seasonId }: { data?: SeasonLastRaceResponse; seasonId?: number }) => {
  if (!data) {
    return (
      <div className="stats-card">
        <div className="stats-card-header">Last Race</div>
        <Loader variant="skeleton" lines={5} />
      </div>
    );
  }
  const { last_race } = data;

  return (
    <div className="stats-card last-race-card">
      <div className="stats-card-header">
        <span>Last Race</span>
        {seasonId && last_race?.race?.round && (
          <Link to={`/seasons/${seasonId}/races/${last_race.race.round}`} className="lr-link">
            View results →
          </Link>
        )}
      </div>
      <div className="lr-track-name">{last_race?.race?.track?.name}</div>
      <div className="track-image">
        {last_race?.race?.track?.image && <img src={displayImage(last_race.race.track.image, 'trackImage')} alt={last_race.race.track.name} />}
      </div>
      {last_race?.results.map((result, i) => (
        <div className="last-race-result" key={result.driver.id}>
          <div className={`lr-pos-badge lr-pos-badge-${i + 1}`}>P{i + 1}</div>
          <div>
            <div className='last-race-driver-info'>
              <div className='avatar-sm'>
                {result?.driver?.profile_image && <img src={displayImage(result.driver.profile_image, 'driver')} alt={result.driver.display_name} />}
              </div>
              <div>{result.driver.display_name}</div>
            </div>
            <div className="team-name">{result.team.name}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

type MobileTab = 'grid' | 'standings' | 'stats';

export const SeasonPage = () => {
  const params = useParams();
  const navigate = useNavigate();
  const [currentSeason, setCurrentSeason] = useState(Number(params?.seasonId) || 6);
  const [mobileTab, setMobileTab] = useState<MobileTab>('grid');

  const handleSeasonChange = (season: number) => {
    setCurrentSeason(season);
    navigate(`/seasons/${season}`);
  };

  const { data, isLoading, error } = useSeasonResultsMatrix(currentSeason, { includeSprints: true });
  const { data: lastRaceData } = useSeasonLastRace(currentSeason, { includeSprints: false });

  const errorMessage = useMemo(() => {
    if (!error) return null;
    return error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error);
  }, [error]);

  return (
    <div className="season-container">
      <header className="season-header">
        <div className="season-header-left">
          <div className="season-eyebrow">CGR League</div>
          <h1 className="season-title">Season {currentSeason}</h1>
        </div>
        <SeasonSelector currentSeasonId={currentSeason} setCurrentSeason={handleSeasonChange} />
      </header>

      {isLoading && (
        <Loader label="Loading season…" full />
      )}
      {errorMessage && <p style={{ color: "crimson" }}>Failed to load results: {errorMessage}</p>}

      {!isLoading && !errorMessage && (
        <div className='season-content'>

          {/* Championship timeline — always visible above the tabs */}
          <ChampionshipTimeline seasonId={currentSeason} />

          {/* Mobile-only tab switcher */}
          <div className="mobile-tab-bar">
            {(['grid', 'standings', 'stats'] as MobileTab[]).map(tab => (
              <button
                key={tab}
                className={`mobile-tab${mobileTab === tab ? ' mobile-tab-active' : ''}`}
                onClick={() => setMobileTab(tab)}
              >
                {tab === 'grid' ? 'Grid' : tab === 'standings' ? 'Standings' : 'Stats'}
              </button>
            ))}
          </div>

          <div className={`section-grid${mobileTab !== 'grid' ? ' mobile-hidden' : ''}`}>
            <MatrixChart data={data ?? undefined} seasonId={currentSeason} />
          </div>

          <div className={`section-standings${mobileTab !== 'standings' ? ' mobile-hidden' : ''}`}>
            <ConstructorsTable data={data ?? undefined} />
            <LastRaceResults data={lastRaceData ?? undefined} seasonId={currentSeason} />
          </div>

          <div className={`section-stats${mobileTab !== 'stats' ? ' mobile-hidden' : ''}`}>
            <div className="section-divider">Season Stats</div>
            <PodiumsTable data={data ?? undefined} />
            <FastestLapTable data={data ?? undefined} />
            <DotdsTable data={data ?? undefined} />
          </div>

        </div>
      )}
    </div>
  );
};
