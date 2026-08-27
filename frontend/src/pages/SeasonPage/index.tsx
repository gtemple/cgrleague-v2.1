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

type GridMode = 'position' | 'points' | 'heat';

export const MatrixChart = ({ data, seasonId }: MatrixProps) => {
  const [mode, setMode] = useState<GridMode>('position');

  if (!data) {
    return (
      <div className="stats-card">
        <div className="stats-card-header"><span>RESULTS GRID</span></div>
        <div style={{ padding: '16px' }}><Loader variant="skeleton" lines={10} full /></div>
      </div>
    );
  }

  const { results, races } = data;

  return (
    <div className="stats-card results-grid-card">
      <div className="stats-card-header">
        <span>RESULTS GRID</span>
        <div className="grid-mode-toggle">
          {(['position', 'points', 'heat'] as GridMode[]).map((m) => (
            <button
              key={m}
              className={mode === m ? 'seg-active' : ''}
              onClick={() => setMode(m)}
            >
              {m === 'position' ? 'Position' : m === 'points' ? 'Points' : 'Heat Map'}
            </button>
          ))}
        </div>
      </div>

      <div className="matrix-chart-inner">
        <div className="matrix-chart-scroll">
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
                  <img loading="lazy" src={displayImage(row?.track?.country, 'flags')} />
                ) : (
                  <div className="matrix-chart-driver-label"></div>
                )}
                <div className="round-label">R{row.round}</div>
              </Link>
            ))}
            <div className="matrix-chart-total-cell" aria-hidden="true">
              {mode === 'points' ? 'PTS' : 'AVG'}
            </div>
          </div>
          {results.map((row, driverIndex) => {
            const driver = row.driver_info;
            return (
              <div key={driverIndex} className="matrix-chart-row">
                <div className="matrix-driver-cell">
                  <div className="matrix-chart-driver-image-container">
                    {driver.profile_image
                      ? <img loading="lazy" src={displayImage(driver.profile_image, 'driver')} alt={`${driver.initials} portrait`} />
                      : null}
                  </div>
                  <span className="matrix-driver-code">{driver.initials}</span>
                </div>

                {row.finish_positions.map((finishPos, raceIndex) => {
                  // @ts-expect-error finishPos can be number or string
                  const heatColor = getPositionColor(finishPos);
                  const cellStyle = mode === 'heat' && finishPos != null
                    ? { backgroundColor: heatColor, border: '1px solid rgba(0,0,0,0.05)' }
                    : {};
                  const isPole = row.pole_positions[raceIndex];
                  const isFl = row.fastest_lap[raceIndex];
                  const isDnf = row.statuses[raceIndex] != null && row.statuses[raceIndex] !== 'FIN';

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
                            (mode !== 'heat' && isFl ? ' fastest-lap' : '') +
                            (mode !== 'heat' && isPole ? ' pole-position' : '') +
                            (mode === 'position' && isDnf ? ' cell-data--dnf' : '') +
                            (mode === 'heat' ? ' cell-data--heat' : '')
                          }
                        >
                          {mode === 'points'
                            ? row.finish_points[raceIndex]
                            : (row.statuses[raceIndex] === 'FIN' ? finishPos : row.statuses[raceIndex])
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
                  {mode === 'points'
                    ? `${row.total_points}`
                    : row.avg_finish_position !== null
                      ? Number(row.avg_finish_position).toFixed(1)
                      : '-'}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* key */}
      <div className="matrix-key-row">
        <span className="matrix-key-label">KEY</span>
        <div className="matrix-key-item"><span className="key-pole-swatch" /><span>Pole</span></div>
        <div className="matrix-key-item"><span className="key-fl-swatch">P</span><span>Fastest lap</span></div>
        <div className="matrix-key-item"><span className="key-dnf-swatch" /><span>DNF</span></div>
        <div className="matrix-key-gradient">
          <span>P20</span>
          <span className="key-gradient-bar" />
          <span>P1</span>
        </div>
      </div>
    </div>
  );
}

const ConstructorsTable = ({ data }: MatrixProps) => {
  if (!data) {
    return (
      <div className="stats-card">
        <div className="stats-card-header"><span>CONSTRUCTORS</span></div>
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
      <div className="stats-card-header"><span>CONSTRUCTORS</span></div>
      <div className="rail-list">
        {constructors.map((constructor, i) => (
          <div className="rail-row" key={constructor.constructor}>
            <span className="rail-pos">{i + 1}</span>
            <div className="rail-identity">
              <div className="rail-name">
                {constructor.teamId
                  ? <Link to={`/teams/${constructor.teamId}`}>{constructor.displayName}</Link>
                  : constructor.displayName}
              </div>
              <div className="rail-bar-track">
                <div className="rail-bar-fill" style={{ width: `${(constructor.totalPoints / max) * 100}%` }} />
              </div>
            </div>
            <span className="rail-points">{constructor.totalPoints}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const PodiumsTable = ({ data }: MatrixProps) => {
  if (!data) {
    return (
      <div className="stats-card">
        <div className="stats-card-header"><span>PODIUMS</span></div>
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
        podiumFinishes,
      };
    })
    .filter((driver) => driver.podiumFinishes > 0)
    .sort((a, b) => b.podiumFinishes - a.podiumFinishes)
    .slice(0, 5);

  return <StatPanel title="PODIUMS" barClass="stat-bar--red" rows={podiums.map(p => ({ name: p.driver, val: p.podiumFinishes }))} />;
}

const FastestLapTable = ({ data }: MatrixProps) => {
  if (!data) {
    return (
      <div className="stats-card">
        <div className="stats-card-header"><span>FASTEST LAPS</span></div>
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
        fastestLapCount,
      };
    })
    .filter((driver) => driver.fastestLapCount > 0)
    .sort((a, b) => b.fastestLapCount - a.fastestLapCount)
    .slice(0, 5);

  return <StatPanel title="FASTEST LAPS" barClass="stat-bar--purple" rows={fastestLaps.map(f => ({ name: f.driver, val: f.fastestLapCount }))} />;
}

const DotdsTable = ({ data }: MatrixProps) => {
  if (!data) {
    return (
      <div className="stats-card">
        <div className="stats-card-header"><span>DRIVER OF THE DAY</span></div>
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
        dotdCount,
      };
    })
    .filter((driver) => driver.dotdCount > 0)
    .sort((a, b) => b.dotdCount - a.dotdCount)
    .slice(0, 5);

  return <StatPanel title="DRIVER OF THE DAY" barClass="stat-bar--blue" rows={dotds.map(d => ({ name: d.driver, val: d.dotdCount }))} />;
}

function StatPanel({ title, barClass, rows }: { title: string; barClass: string; rows: { name: string; val: number }[] }) {
  const max = rows[0]?.val ?? 1;
  return (
    <div className="stats-card">
      <div className="stats-card-header"><span>{title}</span></div>
      <div className="stat-panel-rows">
        {rows.map((row) => (
          <div className="stat-panel-row" key={row.name}>
            <span className="stat-panel-name">{row.name}</span>
            <div className="stat-panel-bar-track">
              <div className={`stat-panel-bar-fill ${barClass}`} style={{ width: `${(row.val / max) * 100}%` }} />
            </div>
            <span className="stat-panel-val">{row.val}</span>
          </div>
        ))}
      </div>
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
      <div className="stats-card stats-card--dark">
        <div className="stats-card-header"><span>LAST RACE</span></div>
        <Loader variant="skeleton" lines={5} />
      </div>
    );
  }
  const { last_race } = data;
  const podiumColors = ['#f5b21a', '#c9c4b8', '#cd7f32'];

  return (
    <div className="stats-card stats-card--dark">
      <div className="stats-card-header">
        <span>LAST RACE</span>
        {seasonId && last_race?.race?.round && (
          <Link to={`/seasons/${seasonId}/races/${last_race.race.round}`} className="lr-link">
            RESULTS →
          </Link>
        )}
      </div>
      <div className="lr-body">
        <div className="lr-track-name">R{last_race?.race?.round} · {last_race?.race?.track?.name}</div>
        {last_race?.results.map((result, i) => (
          <div className="lr-row" key={result.driver.id}>
            <span className="lr-pos" style={{ color: podiumColors[i] }}>P{i + 1}</span>
            <span className="lr-bar" style={{ background: podiumColors[i] }} />
            <div>
              <div className="lr-name">{result.driver.display_name}</div>
              <div className="lr-team">{result.team.name?.toUpperCase()}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SkPanel({ rows, block, chips, className }: { rows?: number; block?: number; chips?: number; className?: string }) {
  return (
    <div className={"season-sk-panel" + (className ? ` ${className}` : "")}>
      <span className="sk season-sk-head" />
      {block ? (
        <span className="sk season-sk-block" style={{ height: block }} />
      ) : (
        <div className="season-sk-rows">
          {Array.from({ length: rows ?? 5 }).map((_, i) => (
            <span key={i} className="sk season-sk-row" />
          ))}
        </div>
      )}
      {chips ? (
        <div className="season-sk-chips">
          {Array.from({ length: chips }).map((_, i) => (
            <span key={i} className="sk season-sk-chip" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export const SeasonPage = () => {
  const params = useParams();
  const navigate = useNavigate();
  const [currentSeason, setCurrentSeason] = useState(Number(params?.seasonId) || 6);

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

  const progress = useMemo(() => {
    if (!data || data.races.length === 0) return null;
    const total = data.races.length;
    const completed = data.races.reduce((acc, _, i) => {
      const anyResult = data.results.some((r) => r.finish_positions[i] != null);
      return acc + (anyResult ? 1 : 0);
    }, 0);
    return { total, completed, isComplete: completed >= total };
  }, [data]);

  return (
    <div className="season-page">
      <div className="season-header-band">
        <div className="season-header-inner">
          <div>
            <div className="season-eyebrow">CGR LEAGUE · CHAMPIONSHIP</div>
            <div className="season-title-row">
              <h1 className="season-title">Season {currentSeason}</h1>
              {progress && (
                <span className="season-progress">
                  ● {progress.isComplete ? "COMPLETE" : "IN PROGRESS"} · R{String(progress.completed).padStart(2, "0")} / {progress.total}
                </span>
              )}
            </div>
          </div>
          <SeasonSelector currentSeasonId={currentSeason} setCurrentSeason={handleSeasonChange} />
        </div>
      </div>

      <div className="season-body">
        {isLoading && (
          <div className="season-content" aria-busy="true" aria-label="Loading season">
            <SkPanel block={330} chips={14} />
            <div className="season-grid-rail">
              <SkPanel rows={22} className="season-sk-matrix" />
              <div className="season-rail">
                <SkPanel rows={15} />
                <SkPanel rows={9} />
              </div>
            </div>
            <div className="season-stats-section">
              <div className="season-stats-label">SEASON STATS</div>
              <div className="season-stats-grid">
                <SkPanel rows={8} />
                <SkPanel rows={8} />
                <SkPanel rows={8} />
              </div>
            </div>
          </div>
        )}
        {errorMessage && <p style={{ color: "crimson" }}>Failed to load results: {errorMessage}</p>}

        {!isLoading && !errorMessage && (
          <div className='season-content'>

            <ChampionshipTimeline seasonId={currentSeason} />

            <div className="season-grid-rail">
              <MatrixChart data={data ?? undefined} seasonId={currentSeason} />

              <div className="season-rail">
                <ConstructorsTable data={data ?? undefined} />
                <LastRaceResults data={lastRaceData ?? undefined} seasonId={currentSeason} />
              </div>
            </div>

            <div className="season-stats-section">
              <div className="season-stats-label">SEASON STATS</div>
              <div className="season-stats-grid">
                <PodiumsTable data={data ?? undefined} />
                <FastestLapTable data={data ?? undefined} />
                <DotdsTable data={data ?? undefined} />
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};
