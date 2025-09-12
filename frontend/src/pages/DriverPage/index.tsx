import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDriversList } from "../../hooks/useDriverList";
import { useDriverDetail } from "../../hooks/useDriverDetails";
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

  const headerSubtitle = useMemo(() => {
    if (!driver) return "";
    const parts = [driver.first_name, driver.last_name].filter(Boolean);
    return parts.join(" · ");
  }, [driver]);

  const selectedLabel =
    driver?.display_name ??
    list?.find(d => String(d.id) === selectValue)?.display_name ??
    "Loading…";

  return (
    <div className="driver-page container">
      <header className="driver-header">
        <div className="driver-meta">
          <h1 className="driver-title">
            {driver?.display_name ??
              list?.find(d => String(d.id) === selectValue)?.display_name ??
              "Driver"}
          </h1>
          {headerSubtitle && <div className="driver-subtitle">{headerSubtitle}</div>}
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
      </header>

      {isLoading && <Loader label="Loading driver…" full />}

      {!isLoading && error && (
        <div className="state state-error">Failed to load driver.</div>
      )}

      {!isLoading && !error && driver && totals && (
        <>
          <section className="driver-hero border">
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


            <div className="hero-stats">
              <div className="stat-card">
                <div className="stat-label">Points</div>
                <div className="stat-value">{totals.points}</div>
                <div className="stat-sub">
                  Base {totals.points_breakdown.base} · FL +{totals.points_breakdown.fastest_lap_bonus}
                </div>
              </div>

              <div className="stat-grid">
                <div className="stat"><span className="stat-k">Wins</span><span className="stat-v">{totals.wins}</span></div>
                <div className="stat"><span className="stat-k">Podiums</span><span className="stat-v">{totals.podiums}</span></div>
                <div className="stat"><span className="stat-k">Poles</span><span className="stat-v">{totals.poles}</span></div>
                <div className="stat"><span className="stat-k">Fastest Laps</span><span className="stat-v">{totals.fastest_laps}</span></div>
                <div className="stat"><span className="stat-k">Laps</span><span className="stat-v">{totals.laps}</span></div>
                <div className="stat"><span className="stat-k">Races</span><span className="stat-v">{totals.races}</span></div>
                <div className="stat"><span className="stat-k">Completed</span><span className="stat-v">{totals.races_completed}</span></div>
                <div className="stat"><span className="stat-k">DNFs</span><span className="stat-v">{totals.dnfs}</span></div>
                <div className="stat"><span className="stat-k">Avg Finish</span><span className="stat-v">{totals.avg_finish !== null ? totals.avg_finish.toFixed(1) : "—"}</span></div>
                <div className="stat"><span className="stat-k">Cleanest</span><span className="stat-v">{totals.cleanest_awards}</span></div>
                <div className="stat"><span className="stat-k">Most Overtakes</span><span className="stat-v">{totals.most_overtakes_awards}</span></div>
                <div className="stat"><span className="stat-k">DOTD</span><span className="stat-v">{totals.dotds}</span></div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
