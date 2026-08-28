import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useArticleDetail } from "../../hooks/useArticles";
import type { PreviewSidebar, RankingsData, RankingsEntry } from "../../hooks/useArticles";
import { formatArticleDateLong, articleTypeLabel } from "../../utils/articleUtils";
import { readingTime } from "../../utils/readingTime";
import { displayImage } from "../../utils/displayImage";
import { highlightDrivers } from "../../utils/highlightDrivers";
import { PowerRankingsHistory } from "./PowerRankingsHistory";
import { SessionPanels } from "./SessionPanels";
import "./style.css";
import "./power-rankings.css";

function PreviewSidebarPanel({ sidebar }: { sidebar: PreviewSidebar }) {
  const { head_to_head: h2h, drivers_to_watch: dtw } = sidebar;
  return (
    <aside className="preview-sidebar">
      <div className="preview-sidebar-section">
        <div className="preview-sidebar-label">Head to Head</div>
        <div className="preview-h2h">
          <div className="preview-h2h-names">
            <span className="preview-h2h-name">{h2h.driver_a}</span>
            <span className="preview-h2h-vs">vs</span>
            <span className="preview-h2h-name">{h2h.driver_b}</span>
          </div>
          <p className="preview-h2h-context">{h2h.context}</p>
        </div>
      </div>

      <div className="preview-sidebar-section">
        <div className="preview-sidebar-label">Drivers to Watch</div>
        <div className="preview-dtw-list">
          {dtw.map((driver, i) => (
            <div key={i} className="preview-dtw-card">
              <div className="preview-dtw-name">{driver.name}</div>
              <div className="preview-dtw-stat">{driver.stat}</div>
              <div className="preview-dtw-reason">{driver.reason}</div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

// ─── power rankings components ────────────────────────────────────────────────

function formChipClass(pos: number | null): string {
  if (pos === null) return "pr-form-chip pr-form-chip--dns";
  if (pos === 1) return "pr-form-chip pr-form-chip--p1";
  if (pos === 2) return "pr-form-chip pr-form-chip--p2";
  if (pos === 3) return "pr-form-chip pr-form-chip--p3";
  if (pos <= 10) return "pr-form-chip pr-form-chip--pts";
  return "pr-form-chip";
}

function DriverCard({ entry }: { entry: RankingsEntry }) {
  const delta = entry.prev_rank != null ? entry.prev_rank - entry.rank : null;
  const avatarUrl = entry.profile_image ? displayImage(entry.profile_image, "driver") : null;
  const borderColor = entry.team_color || (entry.is_human ? "rgba(255,199,14,0.5)" : "rgba(255,255,255,0.1)");

  return (
    <div className="pr-card" style={{ borderLeftColor: borderColor }}>
      <div className="pr-rank">
        <span className={`pr-rank-num${entry.rank <= 3 ? " pr-rank-num--top3" : ""}`}>
          {entry.rank}
        </span>
        {delta !== null ? (
          <span className={`pr-delta pr-delta--${delta > 0 ? "up" : delta < 0 ? "down" : "same"}`}>
            {delta > 0 ? `▲${delta}` : delta < 0 ? `▼${Math.abs(delta)}` : "—"}
          </span>
        ) : (
          <span className="pr-delta pr-delta--same">NEW</span>
        )}
      </div>

      <div className="pr-body-wrap">
      <div className="pr-header">
        <div className="pr-name-team">
          <div className="pr-avatar">
            {avatarUrl
              ? <img loading="lazy" src={avatarUrl} alt={entry.name} />
              : <div className="pr-avatar-placeholder" style={{ background: borderColor }} />
            }
          </div>
          <div>
            <div className="pr-name-row">
              <span className="pr-name">{entry.name}</span>
              {entry.is_human && <span className="pr-human-dot" />}
            </div>
            <span className="pr-team" style={entry.team_color ? { color: entry.team_color } : undefined}>
              {entry.team}
            </span>
          </div>
        </div>
        {entry.championship_pos != null && (
          <span className="pr-champ-pos">P{entry.championship_pos} in standings</span>
        )}
      </div>

      <div className="pr-body">
        <div className="pr-form">
          <span className="pr-form-label">Recent</span>
          {entry.recent_finishes.map((pos, i) => (
            <span key={i} className={formChipClass(pos)}>
              {pos != null ? `P${pos}` : "–"}
            </span>
          ))}
        </div>

        {entry.blurb && <p className="pr-blurb">{entry.blurb}</p>}
      </div>
      </div>
    </div>
  );
}

function PowerRankingsLayout({ data }: { data: RankingsData }) {
  return (
    <div className="pr-grid">
      {data.rankings.map((entry) => (
        <DriverCard key={entry.driver_id} entry={entry} />
      ))}
    </div>
  );
}

// ─── article detail page ──────────────────────────────────────────────────────

export function ArticleDetailPage() {
  const { articleId } = useParams<{ articleId: string }>();
  const { data: article, isLoading, error } = useArticleDetail(articleId!);

  const trackImg = article?.race?.track.img
    ? displayImage(article.race.track.img, "trackImage")
    : null;

  useEffect(() => {
    if (!article) return;

    const prev = document.title;
    document.title = `${article.title} — CGR League`;

    const setMeta = (property: string, content: string) => {
      let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("property", property);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMeta("og:title", article.title);
    setMeta("og:description", article.teaser);
    setMeta("og:type", "article");
    if (trackImg) {
      setMeta("og:image", window.location.origin + trackImg);
    }

    return () => {
      document.title = prev;
    };
  }, [article, trackImg]);

  if (isLoading) {
    return (
      <div className="adp-page">
      <div className="article-detail-page">
        <div className="article-detail-skeleton">
          <div className="skeleton-line skeleton-line--short" />
          <div className="skeleton-line skeleton-line--title" />
          <div className="skeleton-line skeleton-line--title" />
          <div className="skeleton-line skeleton-line--short" />
          <div className="skeleton-line" />
          <div className="skeleton-line" />
          <div className="skeleton-line skeleton-line--short" />
        </div>
      </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="adp-page">
      <div className="article-detail-page">
        <Link to="/articles" className="article-back">← Articles</Link>
        <p className="article-detail-empty">Article not found.</p>
      </div>
      </div>
    );
  }

  const flagImg = article.race?.track.country
    ? displayImage(article.race.track.country, "flags")
    : null;

  const isSeason = article.type === "SEASON_RECAP" || article.type === "SEASON_PREVIEW";
  const isRankings = article.type === "POWER_RANKINGS";
  const isSession = article.type === "SESSION";
  const hasSidebar =
    (article.type === "PREVIEW" && article.preview_sidebar != null) ||
    (isSession && article.session_data != null);

  const isNarrow = !isRankings && !hasSidebar;

  return (
    <div className="adp-page">
    <div className={`article-detail-page${isNarrow ? " article-detail-page--narrow" : ""}`}>
      <Link to="/articles" className="article-back">← Articles</Link>

      {trackImg && (
        <div className="article-detail-hero">
          <img loading="lazy" src={trackImg} alt={article.race!.track.name} />
          <div className="article-detail-hero-overlay" />
        </div>
      )}

      <header className="article-detail-header">
        <div className="article-detail-top">
          <span className={`article-badge article-badge--${article.type.toLowerCase().replace(/_/g, "-")}`}>
            {articleTypeLabel(article.type)}
          </span>
          {isSeason ? (
            <span className="article-detail-race-meta">Season {article.season_id}</span>
          ) : isSession && article.session_data ? (
            <>
              <span className="article-detail-race-meta">
                Season {article.season_id} · {article.session_data.round_span} ·{" "}
                {article.session_data.race_count} races
              </span>
              <Link to={`/seasons/${article.season_id}`} className="article-race-link">
                View season →
              </Link>
            </>
          ) : article.race && (
            <>
              <span className="article-detail-race-meta">
                Season {article.race.season_id} · Round {article.race.round}
                {article.race.is_sprint && <span className="article-sprint-tag">Sprint</span>}
              </span>
              <Link
                to={
                  article.type === "PREVIEW"
                    ? `/tracks/${article.race.track.id}`
                    : article.type === "POWER_RANKINGS"
                    ? `/seasons/${article.race.season_id}`
                    : `/seasons/${article.race.season_id}/races/${article.race.round}`
                }
                className="article-race-link"
              >
                {article.type === "PREVIEW" ? "View track →" : article.type === "POWER_RANKINGS" ? "View season →" : "View race results →"}
              </Link>
            </>
          )}
        </div>
        {article.race && !isSession && (
          <div className="article-detail-track">
            {flagImg && <img loading="lazy" className="article-detail-flag" src={flagImg} alt={article.race.track.country ?? ""} />}
            {article.race.track.name}
          </div>
        )}
        <h1 className="article-detail-title">{article.title}</h1>
        <div className="article-detail-byline">
          <span className="article-detail-date">{formatArticleDateLong(article.generated_at)}</span>
          <span className="article-detail-dot">·</span>
          <span className="article-detail-reading-time">{readingTime(article.reading_time_minutes)}</span>
        </div>
      </header>

      {article.rivalry_callout && (
        <aside className="rivalry-callout">
          <div className="rivalry-callout-label">Battle of the Race</div>
          <p className="rivalry-callout-text">{article.rivalry_callout}</p>
        </aside>
      )}

      {isRankings && article.rankings_data ? (
        <>
          {article.rankings_history && (
            <PowerRankingsHistory
              history={article.rankings_history}
              seasonId={article.season_id}
            />
          )}
          <PowerRankingsLayout data={article.rankings_data} />
        </>
      ) : (
        <div className={`article-detail-body${hasSidebar ? " article-detail-body--with-sidebar" : ""}`}>
          <div className={`article-detail-content${isSeason ? " article-detail-content--dropcap" : ""}`}>
            {article.content.split("\n\n").map((para, i) => (
              <p key={i}>{highlightDrivers(para, article.human_driver_names, "driver-highlight")}</p>
            ))}
          </div>

          {isSession && article.session_data ? (
            <SessionPanels data={article.session_data} seasonId={article.season_id} />
          ) : (
            hasSidebar && <PreviewSidebarPanel sidebar={article.preview_sidebar!} />
          )}
        </div>
      )}
    </div>
    </div>
  );
}
