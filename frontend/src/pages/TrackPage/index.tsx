import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTrackStats, type OrderBy } from "../../hooks/useTrackStats";
import { displayImage, randomTrackImage } from "../../utils/displayImage";
import { Loader } from "../../components/Loader";
import "./style.css";

const ORDER_OPTIONS: { value: OrderBy; label: string }[] = [
  { value: "points",       label: "Points" },
  { value: "wins",         label: "Wins" },
  { value: "podiums",      label: "Podiums" },
  { value: "fastest_laps", label: "Fastest Laps" },
  { value: "avg_finish",   label: "Avg Finish" },
  { value: "laps",         label: "Laps" },
  { value: "dnfs",         label: "DNFs" },
  { value: "dotds",        label: "DOTDs" },
  { value: "driver",       label: "Driver" },
];

export const TrackPage = () => {
  const { trackId } = useParams<{ trackId: string }>();

  const [includeSprints, setIncludeSprints] = useState(false);
  const [orderBy, setOrderBy] = useState<OrderBy>("points");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");

  const { data, isLoading, error } = useTrackStats(trackId, {
    includeSprints,
    orderBy,
    direction,
  });

  const track = data?.track;

  const subtitle = useMemo(() => {
    if (!track) return "";
    return [track.city, track.country].filter(Boolean).join(", ");
  }, [track]);

  // Aggregate stats derived from driver rows
  const summary = useMemo(() => {
    const drivers = data?.drivers ?? [];
    if (drivers.length === 0) return null;
    const totalRaces = Math.max(...drivers.map((d) => d.races_count));
    const topWinner = [...drivers].sort((a, b) => b.wins - a.wins)[0];
    const totalLaps = drivers.reduce((s, d) => s + d.total_laps, 0);
    const distinctWinners = new Set(drivers.filter((d) => d.wins > 0).map((d) => d.driver.id)).size;
    return { totalRaces, topWinner, totalLaps, driverCount: drivers.length, distinctWinners };
  }, [data]);

  const trackImg = track?.image ? randomTrackImage(track.image) : null;
  const km = track?.distance ? (track.distance / 1000).toFixed(3) : null;

  return (
    <div className="tp-page">

      {/* ── Hero ── */}
      <header className="tp-hero">
        {trackImg && (
          <div className="tp-hero-bg">
            <img loading="lazy" src={trackImg} alt="" aria-hidden />
          </div>
        )}

        <div className="tp-hero-content">
          <div className="tp-hero-left">
            {trackImg && (
              <div className="tp-track-img-wrap">
                <img loading="lazy" src={trackImg} alt={track?.name} className="tp-track-img" />
              </div>
            )}
            <div className="tp-hero-text">
              <div className="tp-eyebrow">CGR League · Track</div>
              <h1 className="tp-title">{track?.name ?? "Track"}</h1>
              {subtitle && (
                <div className="tp-subtitle">
                  {track?.country && displayImage(track.country, "flags") && (
                    <img loading="lazy"
                      className="tp-flag"
                      src={displayImage(track.country, "flags")}
                      alt={track.country}
                    />
                  )}
                  {subtitle.toUpperCase()}{km && ` · ${km} KM`}
                </div>
              )}
            </div>
          </div>

          <Link to="/tracks" className="tp-back">← All Tracks</Link>
        </div>

        {/* Stat strip */}
        {summary && (
          <>
            <div className="tp-hero-divider" />
            <div className="tp-stat-strip">
              <div className="tp-stat">
                <div className="tp-stat-value">{summary.totalRaces}</div>
                <div className="tp-stat-label">Races Held</div>
              </div>
              <div className="tp-stat">
                <div className="tp-stat-value">{summary.driverCount}</div>
                <div className="tp-stat-label">Drivers</div>
              </div>
              <div className="tp-stat">
                <div className="tp-stat-value">{summary.totalLaps.toLocaleString()}</div>
                <div className="tp-stat-label">Total Laps</div>
              </div>
              <div className="tp-stat">
                <div className="tp-stat-value">{summary.distinctWinners}</div>
                <div className="tp-stat-label">Distinct Winners</div>
              </div>
              {summary.topWinner.wins > 0 && (
                <div className="tp-stat tp-stat-winner">
                  <div className="tp-stat-value tp-winner-name">
                    {summary.topWinner.driver.display_name}
                  </div>
                  <div className="tp-stat-label">
                    Most Wins ({summary.topWinner.wins})
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {track?.bio && (
          <div className="tp-bio">{track.bio}</div>
        )}
      </header>

      <div className="tp-body">

      {/* ── Controls ── */}
      <div className="tp-controls">
        <div className="tp-controls-left">
          <span className="tp-control-label">SORT BY</span>
          <div className="tp-sort-pills">
            {ORDER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`tp-pill${orderBy === opt.value ? " tp-pill-active" : ""}`}
                onClick={() => setOrderBy(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="tp-controls-right">
          <button
            className={`tp-pill tp-pill-icon${includeSprints ? " tp-pill-active" : ""}`}
            onClick={() => setIncludeSprints((v) => !v)}
          >
            {includeSprints ? "✓ " : ""}Sprints
          </button>
          <button
            className="tp-pill tp-pill-icon tp-pill-dark"
            onClick={() => setDirection((d) => (d === "asc" ? "desc" : "asc"))}
            title="Toggle sort direction"
          >
            {direction === "asc" ? "↑ ASC" : "↓ DESC"}
          </button>
        </div>
      </div>

      {/* ── States ── */}
      {error && (
        <div className="tp-state-error">Failed to load track data.</div>
      )}

      {isLoading && !error && <Loader label="Loading driver stats…" full />}

      {/* ── Table ── */}
      {!isLoading && !error && data && (
        <div className="tp-table-card">
          <div className="tp-table-scroll">
            <table className="tp-table">
              <thead>
                <tr>
                  <th className="tp-col-rank">#</th>
                  <th className="tp-col-driver">Driver</th>
                  <th className={`tp-col-num${orderBy === "points" ? " tp-col-sorted" : ""}`}>Pts</th>
                  <th className={`tp-col-num${orderBy === "wins" ? " tp-col-sorted" : ""}`}>Wins</th>
                  <th className={`tp-col-num${orderBy === "podiums" ? " tp-col-sorted" : ""}`}>Pods</th>
                  <th className={`tp-col-num${orderBy === "fastest_laps" ? " tp-col-sorted" : ""}`}>FL</th>
                  <th className={`tp-col-num${orderBy === "dotds" ? " tp-col-sorted" : ""}`}>DOTD</th>
                  <th className={`tp-col-num${orderBy === "dnfs" ? " tp-col-sorted" : ""}`}>DNFs</th>
                  <th className={`tp-col-num${orderBy === "avg_finish" ? " tp-col-sorted" : ""}`}>Avg Fin</th>
                  <th className={`tp-col-num${orderBy === "laps" ? " tp-col-sorted" : ""}`}>Laps</th>
                  <th className="tp-col-num">Races</th>
                </tr>
              </thead>
              <tbody>
                {data.drivers.map((row, i) => (
                  <tr key={row.driver.id} className={i === 0 ? "tp-row-first" : ""}>
                    <td className="tp-col-rank tp-rank-num">{i + 1}</td>
                    <td className="tp-col-driver">
                      <div className="tp-driver-cell">
                        <div className="tp-avatar">
                          {row.driver.profile_image ? (
                            <img loading="lazy"
                              src={displayImage(row.driver.profile_image, "driver")}
                              alt={row.driver.display_name}
                            />
                          ) : null}
                        </div>
                        <span className="tp-driver-name">{row.driver.display_name}</span>
                      </div>
                    </td>
                    <td className={`tp-col-num tp-pts${orderBy === "points" ? " tp-col-sorted" : ""}`}>
                      {row.total_points}
                    </td>
                    <td className={`tp-col-num${row.wins > 0 ? " tp-wins" : ""}${orderBy === "wins" ? " tp-col-sorted" : ""}`}>
                      {row.wins > 0 ? row.wins : <span className="tp-zero">—</span>}
                    </td>
                    <td className={`tp-col-num${orderBy === "podiums" ? " tp-col-sorted" : ""}`}>
                      {row.podiums > 0 ? row.podiums : <span className="tp-zero">—</span>}
                    </td>
                    <td className={`tp-col-num${orderBy === "fastest_laps" ? " tp-col-sorted" : ""}`}>
                      {row.fastest_laps > 0 ? row.fastest_laps : <span className="tp-zero">—</span>}
                    </td>
                    <td className={`tp-col-num${orderBy === "dotds" ? " tp-col-sorted" : ""}`}>
                      {row.dotds > 0 ? row.dotds : <span className="tp-zero">—</span>}
                    </td>
                    <td className={`tp-col-num${orderBy === "dnfs" ? " tp-col-sorted" : ""}`}>
                      {row.dnfs > 0 ? row.dnfs : <span className="tp-zero">—</span>}
                    </td>
                    <td className={`tp-col-num${orderBy === "avg_finish" ? " tp-col-sorted" : ""}`}>
                      {row.avg_finish_position !== null ? row.avg_finish_position.toFixed(1) : "—"}
                    </td>
                    <td className={`tp-col-num${orderBy === "laps" ? " tp-col-sorted" : ""}`}>
                      {row.total_laps.toLocaleString()}
                    </td>
                    <td className="tp-col-num">{row.races_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      </div>
    </div>
  );
};
