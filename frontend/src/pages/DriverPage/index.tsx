import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useDriversList } from "../../hooks/useDriverList";
import { useDriverDetail } from "../../hooks/useDriverDetails";
import { DriverHistoryTable } from "./DriverHistoryTable";
import { DriverTrackGrid } from "./DriverTrackGrid";
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

  const [selectValue, setSelectValue] = useState(driverId ?? "");
  useEffect(() => {
    if (driverId != null) setSelectValue(driverId);
  }, [driverId]);

  const hasValueInList = list?.some(d => String(d.id) === selectValue);
  const selectedLabel =
    driver?.display_name ??
    list?.find(d => String(d.id) === selectValue)?.display_name ??
    "Loading…";

  const portraitSrc = driver?.profile_image
    ? displayImage(driver.profile_image, "driver")
    : null;

  const apg = totals?.avg_positions_gained;

  return (
    <div className="dp-page">

      {isLoading && <Loader label="Loading driver…" full />}
      {!isLoading && error && <div className="dp-state-error">Failed to load driver.</div>}

      {!isLoading && !error && driver && totals && (
        <>
          {/* ══════════════════════ HERO ══════════════════════ */}
          <header className="dp-hero">

            {/* Full-bleed atmospheric background */}
            <div className="dp-hero-bg">
              {portraitSrc && <img src={portraitSrc} alt="" aria-hidden />}
              <div className="dp-hero-bg-overlay" />
            </div>

            {/* Top bar: back link + eyebrow + picker */}
            <div className="dp-hero-topbar">
              <Link to="/drivers" className="dp-back">← All Drivers</Link>
              <span className="dp-eyebrow">CGR League · Driver</span>
              {!listError && (
                <select
                  className="dp-picker"
                  value={selectValue}
                  onChange={(e) => {
                    const next = e.target.value;
                    setSelectValue(next);
                    if (next && next !== driverId) navigate(`/drivers/${next}`);
                  }}
                  aria-busy={listLoading || undefined}
                  disabled={!!listError}
                >
                  {!hasValueInList && selectValue && (
                    <option value={selectValue}>{selectedLabel}</option>
                  )}
                  {list?.map((d) => (
                    <option key={d.id} value={String(d.id)}>{d.display_name}</option>
                  ))}
                  {!selectValue && <option value="">Select a driver…</option>}
                </select>
              )}
            </div>

            {/* Main hero body: portrait left, name right */}
            <div className="dp-hero-body">
              <div className="dp-portrait-wrap">
                {portraitSrc
                  ? <img className="dp-portrait-img" src={portraitSrc} alt={driver.display_name} />
                  : <div className="dp-portrait-fallback" />}
              </div>

              <div className="dp-hero-name-block">
                <div className="dp-name-first">{driver.first_name}</div>
                <div className="dp-name-last">{driver.last_name}</div>
                {driver.country_of_representation && (
                  <div className="dp-nationality">
                    <img
                      className="dp-flag"
                      src={displayImage(driver.country_of_representation, "flags")}
                      alt={driver.country_of_representation}
                    />
                  </div>
                )}
                <div className="dp-hero-quick-stats">
                  <span className="dp-quick-chip">{totals.wins} Wins</span>
                  <span className="dp-quick-chip">{totals.podiums} Podiums</span>
                  <span className="dp-quick-chip">{totals.poles} Poles</span>
                </div>
              </div>
            </div>

            {/* Stat strip */}
            <div className="dp-stat-strip">
              {[
                { value: totals.points,                              label: "Points" },
                { value: totals.races,                               label: "Races" },
                { value: totals.ppr != null ? totals.ppr.toFixed(1) : "—", label: "Pts / Race" },
                { value: totals.avg_finish != null ? totals.avg_finish.toFixed(1) : "—", label: "Avg Finish" },
                {
                  value: apg != null ? (apg >= 0 ? "+" : "") + apg.toFixed(1) : "—",
                  label: "Avg Pos +/−",
                  cls: apg != null ? (apg >= 0 ? "dp-pos" : "dp-neg") : "",
                  tip: "Grid position recorded from Season 7",
                },
                { value: totals.fastest_laps,    label: "Fastest Laps" },
                { value: totals.dotds,           label: "DOTDs" },
                { value: totals.cleanest_awards, label: "Cleanest" },
                { value: totals.most_overtakes_awards, label: "Overtakes" },
                { value: totals.laps.toLocaleString(), label: "Laps" },
              ].map((s) => (
                <div className="dp-stat" key={s.label}>
                  <div className={`dp-stat-value${s.cls ? " " + s.cls : ""}`}>
                    {s.value}
                    {s.tip && (
                      <span className="dp-info-tip" title={s.tip}>?</span>
                    )}
                  </div>
                  <div className="dp-stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          {driver.bio && (
            <div className="dp-bio">{driver.bio}</div>
          )}

          </header>

          {/* ══════════════════════ HISTORY ══════════════════════ */}
          <DriverHistoryTable driverId={driverId} />

          {/* ══════════════════════ TRACK RECORD ══════════════════════ */}
          <DriverTrackGrid driverId={driverId} />
        </>
      )}
    </div>
  );
};
