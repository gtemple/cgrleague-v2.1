import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useNextRaceTeaser } from "../../hooks/useNextRaceTeaser";
import { useLatestArticles } from "../../hooks/useArticles";
import type { ArticleSummary } from "../../hooks/useArticles";
import { useDriversHomepage } from "../../hooks/useDriversHomepage";
import { useSeasonStandings } from "../../hooks/useSeasonStandings";
import { useConstructorStandings } from "../../hooks/useConstructorStandings";
import { useHallOfFame } from "../../hooks/useHallOfFame";
import { useLatestSeasonId } from "../../hooks/useLatestSeasonId";
import { HistoryTeaser } from "../../components/HistoryTeaser/index";
import { NewsletterSignup } from "../../components/NewsletterSignup";
import { StatusTicker } from "../../components/StatusTicker";
import { articleTrackImage, displayImage, randomTrackImage } from "../../utils/displayImage";
import { articleTypeLabel, formatArticleDate } from "../../utils/articleUtils";
import { teamCode } from "../../utils/teamCode";
import "./style.css";

function initialLast(fullName: string) {
  const parts = fullName.trim().split(" ");
  return parts.length > 1 ? `${parts[0][0]}. ${parts[parts.length - 1]}` : fullName;
}

function initials(first: string, last: string) {
  return `${(first[0] ?? "").toUpperCase()}${(last[0] ?? "").toUpperCase()}`;
}

function trendDisplay(trend: number) {
  if (trend > 0) return { label: `▲${trend}`, cls: "trend-up" };
  if (trend < 0) return { label: `▼${Math.abs(trend)}`, cls: "trend-down" };
  return { label: "—", cls: "trend-flat" };
}

function formDot(v: number | "DNF") {
  if (v === "DNF") return { label: "DNF", cls: "dot-dnf" };
  if (v === 1) return { label: "P1", cls: "dot-p1" };
  if (v <= 3) return { label: `P${v}`, cls: "dot-podium" };
  if (v <= 10) return { label: `P${v}`, cls: "dot-points" };
  return { label: `P${v}`, cls: "dot-other" };
}

function articleTagClass(type: ArticleSummary["type"]) {
  switch (type) {
    case "RECAP": return "tag-red";
    case "PREVIEW": return "tag-blue";
    case "POWER_RANKINGS": return "tag-gold";
    case "SESSION": return "tag-green";
    case "SEASON_PREVIEW":
    case "SEASON_RECAP": return "tag-purple";
    default: return "tag-red";
  }
}

function useCountdown(target: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  if (!target) return null;
  let s = Math.max(0, Math.floor((new Date(target).getTime() - now) / 1000));
  const d = Math.floor(s / 86400); s -= d * 86400;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return { d: pad(d), h: pad(h), m: pad(m), s: pad(s) };
}

export const HomePage = () => {
  const { data: teaser, isLoading: teaserLoading } = useNextRaceTeaser({ includeSprints: true });
  const { data: latestArticles, isLoading: articlesLoading } = useLatestArticles();
  const { data: driversHome, isLoading: driversHomeLoading } = useDriversHomepage();
  const latestSeasonId = useLatestSeasonId();

  const upcoming = teaser?.upcoming_race ?? null;
  const track = upcoming?.track ?? null;
  const race = upcoming?.race ?? null;
  const trackImg = track?.image ? randomTrackImage(track.image) : null;
  const flagImg = track?.country ? displayImage(track.country, "flags") : null;
  const km = track?.distance ? (track.distance / 1000).toFixed(3) : null;
  const countdown = useCountdown(race?.started_at ?? null);
  const trackWinners = (teaser?.recent_winners ?? []).slice(0, 3);
  const followingTwo = (teaser?.following_two ?? []).slice(0, 2);

  // Preview article, only if it's for the race in the hero (not a stale fallback)
  const upcomingPreview =
    race && latestArticles?.preview?.race?.id === race.id ? latestArticles.preview : null;

  const seasonId = teaser?.season_id ?? latestSeasonId ?? null;
  const { data: driverStandings, isLoading: driverStandingsLoading } = useSeasonStandings(seasonId ?? 0);
  const { data: constructorStandings, isLoading: constructorStandingsLoading } = useConstructorStandings(seasonId ?? 0);
  const { data: hof, isLoading: hofLoading } = useHallOfFame(true);
  const standingsLoading = teaserLoading || driverStandingsLoading || constructorStandingsLoading;

  const humans = driversHome?.human_spotlight ?? [];
  const lastRaceLabel = driversHome?.last_race?.track_name?.toUpperCase() ?? null;

  const topDrivers = (driverStandings ?? []).slice(0, 8);
  const leaderPoints = topDrivers[0]?.points ?? 0;
  const constructors = constructorStandings ?? [];
  const maxConstructorPoints = Math.max(1, ...constructors.map((c) => c.points));

  const champions = hof?.season_champions ?? [];

  const articles = [
    latestArticles?.recap,
    latestArticles?.preview,
    latestArticles?.rankings,
    latestArticles?.session,
  ]
    .filter((a): a is ArticleSummary => !!a);

  const leaderRow = topDrivers[0];
  const runnerUpPoints = topDrivers[1]?.points ?? 0;

  return (
    <div className="home-page">
    {seasonId && leaderRow ? (
      <StatusTicker
        seasonLabel={`SEASON ${seasonId}`}
        roundCurrent={teaser?.completed_rounds ?? 0}
        roundTotal={teaser?.total_rounds ?? 0}
        leaderName={leaderRow.driver.display_name}
        leaderPoints={leaderRow.points}
        margin={leaderRow.points - runnerUpPoints}
        right={track ? <span>NEXT <b>{track.name.toUpperCase()}</b></span> : null}
      />
    ) : standingsLoading ? (
      <div className="status-ticker">
        <span className="sk ticker-sk ticker-sk--season" />
        <span className="ticker-divider" />
        <span className="sk ticker-sk" />
        <span className="ticker-divider" />
        <span className="sk ticker-sk ticker-sk--wide" />
      </div>
    ) : null}
    <div className="home">

      {/* ── Hero ── */}
      <section className="home-hero">
        <div className="hero-main">
          {trackImg && <img loading="eager" className="hero-bg" src={trackImg} alt="" aria-hidden="true" />}
          <div className="hero-overlay" />
          {teaserLoading ? (
            <div className="hero-content">
              <div className="hero-badges">
                <span className="sk sk--dark hero-sk-badge" />
                <span className="sk sk--dark hero-sk-round" />
              </div>
              <span className="sk sk--dark hero-sk-title" />
              <span className="sk sk--dark hero-sk-meta" />
              <span className="sk sk--dark hero-sk-cta" />
            </div>
          ) : upcoming ? (
            <div className="hero-content">
              <div className="hero-badges">
                <span className="hero-badge-next">NEXT RACE</span>
                <span className="hero-round-label">
                  ROUND {String(race!.round).padStart(2, "0")}{race!.is_sprint ? " · SPRINT" : ""} · {track!.name.toUpperCase()}
                </span>
              </div>
              <h1 className="hero-title">{track!.name}</h1>
              <div className="hero-meta">
                {flagImg && <img loading="lazy" className="hero-flag" src={flagImg} alt="" />}
                <span>{[track!.city, track!.country].filter(Boolean).join(", ")}</span>
                {km && (
                  <>
                    <span className="hero-dot">·</span>
                    <span>{km} KM{race!.laps ? ` · ${race!.laps} LAPS` : ""}</span>
                  </>
                )}
              </div>
              {upcomingPreview && (
                <Link to={`/articles/${upcomingPreview.id}`} className="hero-preview-link">
                  Read race preview →
                </Link>
              )}
            </div>
          ) : (
            <div className="hero-content">
              <h1 className="hero-title">Season Complete</h1>
            </div>
          )}
        </div>

        <div className="hero-countdown-card">
          <div className="cd-label">LIGHTS OUT IN</div>
          {teaserLoading ? (
            <>
              <div className="cd-grid">
                {[0, 1, 2, 3].map((i) => (
                  <div className="cd-cell" key={i}>
                    <span className="sk cd-sk-value" />
                    <span className="sk cd-sk-unit" />
                  </div>
                ))}
              </div>
              <div className="cd-context">
                <div className="cd-sub-label">Winners here</div>
                <div className="cd-winners">
                  {[0, 1, 2].map((i) => (
                    <div className="cd-winner" key={i}>
                      <span className="sk cd-sk-season" />
                      <span className="sk cd-sk-name" />
                      <span className="sk cd-sk-team" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="cd-then">
                <span className="sk cd-sk-then" />
              </div>
            </>
          ) : countdown ? (
            <div className="cd-grid">
              <div className="cd-cell">
                <div className="cd-value cd-value--accent">{countdown.d}</div>
                <div className="cd-unit">DAYS</div>
              </div>
              <div className="cd-cell">
                <div className="cd-value">{countdown.h}</div>
                <div className="cd-unit">HRS</div>
              </div>
              <div className="cd-cell">
                <div className="cd-value">{countdown.m}</div>
                <div className="cd-unit">MIN</div>
              </div>
              <div className="cd-cell">
                <div className="cd-value">{countdown.s}</div>
                <div className="cd-unit">SEC</div>
              </div>
            </div>
          ) : (
            <div className="cd-tbd">Date TBD</div>
          )}

          {!teaserLoading && (
          <>
          <div className="cd-context">
            <div className="cd-sub-label">Winners here</div>
            {trackWinners.length > 0 ? (
              <div className="cd-winners">
                {trackWinners.map((w) => (
                  <div className="cd-winner" key={`${w.season_id}-${w.driver.id}`}>
                    <span className="cd-winner-season">S{w.season_id}</span>
                    <span className="cd-winner-name">{w.driver.display_name}</span>
                    <span className="cd-winner-team">{teamCode(w.team?.name)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="cd-winners-empty">First visit to this circuit</div>
            )}
          </div>

          {followingTwo.length > 0 && (
            <div className="cd-then">
              <span className="cd-then-label">Then</span>
              {followingTwo.map(({ event }) => (
                <span className="cd-then-item" key={event.id}>
                  <b>R{String(event.round).padStart(2, "0")}</b>{" "}
                  {(event.track.city || event.track.name).toUpperCase()}
                </span>
              ))}
            </div>
          )}
          </>
          )}

          <Link
            to={
              seasonId && race
                ? `/seasons/${seasonId}/races/${race.round}${race.is_sprint ? "?is_sprint=1" : ""}`
                : seasonId ? `/seasons/${seasonId}` : "/seasons/1"
            }
            className="cd-cta"
          >
            Race Centre →
          </Link>
        </div>
      </section>

      {/* ── The humans ── */}
      {driversHomeLoading ? (
        <section className="humans-section">
          <div className="humans-header">
            <span className="humans-label">THE HUMANS</span>
          </div>
          <div className="humans-grid">
            {[0, 1, 2, 3].map((i) => (
              <div className="human-card human-card--sk" key={i}>
                <div className="human-card-bar" />
                <div className="human-card-body">
                  <div className="human-card-top">
                    <div className="human-card-id">
                      <span className="sk human-sk-avatar" />
                      <div className="human-card-name-block">
                        <span className="sk human-sk-name" />
                        <span className="sk human-sk-team" />
                      </div>
                    </div>
                    <span className="sk human-sk-pos" />
                  </div>
                  <div className="human-stats">
                    <div className="human-stat">
                      <span className="sk human-sk-stat" />
                      <span className="sk human-sk-stat-label" />
                    </div>
                    <div className="human-stat">
                      <span className="sk human-sk-stat" />
                      <span className="sk human-sk-stat-label" />
                    </div>
                  </div>
                  <div className="human-form">
                    {[0, 1, 2, 3, 4].map((j) => <span className="sk human-sk-form" key={j} />)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : humans.length > 0 && (
        <section className="humans-section">
          <div className="humans-header">
            <span className="humans-label">THE HUMANS</span>
            {seasonId && <span className="humans-sub">· SEASON {seasonId} · THREE DRIVERS vs THE AI GRID</span>}
          </div>
          <div className="humans-grid">
            {humans.map((h) => {
              const avatarUrl = h.driver.profile_image ? displayImage(h.driver.profile_image, "driver") : null;
              const accent = h.team?.color || "#7a766b";
              return (
                <Link
                  key={h.driver.id}
                  to={`/drivers/${h.driver.id}`}
                  className="human-card"
                  style={{ "--accent": accent } as React.CSSProperties}
                >
                  <div className="human-card-bar" />
                  <div className="human-card-body">
                    <div className="human-card-top">
                      <div className="human-card-id">
                        <span className="human-avatar">
                          {avatarUrl
                            ? <img loading="lazy" src={avatarUrl} alt="" />
                            : initials(h.driver.first_name, h.driver.last_name)}
                        </span>
                        <div className="human-card-name-block">
                          <div className="human-name-row">
                            <span className="human-name">{h.driver.display_name}</span>
                            {h.is_reserve
                              ? <span className="human-reserve">RESERVE</span>
                              : <span className="human-dot" />}
                          </div>
                          <div className="human-team">{(h.team?.display_name ?? h.team?.name ?? "").toUpperCase()}</div>
                        </div>
                      </div>
                      <span className="human-pos">P{h.position}</span>
                    </div>
                    <div className="human-stats">
                      <div className="human-stat">
                        <div className="human-stat-value">{h.points}</div>
                        <div className="human-stat-label">POINTS</div>
                      </div>
                      <div className="human-stat">
                        <div className="human-stat-value">{h.last_finish != null ? `P${h.last_finish}` : "—"}</div>
                        <div className="human-stat-label">LAST{lastRaceLabel ? ` · ${lastRaceLabel}` : ""}</div>
                      </div>
                    </div>
                    {h.form.length > 0 && (
                      <div className="human-form">
                        <span className="human-form-label">FORM</span>
                        {h.form.map((f, i) => {
                          const d = formDot(f);
                          return <span key={i} className={`human-form-dot ${d.cls}`}>{d.label}</span>;
                        })}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Standings ── */}
      {standingsLoading ? (
        <div className="home-standings-grid">
          {[
            { title: "DRIVER STANDINGS", rows: 8, cls: "standings-row" },
            { title: "CONSTRUCTOR STANDINGS", rows: 8, cls: "ctor-row" },
          ].map((card) => (
            <div className="standings-card" key={card.title}>
              <div className="standings-card-header">
                <span className="standings-card-title">{card.title}</span>
              </div>
              {Array.from({ length: card.rows }).map((_, i) => (
                <div className={`${card.cls} ${card.cls}--sk`} key={i}>
                  <span className="sk sk-row-pos" />
                  <span className="sk sk-row-bar" />
                  <div className="sk-row-identity">
                    <span className="sk sk-row-name" />
                    <span className="sk sk-row-sub" />
                  </div>
                  <span className="sk sk-row-points" />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (topDrivers.length > 0 || constructors.length > 0) && (
        <div className="home-standings-grid">
          <div className="standings-card">
            <div className="standings-card-header">
              <span className="standings-card-title">DRIVER STANDINGS</span>
              <Link to={seasonId ? `/seasons/${seasonId}` : "/seasons/1"} className="standings-card-link">FULL TABLE →</Link>
            </div>
            {topDrivers.map((row, i) => {
              const pos = i + 1;
              const trend = trendDisplay(row.trend);
              const gap = pos === 1 ? "LEADER" : `+${leaderPoints - row.points}`;
              return (
                <div key={row.driver_season_id} className="standings-row">
                  <div className="standings-pos">
                    <span className="standings-pos-num">{pos}</span>
                    <span className={`standings-trend ${trend.cls}`}>{trend.label}</span>
                  </div>
                  <span className="standings-bar" style={{ background: row.team.color || "#d9d6cd" }} />
                  <div className="standings-identity">
                    <div className="standings-name-row">
                      <span className="standings-name">{row.driver.display_name}</span>
                      {row.driver.is_human && <span className="standings-human-badge">HUMAN</span>}
                    </div>
                    <div className="standings-team">{row.team.name?.toUpperCase()}</div>
                  </div>
                  <div className="standings-points">
                    <div className="standings-points-value">{row.points}</div>
                    <div className="standings-points-gap">{gap}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="standings-card">
            <div className="standings-card-header">
              <span className="standings-card-title">CONSTRUCTOR STANDINGS</span>
              <Link to={seasonId ? `/seasons/${seasonId}` : "/seasons/1"} className="standings-card-link">FULL TABLE →</Link>
            </div>
            {constructors.map((row, i) => {
              const pos = i + 1;
              const trend = trendDisplay(row.trend);
              const pct = Math.round((row.points / maxConstructorPoints) * 100);
              const color = row.team.color || "#9b988d";
              return (
                <div key={row.team.id ?? i} className="ctor-row">
                  <div className="ctor-pos">
                    <span className="ctor-pos-num">{pos}</span>
                    <span className={`ctor-trend ${trend.cls}`}>{trend.label}</span>
                  </div>
                  <span className="ctor-code" style={{ background: color }}>{teamCode(row.team.name)}</span>
                  <div className="ctor-identity">
                    <div className="ctor-name">{row.team.display_name ?? row.team.name}</div>
                    <div className="ctor-bar-track">
                      <div className="ctor-bar-fill" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                  <div className="ctor-points">{row.points}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Flashback ── */}
      <HistoryTeaser />

      {/* ── Roll of Honour ── */}
      {hofLoading ? (
        <div className="roh-panel">
          <span className="roh-label">ROLL OF<br />HONOUR</span>
          <div className="roh-grid">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div className="roh-item" key={i}>
                <span className="sk sk--dark roh-sk-season" />
                <span className="sk sk--dark roh-sk-bar" />
                <span className="sk sk--dark roh-sk-name" />
              </div>
            ))}
          </div>
        </div>
      ) : champions.length > 0 && (
        <div className="roh-panel">
          <span className="roh-label">ROLL OF<br />HONOUR</span>
          <div className="roh-grid">
            {champions.map((c) => (
              <Link key={c.season_id} to={`/drivers/${c.driver.id}`} className="roh-item">
                <span className="roh-season">S{c.season_id}</span>
                <span className="roh-bar" style={{ background: c.team.color || "#9b988d" }} />
                <span className="roh-name">{initialLast(`${c.driver.first_name} ${c.driver.last_name}`)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Latest Coverage ── */}
      {(articlesLoading || articles.length > 0) && (
        <section className="coverage-section">
          <div className="coverage-header">
            <span className="coverage-label">LATEST COVERAGE</span>
            <Link to="/articles" className="coverage-all">ALL ARTICLES →</Link>
          </div>
          <div className="coverage-grid">
            {articlesLoading ? (
              [0, 1, 2].map((i) => (
                <div key={i} className="coverage-card">
                  <div className="coverage-thumb sk-sweep" />
                  <div className="coverage-body">
                    <span className="sk coverage-sk-round" />
                    <span className="sk coverage-sk-title" />
                    <span className="sk coverage-sk-title coverage-sk-title--short" />
                    <span className="sk coverage-sk-date" />
                  </div>
                </div>
              ))
            ) : (
              articles.map((a) => {
                const img = a.race?.track.img
                  ? articleTrackImage(a.race.track.img, a.type, a.id)
                  : null;
                return (
                  <Link key={a.id} to={`/articles/${a.id}`} className="coverage-card">
                    <div className="coverage-thumb">
                      {img && <img loading="lazy" src={img} alt="" />}
                      <span className={`coverage-tag ${articleTagClass(a.type)}`}>{articleTypeLabel(a.type).toUpperCase()}</span>
                    </div>
                    <div className="coverage-body">
                      <div className="coverage-round">
                        {a.race ? `R${a.race.round} · ${a.race.track.name.toUpperCase()}` : (a.season_id ? `SEASON ${a.season_id}` : "")}
                      </div>
                      <div className="coverage-title">{a.title}</div>
                      <div className="coverage-date">{formatArticleDate(a.generated_at)}</div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </section>
      )}

      <NewsletterSignup />

    </div>
    </div>
  );
};
