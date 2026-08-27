import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { useRaceDetail } from "../../hooks/useRaceDetail";
import { useRaceArticles } from "../../hooks/useArticles";
import {
  Awards,
  ChampionshipImpact,
  CircuitHistory,
  GridFlow,
  Podium,
  TeammateBattles,
} from "./RacePanels";
import { articleTypeLabel } from "../../utils/articleUtils";
import { displayImage } from "../../utils/displayImage";
import { Loader } from "../../components/Loader";
import "./style.css";

function posClass(pos: number | null, status: string) {
  if (status !== "FIN" || pos == null) return "rp-pos rp-pos--dnf";
  if (pos === 1) return "rp-pos rp-pos--1";
  if (pos === 2) return "rp-pos rp-pos--2";
  if (pos === 3) return "rp-pos rp-pos--3";
  return "rp-pos";
}

function FlagChips({ r }: { r: {
  pole_position: boolean; fastest_lap: boolean; dotd: boolean;
  cleanest_driver: boolean; most_overtakes: boolean;
} }) {
  return (
    <div className="rp-flags">
      {r.pole_position && <span className="rp-chip rp-chip--pole" title="Pole position">POLE</span>}
      {r.fastest_lap && <span className="rp-chip rp-chip--fl" title="Fastest lap">FL</span>}
      {r.dotd && <span className="rp-chip rp-chip--dotd" title="Driver of the Day">DOTD</span>}
      {r.cleanest_driver && <span className="rp-chip rp-chip--clean" title="Cleanest Driver">CLEAN</span>}
      {r.most_overtakes && <span className="rp-chip rp-chip--ovt" title="Most Overtakes">OVT</span>}
    </div>
  );
}

export const RacePage = () => {
  const { seasonId, round } = useParams<{ seasonId: string; round: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const isSprint = searchParams.get("is_sprint") === "1";

  const setIsSprint = (value: boolean) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set("is_sprint", "1");
        else next.delete("is_sprint");
        return next;
      },
      { replace: true }
    );
  };

  const { data, isLoading, error } = useRaceDetail(seasonId, round, isSprint);
  const { data: articles } = useRaceArticles(seasonId, round);
  const race = data?.race;
  const results = data?.results ?? [];
  const is404 = !!error && (error as { status?: number }).status === 404;

  const trackImg = race?.track.image ? displayImage(race.track.image, "trackImage") : null;
  const flagImg = race?.track.country ? displayImage(race.track.country, "flags") : null;
  const location = race ? [race.track.city, race.track.country].filter(Boolean).join(", ") : "";

  return (
    <div className="rp-page">

      {/* ── Hero ── */}
      <header className="rp-hero">
        {trackImg && <img loading="eager" className="rp-hero-bg" src={trackImg} alt="" aria-hidden="true" />}
        <div className="rp-hero-overlay" />

        <div className="rp-hero-topbar">
          <Link to={`/seasons/${seasonId}`} className="rp-back">← SEASON {seasonId}</Link>
          <span className="rp-eyebrow">
            CGR LEAGUE · {race?.is_sprint ? "SPRINT" : "RACE"} RESULT
          </span>
        </div>

        <div className="rp-hero-body">
          <div className="rp-track-thumb">
            {trackImg
              ? <img loading="eager" src={trackImg} alt={race?.track.name ?? ""} />
              : <div className="rp-track-thumb-placeholder" />}
          </div>
          <div className="rp-hero-text">
            <div className="rp-hero-eyebrow">
              ROUND {String(round).padStart(2, "0")}{race?.is_sprint ? " · SPRINT" : ""} · SEASON {seasonId}
            </div>
            <h1 className="rp-title">{race?.track.name ?? "Race"}</h1>
            {race && (
              <div className="rp-meta">
                {flagImg && <img loading="lazy" className="rp-flag" src={flagImg} alt="" />}
                <span>{location.toUpperCase()}</span>
                {race.laps && (
                  <>
                    <span className="rp-dot">·</span>
                    <span>{race.laps} LAPS</span>
                  </>
                )}
              </div>
            )}
            {articles && articles.length > 0 && (
              <div className="rp-articles">
                {articles.map((a) => (
                  <Link key={a.id} to={`/articles/${a.id}`} className="rp-article-chip">
                    {articleTypeLabel(a.type)} →
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="rp-body">

        {/* ── Controls ── */}
        <div className="rp-controls">
          <div className="rp-seg" role="group" aria-label="Result type">
            <button className={!isSprint ? "rp-seg-active" : ""} aria-pressed={!isSprint} onClick={() => setIsSprint(false)}>Race</button>
            <button className={isSprint ? "rp-seg-active" : ""} aria-pressed={isSprint} onClick={() => setIsSprint(true)}>Sprint</button>
          </div>
          <div className="rp-nav">
            <button
              className="rp-nav-btn"
              disabled={!round || Number(round) <= 1}
              onClick={() => navigate(`/seasons/${seasonId}/races/${Number(round) - 1}`)}
            >
              ← Prev
            </button>
            <span className="rp-nav-label">ROUND {round}</span>
            <button
              className="rp-nav-btn"
              disabled={is404}
              onClick={() => navigate(`/seasons/${seasonId}/races/${Number(round) + 1}`)}
            >
              Next →
            </button>
          </div>
        </div>

        {isLoading && <Loader label="Loading race…" full />}

        {error && (
          <div className="rp-error">
            {is404
              ? isSprint
                ? `No sprint race for Round ${round}.`
                : "No race found for this round."
              : `Failed to load race: ${error.message}`}
          </div>
        )}

        {!isLoading && !error && data && results.length === 0 && (
          <div className="rp-empty">
            This race hasn't run yet — results will appear once it's complete.
          </div>
        )}

        {!isLoading && !error && data && results.length > 0 && (
          <>
            <Podium results={results} />
            <Awards results={results} />
          </>
        )}

        {!isLoading && !error && data && results.length > 0 && (
          <div className="rp-table-card">
            {/* Desktop table */}
            <div className="rp-table-scroll">
              <table className="rp-table">
                <thead>
                  <tr>
                    <th className="rp-col-pos">#</th>
                    <th className="rp-col-driver">Driver</th>
                    <th className="rp-col-team">Team</th>
                    <th>Grid</th>
                    <th>Pts</th>
                    <th>Laps</th>
                    <th>Status</th>
                    <th className="rp-col-flags">Awards</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.driver.id} className={r.status !== "FIN" ? "rp-row-dnf" : ""}>
                      <td className="rp-col-pos">
                        <span className={posClass(r.finish_position, r.status)}>
                          {r.finish_position ?? "—"}
                        </span>
                      </td>
                      <td className="rp-col-driver">
                        <div className="rp-driver-cell">
                          <div className="rp-avatar">
                            {r.driver.profile_image && (
                              <img loading="lazy" src={displayImage(r.driver.profile_image, "driver")} alt="" />
                            )}
                          </div>
                          <Link to={`/drivers/${r.driver.id}`} className="rp-driver-name">
                            {r.driver.display_name}
                          </Link>
                        </div>
                      </td>
                      <td className="rp-col-team">
                        <div className="rp-team-cell">
                          {r.team.logo_image && (
                            <img loading="lazy" className="rp-team-logo" src={displayImage(r.team.logo_image, "team")} alt="" />
                          )}
                          <span>{r.team.name}</span>
                        </div>
                      </td>
                      <td className="rp-num">{r.grid_position ?? "—"}</td>
                      <td className="rp-num rp-pts">{r.points > 0 ? r.points : "—"}</td>
                      <td className="rp-num">{r.laps_completed ?? "—"}</td>
                      <td>
                        <span className={`rp-status${r.status !== "FIN" ? " rp-status--dnf" : ""}`}>{r.status}</span>
                      </td>
                      <td className="rp-col-flags"><FlagChips r={r} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="rp-cards">
              {results.map((r) => (
                <div key={r.driver.id} className={`rp-card${r.status !== "FIN" ? " rp-card--dnf" : ""}`}>
                  <span className={posClass(r.finish_position, r.status)}>{r.finish_position ?? "—"}</span>
                  <div className="rp-card-body">
                    <div className="rp-card-top">
                      <div className="rp-avatar">
                        {r.driver.profile_image && (
                          <img loading="lazy" src={displayImage(r.driver.profile_image, "driver")} alt="" />
                        )}
                      </div>
                      <Link to={`/drivers/${r.driver.id}`} className="rp-driver-name">{r.driver.display_name}</Link>
                      <span className="rp-card-pts">{r.points > 0 ? `${r.points} pts` : "—"}</span>
                    </div>
                    <div className="rp-card-bottom">
                      <div className="rp-team-cell">
                        {r.team.logo_image && (
                          <img loading="lazy" className="rp-team-logo" src={displayImage(r.team.logo_image, "team")} alt="" />
                        )}
                        <span>{r.team.name}</span>
                      </div>
                      <div className="rp-card-meta">
                        {r.grid_position != null && <span>Grid {r.grid_position}</span>}
                        {r.laps_completed != null && <span>{r.laps_completed} laps</span>}
                        {r.status !== "FIN" && <span className="rp-status rp-status--dnf">{r.status}</span>}
                      </div>
                      <FlagChips r={r} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isLoading && !error && data && results.length > 0 && (
          <div className="rp-grid-2">
            <ChampionshipImpact rows={data.standings_impact} />
            <TeammateBattles results={results} />
            <GridFlow results={results} />
            <CircuitHistory rows={data.track_history} trackName={race?.track.name ?? ""} />
          </div>
        )}
      </div>
    </div>
  );
};
