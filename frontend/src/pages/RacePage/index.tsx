import { useState } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { useRaceDetail } from "../../hooks/useRaceDetail";
import { useRaceArticles } from "../../hooks/useArticles";
import { articleTypeLabel } from "../../utils/articleUtils";
import { displayImage } from "../../utils/displayImage";
import { getPositionColor } from "../../utils/getPositionColor";
import { Loader } from "../../components/Loader";
import "./style.css";

export const RacePage = () => {
  const { seasonId, round } = useParams<{ seasonId: string; round: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isSprint, setIsSprint] = useState(searchParams.get("is_sprint") === "1");

  const { data, isLoading, error } = useRaceDetail(seasonId, round, isSprint);
  const { data: articles } = useRaceArticles(seasonId, round);
  const race = data?.race;
  const results = data?.results ?? [];

  const title = race
    ? `${race.is_sprint ? "Sprint" : "Race"} — Round ${race.round}`
    : "Race";

  return (
    <div className="race-page">
      <div className="race-page-back">
        <Link to={`/seasons/${seasonId}`}>← Season {seasonId}</Link>
      </div>

      <header className="race-header">
        <div className="race-meta">
          <h1 className="race-title">{title}</h1>
          {race && (
            <div className="race-subtitle">
              {race.track.name}
              {race.track.city ? `, ${race.track.city}` : ""}
              {race.track.country ? ` — ${race.track.country}` : ""}
            </div>
          )}
          {articles && articles.length > 0 && (
            <div className="race-articles">
              {articles.map((a) => (
                <Link key={a.id} to={`/articles/${a.id}`} className="race-article-chip">
                  {articleTypeLabel(a.type)}
                </Link>
              ))}
            </div>
          )}
        </div>

        {race?.track.image && (
          <div className="race-track-hero">
            <img
              src={displayImage(race.track.image, "trackImage")}
              alt={race.track.name}
            />
          </div>
        )}
      </header>

      <div className="race-controls border">
        <label className="race-control">
          <input
            type="checkbox"
            checked={isSprint}
            onChange={(e) => setIsSprint(e.target.checked)}
          />
          Sprint result
        </label>

        <div className="race-nav">
          <button
            className="btn"
            disabled={!round || Number(round) <= 1}
            onClick={() => navigate(`/seasons/${seasonId}/races/${Number(round) - 1}`)}
          >
            ← Prev
          </button>
          <span className="race-round-label">Round {round}</span>
          <button
            className="btn"
            onClick={() => navigate(`/seasons/${seasonId}/races/${Number(round) + 1}`)}
          >
            Next →
          </button>
        </div>
      </div>

      {isLoading && <Loader label="Loading race…" full />}

      {error && (
        <div className="race-error">
          {(error as { status?: number }).status === 404
            ? "No race found for this round."
            : `Failed to load race: ${error.message}`}
        </div>
      )}

      {!isLoading && !error && data && (
        <section className="border race-results-wrap">
          <table className="race-table">
            <thead>
              <tr>
                <th className="col-pos">Pos</th>
                <th className="col-driver">Driver</th>
                <th className="col-team">Team</th>
                <th>Grid</th>
                <th>Pts</th>
                <th>Laps</th>
                <th>Status</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.driver.id} className={r.status !== "FIN" ? "row-dnf" : ""}>
                  <td className="col-pos">
                    <span
                      className="pos-badge"
                      style={{
                        background: r.finish_position
                          ? getPositionColor(String(r.finish_position))
                          : undefined,
                      }}
                    >
                      {r.finish_position ?? "—"}
                    </span>
                  </td>
                  <td className="col-driver">
                    <div className="driver-cell">
                      {r.driver.profile_image && (
                        <div className="avatar">
                          <img
                            src={displayImage(r.driver.profile_image, "driver")}
                            alt={r.driver.display_name}
                          />
                        </div>
                      )}
                      <Link
                        to={`/drivers/${r.driver.id}`}
                        className="driver-name-link"
                      >
                        {r.driver.display_name}
                      </Link>
                    </div>
                  </td>
                  <td className="col-team">
                    <div className="team-cell">
                      {r.team.logo_image && (
                        <div className="team-logo-sm">
                          <img
                            src={displayImage(r.team.logo_image, "team")}
                            alt={r.team.name}
                          />
                        </div>
                      )}
                      {r.team.name}
                    </div>
                  </td>
                  <td>{r.grid_position ?? "—"}</td>
                  <td className="col-pts">{r.points > 0 ? r.points : "—"}</td>
                  <td>{r.laps_completed ?? "—"}</td>
                  <td>
                    <span className={r.status !== "FIN" ? "status-badge status-dnf" : "status-badge"}>
                      {r.status}
                    </span>
                  </td>
                  <td className="col-flags">
                    {r.pole_position && <span className="flag-chip chip-pole" title="Pole position">P</span>}
                    {r.fastest_lap && <span className="flag-chip chip-fl" title="Fastest lap">FL</span>}
                    {r.dotd && <span className="flag-chip chip-dotd" title="Driver of the Day">DOTD</span>}
                    {r.cleanest_driver && <span className="flag-chip chip-clean" title="Cleanest Driver">C</span>}
                    {r.most_overtakes && <span className="flag-chip chip-ov" title="Most Overtakes">OV</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
};
