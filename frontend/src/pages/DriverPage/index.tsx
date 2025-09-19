import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDriversList } from "../../hooks/useDriverList";
import { useDriverDetail } from "../../hooks/useDriverDetails";
import { DriverHistoryTable } from "./DriverHistoryTable";
import { displayImage } from "../../utils/displayImage";
import { Loader } from "../../components/Loader";
import "./style.css";

export const DriverPage = () => {
  const { driverId } = useParams<{ driverId: string }>();
  const navigate = useNavigate();

  const { data: list = [], isLoading: listLoading, error: listError } = useDriversList();
  const { data, isLoading, error } = useDriverDetail(driverId);

  const driver = data?.driver;
  const totals = data?.totals;

  // Local, stable select value so UI doesn’t jump
  const [selectValue, setSelectValue] = useState(driverId ?? "");
  useEffect(() => {
    if (driverId != null) setSelectValue(driverId);
  }, [driverId]);

  const hasValueInList = list?.some(d => String(d.id) === selectValue);

  const selectedLabel =
    driver?.display_name ??
    list?.find(d => String(d.id) === selectValue)?.display_name ??
    "Loading…";

  return (
    <div className="driver-page container">

      {isLoading && <Loader label="Loading driver…" full />}

      {!isLoading && error && (
        <div className="state state-error">Failed to load driver.</div>
      )}

      {!isLoading && !error && driver && totals && (
        <>
          {console.log(data)}
          <section className="driver-hero">
            <div className="hero-top-row">
              <div className="portrait-wrap">
                <div className="portrait-bg" />
                {driver.profile_image ? (
                  <img
                    className="portrait-img"
                    src={displayImage(driver.profile_image, "driver")}
                    alt={driver.display_name}
                  />
                ) : (
                  <div className="portrait-fallback" />
                )}
              </div>
              <div className="hero-header">
                <div>
                  <div className='hero-names'>
                    <div className="hero-name">{driver.first_name} {driver.last_name}</div>
                  </div>
                  <div className='hero-header-sub'>
                    <div>Wins: {totals.wins}</div>
                    <div>Podiums: {totals.podiums}</div>
                  </div>
                </div>
                <div className="driver-picker">
                  {/* Always render the select; keep options during loading */}
                  {!listError && (
                    <select
                      className="driver-select"
                      value={selectValue}
                      onChange={(e) => {
                        const next = e.target.value;
                        setSelectValue(next);               // instant UI update
                        if (next && next !== driverId) navigate(`/drivers/${next}`);
                      }}
                      aria-busy={listLoading || undefined}
                      disabled={listError ? true : false}
                    >
                      {/* Ghost option so current selection stays visible even if not in options yet */}
                      {!hasValueInList && selectValue && (
                        <option value={selectValue}>{selectedLabel}</option>
                      )}

                      {list?.map((d) => (
                        <option key={d.id} value={String(d.id)}>
                          {d.display_name}
                        </option>
                      ))}

                      {!selectValue && <option value="">Select a driver…</option>}
                    </select>
                  )}
                </div>
              </div>
            </div>
            <div className='hero-divider' />
            <div className='hero-second-row'>
              <div className='hero-highlight-container'>
                <div className='hero-highlight-number'>{totals.points_breakdown.base + totals.points_breakdown.fastest_lap_bonus}</div>
                <div className='hero-highlight-label'>Points</div>
              </div>
              <div className='hero-highlight-container'>
                <div className='hero-highlight-number'>{totals.poles}</div>
                <div className='hero-highlight-label'>Poles</div>
              </div>

              <div className='hero-highlight-container'>
                <div className='hero-highlight-number'>{totals.races}</div>
                <div className='hero-highlight-label'>Races</div>
              </div>

              <div className='hero-highlight-container'>
                <div className='hero-highlight-number'>{totals.fastest_laps}</div>
                <div className='hero-highlight-label'>Fastest Laps</div>
              </div>
              <div className='hero-highlight-container'>
                <div className='hero-highlight-number'>{totals.dotds}</div>
                <div className='hero-highlight-label'>Driver of the Days</div>
              </div>
              <div className='hero-highlight-container'>
                <div className='hero-highlight-number'>{totals.cleanest_awards}</div>
                <div className='hero-highlight-label'>Cleanest Awards</div>
              </div>
              <div className='hero-highlight-container'>
                <div className='hero-highlight-number'>{totals.most_overtakes_awards}</div>
                <div className='hero-highlight-label'>Most Overtakes</div>
              </div>
              <div className='hero-highlight-container'>
                <div className='hero-highlight-number'>{totals.laps}</div>
                <div className='hero-highlight-label'>Laps Completed</div>
              </div>
            </div>


          </section>
          <DriverHistoryTable driverId={driverId} />
        </>
      )}
    </div>
  );
};
