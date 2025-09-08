// src/pages/SeasonPage/index.tsx
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useSeasonResultsMatrix } from "../../hooks/useSeasonResultsMatrix";
import type { ResultsMatrixResponse } from "../../hooks/useSeasonResultsMatrix";
import { getPositionColor } from "../../utils/getPositionColor";
import { displayImage } from "../../utils/displayImage";


import './style.css'


type Props = { seasonId?: number | string };
type MatrixProps = {
  data?: ResultsMatrixResponse;
};
export const MatrixChart = ({ data }: MatrixProps) => {
  if (!data) return null;

  const { results } = data;

  return (
    <div className="matrix-chart-container">
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

        {console.log(row)}

          {row.finish_positions.map((finishPos, raceIndex) => {
            //@ts-expect-error finishPos can be number or string
            const bg = getPositionColor(finishPos);

            return (
              <div
                key={raceIndex}
                className="matrix-chart-cell"
                style={{ backgroundColor: bg }}
              >
              </div>
            );
          })}
        </div>
      )})}
    </div>
  );
  }


export function PositionLegend() {
  const positions = Array.from({ length: 20 }, (_, i) => `${i + 1}`);

  return (
    <div className="position-legend-container">
      <div>Legend</div>
      <div className="position-legend-boxes">
      {positions.map((pos, i) => (
        <div
          key={pos}
          className="position-legend-box"
          style={{ backgroundColor: getPositionColor(pos) }}
        >
          {i === positions.length - 1 || i === 0 ? (
            <span className="position-legend-label">{pos.toUpperCase()}</span>
          ) : null}
        </div>
      ))}
      </div>
    </div>
  );
}

export default function SeasonPage({ seasonId: seasonIdProp }: Props) {
  const params = useParams();
  const seasonId = String(seasonIdProp ?? params.seasonId ?? "1");

  const [includeSprints, setIncludeSprints] = useState(true);

  //@ts-expect-error we don't need this check
  const { data, isLoading, error } = useSeasonResultsMatrix(seasonId, { includeSprints });

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
      <header >
        <h1 style={{ margin: 0 }}>Season {seasonId} — Results</h1>
        <label >
          <input
            type="checkbox"
            checked={includeSprints}
            onChange={(e) => setIncludeSprints(e.target.checked)}
          />
          Include sprints
        </label>
      </header>

      {isLoading && <p>Loading…</p>}
      {errorMessage && <p style={{ color: "crimson" }}>Failed to load results: {errorMessage}</p>}

      {!isLoading && !errorMessage && (
        <>

          <MatrixChart data={data} />
          <PositionLegend />
        </>
      )}
    </div>
  );
}
