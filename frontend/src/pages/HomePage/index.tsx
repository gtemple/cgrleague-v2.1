import { Link } from "react-router-dom";
import { useNextRaceTeaser } from "../../hooks/useNextRaceTeaser";
import { useLatestArticles } from "../../hooks/useArticles";
import { SeasonStandingsTable } from "../../components/SeasonStandingsTable/index";
import { ConstructorStandingsTable } from "../../components/ConstructorStandingsTable/index";
import { displayImage } from "../../utils/displayImage";
import { articleTypeLabel, formatArticleDate } from "../../utils/articleUtils";
import './style.css';

const CURRENT_SEASON = 7;

export const HomePage = () => {
  const { data, isLoading } = useNextRaceTeaser({ includeSprints: true });
  const { data: latestArticles, isLoading: articlesLoading } = useLatestArticles();

  const upcoming = data?.upcoming_race ?? null;
  const recentWinners = data?.recent_winners ?? [];
  const followingTwo = data?.following_two ?? [];

  const track = upcoming?.track ?? null;
  const race = upcoming?.race ?? null;
  const trackImg = track?.image ? displayImage(track.image, "trackImage") : null;
  const flagImg = track?.country ? displayImage(track.country, "flags") : null;

  const articles = [latestArticles?.recap, latestArticles?.preview].filter(Boolean);

  return (
    <div className="home">

      {/* ── Hero ── */}
      <section className="home-hero">
        {trackImg && (
          <img className="hero-bg" src={trackImg} alt="" aria-hidden="true" />
        )}
        <div className="hero-overlay" />

        <div className="hero-content">
          {isLoading ? (
            <div className="hero-skeleton" />
          ) : upcoming ? (
            <>
              <div className="hero-left">
                <div className="hero-eyebrow">
                  Next Race{race?.round != null ? ` · Round ${race.round}` : ""}
                  {race?.is_sprint && <span className="hero-sprint">Sprint</span>}
                </div>
                <h2 className="hero-track">{track?.name}</h2>
                <div className="hero-location">
                  {flagImg && <img className="hero-flag" src={flagImg} alt={track?.country ?? ""} />}
                  {[track?.city, track?.country].filter(Boolean).join(", ")}
                </div>
              </div>

              {recentWinners.length > 0 && (
                <div className="hero-right">
                  <div className="hero-winners-label">Previous Winners</div>
                  {recentWinners.map((w) => {
                    const avatar = w.driver.profile_image
                      ? displayImage(w.driver.profile_image, "driver")
                      : null;
                    return (
                      <div className="hero-winner-row" key={`${w.season_id}-${w.driver.id}`}>
                        <div className="hw-avatar">
                          {avatar
                            ? <img src={avatar} alt={w.driver.display_name} />
                            : <div className="hw-avatar-fallback" />}
                        </div>
                        <div className="hw-info">
                          <div className="hw-name">{w.driver.display_name}</div>
                          <div className="hw-season">Season {w.season_id}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="hero-left">
              <div className="hero-eyebrow">Season {CURRENT_SEASON}</div>
              <h2 className="hero-track">Season Complete</h2>
              <div className="hero-location">No upcoming races</div>
            </div>
          )}
        </div>
      </section>

      {/* ── Latest Coverage ── */}
      {(articlesLoading || articles.length > 0) && (
        <section className="home-articles">
          <div className="home-articles-header">
            <span className="home-articles-label">Latest Coverage</span>
            <Link to="/articles" className="home-articles-see-all">All articles →</Link>
          </div>

          <div className="home-articles-grid">
            {articlesLoading ? (
              [0, 1].map((i) => (
                <div key={i} className="home-article-card home-article-card--skeleton" />
              ))
            ) : (
              articles.map((article) => {
                if (!article) return null;
                const img = article.race?.track.img
                  ? displayImage(article.race.track.img, "trackImage")
                  : null;
                return (
                  <Link key={article.id} to={`/articles/${article.id}`} className="home-article-card">
                    {img && <img className="home-article-bg" src={img} alt="" aria-hidden="true" />}
                    <div className="home-article-overlay" />
                    <div className="home-article-content">
                      <div className="home-article-top">
                        <span className={`article-badge article-badge--${article.type.toLowerCase().replace("_", "-")}`}>
                          {articleTypeLabel(article.type)}
                        </span>
                        {article.race && (
                          <span className="home-article-race">
                            R{article.race.round} · {article.race.track.name}
                          </span>
                        )}
                      </div>
                      <h3 className="home-article-title">{article.title}</h3>
                      <p className="home-article-teaser">{article.teaser}</p>
                      <div className="home-article-footer">
                        <span className="home-article-date">{formatArticleDate(article.generated_at)}</span>
                        <span className="home-article-read">Read article →</span>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* ── Dashboard grid ── */}
      <div className="home-grid">
        <SeasonStandingsTable seasonId={CURRENT_SEASON} />
        <ConstructorStandingsTable seasonId={CURRENT_SEASON} />

        <div className="card up-next-card">
          <div className="card-header">Up Next</div>
          {isLoading ? (
            <div className="card-skeleton-rows">
              {[0, 1].map(i => <div key={i} className="skeleton-row" />)}
            </div>
          ) : followingTwo.length === 0 ? (
            <p className="card-muted">No more races this season.</p>
          ) : (
            <div className="up-next-list">
              {followingTwo.map(({ event, last_winner }) => {
                const t = event.track;
                const thumb = t.image ? displayImage(t.image, "trackImage") : null;
                const flag = t.country ? displayImage(t.country, "flags") : null;
                const winnerAvatar = last_winner?.driver?.profile_image
                  ? displayImage(last_winner.driver.profile_image, "driver")
                  : null;

                return (
                  <div className="up-next-row" key={event.id}>
                    <div className="un-thumb">
                      {thumb
                        ? <img src={thumb} alt={t.name} />
                        : <div className="un-thumb-fallback" />}
                    </div>
                    <div className="un-meta">
                      <div className="un-title">
                        {flag && <img className="un-flag" src={flag} alt={t.country} />}
                        <span>{t.name}</span>
                        {event.is_sprint && <span className="un-sprint">Sprint</span>}
                      </div>
                      <div className="un-sub">Round {event.round}{t.city ? ` · ${t.city}` : ""}</div>
                      {last_winner ? (
                        <div className="un-winner">
                          <div className="un-winner-avatar">
                            {winnerAvatar
                              ? <img src={winnerAvatar} alt={last_winner.driver.display_name} />
                              : <div className="un-avatar-fallback" />}
                          </div>
                          <span className="un-winner-name">{last_winner.driver.display_name}</span>
                        </div>
                      ) : (
                        <div className="un-no-winner">No prior winner</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
