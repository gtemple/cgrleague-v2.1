import { Link } from "react-router-dom";
import type { DriverPrediction, RacePredictionResponse } from "../../hooks/useRacePrediction";
import { displayImage } from "../../utils/displayImage";

type Props = {
  data: RacePredictionResponse | null;
  isLoading: boolean;
  error: Error | null;
};

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function driverImage(row: DriverPrediction) {
  return row.driver.profile_image
    ? displayImage(row.driver.profile_image, "driver")
    : null;
}

function CalculationTooltip() {
  return (
    <span className="rp-predict-help">
      <button
        type="button"
        className="rp-predict-info"
        aria-label="How the forecast is calculated"
        aria-describedby="rp-predict-tooltip"
      >
        ?
      </button>
      <span id="rp-predict-tooltip" className="rp-predict-tooltip" role="tooltip">
        <strong>How is this calculated?</strong>
        We compare each driver’s long-term results, last five races, their teammate’s pace,
        record at this track, and performance on similar circuits. Then we simulate the race
        5,000 times. The percentages are estimates, not guarantees.
      </span>
    </span>
  );
}

export function RacePredictionPanel({ data, isLoading, error }: Props) {
  if (error) return null;

  if (isLoading || !data) {
    return (
      <section className="rp-predict rp-predict--loading" aria-label="Loading race forecast">
        <div className="rp-predict-head">
          <div>
            <span className="rp-panel-title">CGR FORECAST</span>
            <h3>Model prediction</h3>
          </div>
        </div>
        <div className="rp-predict-skeleton" />
      </section>
    );
  }

  if (data.predictions.length === 0) return null;

  const podium = data.predictions.slice(0, 3);

  return (
    <section className="rp-predict" aria-labelledby="rp-predict-title">
      <div className="rp-predict-head">
        <div>
          <div className="rp-predict-eyebrow">
            <span className="rp-panel-title">CGR FORECAST</span>
            <CalculationTooltip />
          </div>
          <h3 id="rp-predict-title">Model prediction</h3>
          <p>
            Pre-weekend forecast · {data.model.simulations.toLocaleString()} simulated races
            {data.as_of.completed_round ? ` · Data through Round ${data.as_of.completed_round}` : " · Season opener"}
          </p>
        </div>
        <span className="rp-predict-disclaimer">NO GRID DATA YET</span>
      </div>

      <div className="rp-predict-podium">
        {podium.map((row) => {
          const image = driverImage(row);
          return (
            <article
              className={`rp-predict-favourite rp-predict-favourite--${row.predicted_rank}`}
              key={row.driver.id}
              style={{ "--team-color": row.team.color || "var(--cgr-border-hover)" } as React.CSSProperties}
            >
              <span className="rp-predict-rank">P{row.predicted_rank}</span>
              <span className="rp-predict-avatar">
                {image
                  ? <img loading="lazy" src={image} alt="" />
                  : <b>{row.driver.initials}</b>}
              </span>
              <span className="rp-predict-driver">
                <Link to={`/drivers/${row.driver.id}`}>{row.driver.display_name}</Link>
                <small>{row.team.name}</small>
              </span>
              <span className="rp-predict-win">
                <b>{percent(row.win_probability)}</b>
                <small>WIN</small>
              </span>
              <span className="rp-predict-podium-chance">
                {percent(row.podium_probability)} podium · Expected P{row.expected_finish.toFixed(1)}
              </span>
            </article>
          );
        })}
      </div>

      <div className="rp-predict-table-wrap">
        <table className="rp-predict-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Driver</th>
              <th>Win</th>
              <th>Podium</th>
              <th>Expected</th>
              <th>Confidence</th>
            </tr>
          </thead>
          <tbody>
            {data.predictions.map((row) => (
              <tr key={row.driver.id}>
                <td className="rp-predict-table-rank">{row.predicted_rank}</td>
                <td>
                  <span className="rp-predict-table-driver">
                    <i style={{ background: row.team.color || "var(--cgr-border-hover)" }} />
                    <span>
                      <Link to={`/drivers/${row.driver.id}`}>{row.driver.display_name}</Link>
                      <small>{row.factors[0]?.reason ?? row.team.name}</small>
                    </span>
                  </span>
                </td>
                <td>
                  <span className="rp-predict-probability">
                    <i style={{ width: percent(row.win_probability) }} />
                    <b>{percent(row.win_probability)}</b>
                  </span>
                </td>
                <td>{percent(row.podium_probability)}</td>
                <td>P{row.expected_finish.toFixed(1)}</td>
                <td><span className={`rp-predict-confidence is-${row.confidence}`}>{row.confidence}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
