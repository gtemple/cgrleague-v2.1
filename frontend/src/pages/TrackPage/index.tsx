import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTrackStats, type OrderBy } from "../../hooks/useTrackStats";
import { useTracksList } from "../../hooks/useTrackList";
import { displayImage } from "../../utils/displayImage";
import { PortraitContainer } from "../../components/PortraitContainer";
import { Loader } from "../../components/Loader";
import "./style.css";

const ORDER_OPTIONS = [
  { value: "points", label: "Points" },
  { value: "laps", label: "Laps" },
  { value: "wins", label: "Wins" },
  { value: "podiums", label: "Podiums" },
  { value: "dnfs", label: "DNFs" },
  { value: "dotds", label: "DOTDs" },
  { value: "fastest_laps", label: "Fastest Laps" },
  { value: "avg_finish", label: "Avg Finish" },
  { value: "driver", label: "Driver" },
] as const;

export const TrackPage = () => {
  const { trackId } = useParams<{ trackId: string }>();
  const navigate = useNavigate();

  // NEW: fetch list for dropdown
  const { tracks, isLoading: isTracksLoading } = useTracksList();

  const [includeSprints, setIncludeSprints] = useState(false);
  const [orderBy, setOrderBy] = useState<OrderBy>("points");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");

  const { data, isLoading, error } = useTrackStats(trackId, {
    includeSprints,
    orderBy,
    direction,
  });

  const track = data?.track;

  const headerSubtitle = useMemo(() => {
    if (!track) return "";
    const parts = [track.city, track.country].filter(Boolean);
    return parts.join(", ");
  }, [track]);

  const onSelectTrack = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextId = e.target.value;
    if (nextId) navigate(`/tracks/${nextId}`);
  };

  return (
    <div className="track-page container">
      <header className="track-header">
        <div className="track-meta">
          <h1 className="track-title">{track?.name ?? "Track"}</h1>
          {headerSubtitle && <div className="track-subtitle">{headerSubtitle}</div>}
        </div>

        {track?.image && (
          <div className="track-hero">
            <img src={displayImage(track.image, "trackImage")} alt={track.name} />
          </div>
        )}
      </header>

      {/* NEW: Top controls row with track picker + existing controls */}
      <section className="track-controls border">
        <div className="controls-left">
          {/* Track picker */}
          <label className="control">
            <span>Track</span>
            {isTracksLoading ? (
              <div className="select-skeleton" aria-hidden />
            ) : (
              <select
                className="track-select"
                value={trackId ?? ""}
                onChange={onSelectTrack}
              >
                {/* If current track isn’t in list, still show a placeholder */}
                {!trackId && <option value="">Select a track…</option>}
                {tracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.country ? ` — ${t.country}` : ""}
                  </option>
                ))}
              </select>
            )}
          </label>

          <label className="control">
            <span>Include sprints</span>
            <input
              type="checkbox"
              checked={includeSprints}
              onChange={(e) => setIncludeSprints(e.target.checked)}
            />
          </label>
        </div>

        <div className="controls-right">
          <label className="control">
            <span>Sort by</span>
            <select
              value={orderBy}
              onChange={(e) => setOrderBy(e.target.value as OrderBy)}
            >
              {ORDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <button
            className="btn"
            onClick={() => setDirection((d) => (d === "asc" ? "desc" : "asc"))}
            aria-label="Toggle sort direction"
            title="Toggle sort direction"
          >
            {direction === "asc" ? "↑ Asc" : "↓ Desc"}
          </button>
        </div>
      </section>

      {error && (
        <div className="state state-error">Failed to load track: {String(error.message || error)}</div>
      )}

      {isLoading && !error && (
        <div className="border">
          <Loader label="Loading driver stats…" full />
        </div>
      )}

      {!isLoading && !error && data && (
        <section className="border table-wrap">
          <div className="table-hint">Drag sideways to see more →</div>
          <table className="stats-table">
            <thead>
              <tr>
                <th className="col-driver">Driver</th>
                <th>Pts</th>
                <th>Laps</th>
                <th>Wins</th>
                <th>Podiums</th>
                <th>DNFs</th>
                <th>DOTDs</th>
                <th>FL</th>
                <th>Avg Fin</th>
                <th>Races</th>
              </tr>
            </thead>
            <tbody>
              {data.drivers.map((row) => (
                <tr key={row.driver.id}>
                  <td className="col-driver">
                    <div className="driver-cell">
                      {row.driver.profile_image ? (
                        <span>
                          {PortraitContainer(row.driver.profile_image)}
                        </span>
                      ) : (
                        <span className="avatar avatar-fallback" aria-hidden />
                      )}
                      <span className="driver-name">{row.driver.display_name}</span>
                    </div>
                  </td>
                  <td>{row.total_points}</td>
                  <td>{row.total_laps}</td>
                  <td>{row.wins}</td>
                  <td>{row.podiums}</td>
                  <td>{row.dnfs}</td>
                  <td>{row.dotds}</td>
                  <td>{row.fastest_laps}</td>
                  <td>{row.avg_finish_position !== null ? row.avg_finish_position.toFixed(1) : "—"}</td>
                  <td>{row.races_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
