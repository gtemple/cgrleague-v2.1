// src/pages/SeasonPage/index.tsx
import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSeasonResultsMatrix } from "../../hooks/useSeasonResultsMatrix";
import { useSeasonLastRace, type SeasonLastRaceResponse } from "../../hooks/useSeasonLastRace";
import type { ResultsMatrixResponse } from "../../hooks/useSeasonResultsMatrix";
import { getPositionColor } from "../../utils/getPositionColor";
import { displayImage } from "../../utils/displayImage";


import './style.css'


type MatrixProps = {
  data?: ResultsMatrixResponse;
};

export function PositionLegend() {
  const positions = Array.from({ length: 20 }, (_, i) => `${i + 1}`);

  return (
    <div className="position-legend-container border">
      <h2>Legend</h2>
      <div className="position-legend-boxes">
        {positions.map((pos, i) => (
          <div
            key={pos}
            className={
              "position-legend-box" +
              (i === 0 ? " first" : "") +
              (i === positions.length - 1 ? " last" : "")
            }
            style={{ backgroundColor: getPositionColor(pos) }}
          >
            {(i === positions.length - 1 || i === 0) ? (
              <span className="position-legend-label">{pos.toUpperCase()}</span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}


export const MatrixChart = ({ data }: MatrixProps) => {
  const [matrixData, setMatrixData] = useState('heatMap');
  if (!data) return null;


  const { results, races } = data;
  console.log('data', data)

  return (
    <div className="matrix-chart-container">
      <div className='border'>
        <h2 className='matrix-chart-title'>Results Grid</h2>
        <div className="matrix-chart-row">
          <div className="matrix-chart-race-header-cell"></div>
          {races.map((row, raceIndex) => (
            <div key={raceIndex} className="matrix-chart-flag-image-container">
              {row?.is_sprint && <div className="sprint-indicator">Sprint</div>}
              {row?.track?.country ? (
                <img src={displayImage(row?.track?.country, 'flags')} />
              ) : (
                <div className="matrix-chart-driver-label"></div>
              )}
            </div>

          ))}
        </div>
        {results.map((row, driverIndex) => {
          const driver = row.driver_info;
          return (
            <div key={driverIndex} className="matrix-chart-row">
              {driver.profile_image ? (
                <div className="matrix-chart-driver-image-container">
                  <img src={displayImage(driver?.profile_image, 'driver')} alt={`${driver?.initials} portrait`} /></div>
              ) : (
                <div className="matrix-chart-driver-label">{driver?.initials}</div>
              )}

              {/* {console.log(row)} */}


              {row.finish_positions.map((finishPos, raceIndex) => {
                // @ts-expect-error finishPos can be number or string
                const bg = getPositionColor(finishPos);

                return (

                  <div
                    key={raceIndex}
                    className="matrix-chart-cell"
                  >
                    <div className="matrix-chart-cell-content">
                      {/* Existing cell content */}
                      {matrixData === 'heatMap' && (
                        <div style={{ backgroundColor: bg, width: '100%', height: '100%' }} />
                      )}
                      {matrixData === 'finishPosition' && (
                        <div
                          className={
                            'cell-data' +
                            (row.fastest_lap[raceIndex] ? ' fastest-lap' : '') +
                            (row.pole_positions[raceIndex] ? ' pole-position' : '')
                          }
                        >
                          {row.statuses[raceIndex] === 'FIN' ? finishPos : row.statuses[raceIndex]}
                        </div>
                      )}
                      {matrixData === 'finishPoints' && (
                        <div
                          className={
                            'cell-data' +
                            (row.fastest_lap[raceIndex] ? ' fastest-lap' : '') +
                            (row.pole_positions[raceIndex] ? ' pole-position' : '')
                          }
                        >
                          {row.finish_points[raceIndex]}
                        </div>
                      )}

                      {/* Tooltip */}
                      <div className="matrix-chart-tooltip">
                        <div className="tooltip-header">
                          <div>
                            <h2>{row.driver_info.first_name} {row.driver_info.last_name}</h2>
                            <div> {row.driver_info.team_name}</div>
                          </div>
                          <div> {row.statuses[raceIndex] !== 'FIN' && (
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
                {matrixData === 'finishPosition'
                  ? row.avg_finish_position !== null
                    ? Number(row.avg_finish_position).toFixed(1)
                    : '-'
                  : `${row.total_points} pts`}
              </div>
            </div>
          )
        })}
      </div>
      <div className="matrix-chart-footer">
        <div className="matrix-chart-filters border" >
          <h2>Filters</h2>
          <div className="matrix-chart-buttons">
            <button onClick={() => setMatrixData('heatMap')}>
              Heat map
            </button>
            <button onClick={() => setMatrixData('finishPosition')}>
              Position
            </button>
            <button onClick={() => setMatrixData('finishPoints')}>
              Points
            </button>
          </div>
        </div>
        <PositionLegend />
      </div>
    </div>

  );
}

const ConstructorsTable = ({ data }: MatrixProps) => {
  if (!data) return null;
  const { constructor_results } = data;

  const constructors = constructor_results
    .map((row) => {
      const totalPoints = row.points
      return {
        constructor: row.team_name,
        profileImage: row.team_image,
        totalPoints,
      };
    })

  return (
    <div className="table-container border">
      <h2>Constructors</h2>
      <table className="table">
        <tbody>
          {constructors.map((constructor) => (
            <tr key={constructor.constructor}>
              <td className='team-logo secondary-size'>{constructor?.profileImage && <img src={displayImage(constructor.profileImage, 'team')} alt={constructor.constructor} />} </td>
              <td>{constructor.constructor}</td>
              <td>{constructor.totalPoints}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const PodiumsTable = ({ data }: MatrixProps) => {
  if (!data) return null;
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

  return (
    <div className="table-container border">
      <h2>Podiums</h2>
      <table className="table">
        <tbody>
          {podiums.map((driver) => (
            <tr key={driver.driver}>
              <td className='matrix-chart-driver-image-container secondary-size'>{driver?.profileImage && <img src={displayImage(driver.profileImage, 'driver')} alt={driver.driver} />} </td>
              <td>{driver.driver}</td>
              <td>{driver.podiumFinishes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const FastestLapTable = ({ data }: MatrixProps) => {
  if (!data) return null;
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

  return (
    <div className="table-container border">
      <h2>Fastest Laps</h2>
      <table className="table">
        <tbody>
          {fastestLaps.map((driver) => (
            <tr key={driver.driver}>
              <td className='matrix-chart-driver-image-container secondary-size'>{driver?.profileImage && <img src={displayImage(driver.profileImage, 'driver')} alt={driver.driver} />} </td>
              <td>{driver.driver}</td>
              <td>{driver.fastestLapCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const DotdsTable = ({ data }: MatrixProps) => {
  if (!data) return null;
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

  return (
    <div className="table-container border">
      <h2>Driver of the Day</h2>
      <table className="table">
        <tbody>
          {dotds.map((driver) => (
            <tr key={driver.driver}>
              <td className='matrix-chart-driver-image-container secondary-size'>{driver?.profileImage && <img src={displayImage(driver.profileImage, 'driver')} alt={driver.driver} />} </td>
              <td>{driver.driver}</td>
              <td>{driver.dotdCount}</td>
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
    <div className="season-selector">
      <select
        className="season-dropdown"
        value={currentSeasonId}
        onChange={(e) => setCurrentSeason(Number(e.target.value))}
      >
        {seasons.map((season) => (
          <option key={season} value={season}>
            Season {season}
          </option>
        ))}
      </select>
    </div>
  );
};

const LastRaceResults = ({ data }: { data?: SeasonLastRaceResponse }) => {
  if (!data) return null;
  const { last_race } = data;

  return (
    <div className="last-race-container border">
      <h2>Last Race Results</h2>
      <div>{last_race?.race?.track?.name}</div>
      <div className="track-image">
        {last_race?.race?.track?.image && <img src={displayImage(last_race.race.track.image, 'trackImage')} alt={last_race.race.track.name} />}
      </div>
      {last_race?.results.map((result, i) => (
        <div className="last-race-result" key={result.driver.id}>
          <h2>P{i + 1}</h2>
          <div>
            <div className='last-race-driver-info'>
              <div className='matrix-chart-driver-image-container secondary-size'>{result?.driver?.profile_image && <img src={displayImage(result.driver.profile_image, 'driver')} alt={result.driver.display_name} />}
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

export default function SeasonPage() {
  const params = useParams();
  const navigate = useNavigate();
  const [currentSeason, setCurrentSeason] = useState(Number(params?.seasonId) || 6);

  const handleSeasonChange = (season: number) => {
    setCurrentSeason(season);
    navigate(`/seasons/${season}`); // Update the URL
  };

  const { data, isLoading, error } = useSeasonResultsMatrix(currentSeason, { includeSprints: true });
  const { data: lastRaceData } = useSeasonLastRace(currentSeason, { includeSprints: false });

  // ✅ no any
  const errorMessage = useMemo(() => {
    if (!error) return null;
    return error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error);
  }, [error]);

  return (
    <div>
      <header className="season-header">
        <h1 className='season-title'>Season {currentSeason}</h1>
        <SeasonSelector currentSeasonId={currentSeason} setCurrentSeason={handleSeasonChange} />
      </header>

      {isLoading && <p>Loading…</p>}
      {errorMessage && <p style={{ color: "crimson" }}>Failed to load results: {errorMessage}</p>}

      {!isLoading && !errorMessage && (
        <div className='season-container'>
          <div className='seasons-row-one'>

            <MatrixChart data={data ?? undefined} />
            <div className='seasons-side-tables'>
              <ConstructorsTable data={data ?? undefined} />
              <LastRaceResults data={lastRaceData ?? undefined} />
            </div>
          </div>
          <div className='seasons-row-two'>
            <PodiumsTable data={data ?? undefined} />
            <FastestLapTable data={data ?? undefined} />
            <DotdsTable data={data ?? undefined} />
          </div>
        </div>
      )}
    </div>
  );
}
