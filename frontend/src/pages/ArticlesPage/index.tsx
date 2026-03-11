import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useArticleList } from "../../hooks/useArticles";
import type { ArticleSummary } from "../../hooks/useArticles";
import { formatArticleDate, articleTypeLabel } from "../../utils/articleUtils";
import { readingTime } from "../../utils/readingTime";
import { displayImage } from "../../utils/displayImage";
import "./style.css";

type Filter = "ALL" | "RACE" | "SEASON" | "RANKINGS";

// ─── card components ──────────────────────────────────────────────────────────

function ArticleFeaturedCard({ article }: { article: ArticleSummary }) {
  const trackImg = article.race?.track.img
    ? displayImage(article.race.track.img, "trackImage")
    : null;
  const flagImg = article.race?.track.country
    ? displayImage(article.race.track.country, "flags")
    : null;
  const isSeason = article.type === "SEASON_RECAP" || article.type === "SEASON_PREVIEW";
  const badgeClass = `article-badge article-badge--${article.type.toLowerCase().replace("_", "-")}`;

  return (
    <Link to={`/articles/${article.id}`} className={`article-card article-card--featured${isSeason ? ` article-card--featured-season article-card--featured-season-${article.type === "SEASON_RECAP" ? "recap" : "preview"}` : ""}`}>
      {trackImg && <img className="article-card-featured-bg" src={trackImg} alt="" aria-hidden="true" />}
      <div className="article-card-featured-overlay" />
      <div className="article-card-featured-content">
        <div className="article-card-top">
          <span className={badgeClass}>{articleTypeLabel(article.type)}</span>
          {isSeason ? (
            <span className="article-race-meta">Season {article.season_id}</span>
          ) : article.race && (
            <span className="article-race-meta">
              S{article.race.season_id} · R{article.race.round}
              {article.race.is_sprint && <span className="article-sprint-tag">Sprint</span>}
            </span>
          )}
        </div>
        {article.race && (
          <div className="article-track-name article-track-name--light">
            {flagImg && <img className="article-flag" src={flagImg} alt={article.race.track.country ?? ""} />}
            {article.race.track.name}
          </div>
        )}
        <h3 className="article-title article-title--featured">{article.title}</h3>
        <p className="article-teaser article-teaser--featured">{article.teaser}</p>
        <div className="article-card-footer">
          <span className="article-date">{formatArticleDate(article.generated_at)}</span>
          <span className="article-reading-time">{readingTime(article.reading_time_minutes)}</span>
          <span className="article-read-more">Read article →</span>
        </div>
      </div>
    </Link>
  );
}

function ArticleSeasonCard({ article }: { article: ArticleSummary }) {
  const badgeClass = `article-badge article-badge--${article.type.toLowerCase().replace("_", "-")}`;
  const variant = article.type === "SEASON_RECAP" ? "recap" : "preview";
  return (
    <Link to={`/articles/${article.id}`} className={`article-card article-card--season-pinned article-card--season-pinned-${variant}`}>
      <div className="season-pinned-banner">
        <span className="season-pinned-num">S{article.season_id}</span>
      </div>
      <div className="article-card-body">
        <div className="article-card-top">
          <span className={badgeClass}>{articleTypeLabel(article.type)}</span>
          <span className="article-race-meta">Season {article.season_id}</span>
        </div>
        <h3 className="article-title">{article.title}</h3>
        <p className="article-teaser">{article.teaser}</p>
        <div className="article-card-footer">
          <span className="article-date">{formatArticleDate(article.generated_at)}</span>
          <span className="article-reading-time">{readingTime(article.reading_time_minutes)}</span>
          <span className="article-read-more">Read →</span>
        </div>
      </div>
    </Link>
  );
}


function PowerRankingsCard({ article }: { article: ArticleSummary }) {
  const movers = article.biggest_movers ?? [];
  return (
    <Link to={`/articles/${article.id}`} className="article-card article-card--rankings">
      <div className="article-card-body">
        <div className="article-card-top">
          <span className="article-badge article-badge--power-rankings">
            {articleTypeLabel(article.type)}
          </span>
          {article.race && (
            <span className="article-race-meta">
              S{article.race.season_id} · R{article.race.round}
              {article.race.is_sprint && <span className="article-sprint-tag">Sprint</span>}
            </span>
          )}
        </div>
        <h3 className="article-title">{article.title}</h3>
        {movers.length > 0 && (
          <div className="rankings-movers">
            <span className="rankings-movers-label">Biggest movers</span>
            {movers.map((m) => (
              <span
                key={m.name}
                className={`rankings-mover-chip rankings-mover-chip--${m.delta > 0 ? "up" : "down"}`}
              >
                {m.delta > 0 ? "▲" : "▼"}{Math.abs(m.delta)} {m.name.split(" ").pop()}
              </span>
            ))}
          </div>
        )}
        <div className="article-card-footer">
          <span className="article-date">{formatArticleDate(article.generated_at)}</span>
          <span className="article-read-more">View rankings →</span>
        </div>
      </div>
    </Link>
  );
}

// ─── grouping logic ───────────────────────────────────────────────────────────

interface RoundGroup {
  round: number;
  raceArticles: ArticleSummary[];
  rankingsArticle: ArticleSummary | null;
}

interface SeasonGroup {
  seasonId: number;
  game: string | null;
  seasonArticles: ArticleSummary[];
  rounds: RoundGroup[];
  totalCount: number;
}

function groupBySeasonDesc(articles: ArticleSummary[]): SeasonGroup[] {
  const seasonMap = new Map<number, ArticleSummary[]>();
  for (const a of articles) {
    const sid = a.season_id ?? 0;
    if (!seasonMap.has(sid)) seasonMap.set(sid, []);
    seasonMap.get(sid)!.push(a);
  }
  return [...seasonMap.entries()]
    .sort(([a], [b]) => b - a)
    .map(([seasonId, items]) => {
      const seasonArticles = items.filter(
        (a) => a.type === "SEASON_RECAP" || a.type === "SEASON_PREVIEW"
      );
      const roundMap = new Map<number, { raceArticles: ArticleSummary[]; rankingsArticle: ArticleSummary | null }>();
      for (const a of items) {
        if (a.type === "SEASON_RECAP" || a.type === "SEASON_PREVIEW") continue;
        const round = a.race?.round ?? 0;
        if (!roundMap.has(round)) roundMap.set(round, { raceArticles: [], rankingsArticle: null });
        const g = roundMap.get(round)!;
        if (a.type === "POWER_RANKINGS") g.rankingsArticle = a;
        else g.raceArticles.push(a);
      }
      const rounds = [...roundMap.entries()]
        .sort(([a], [b]) => b - a)
        .map(([round, g]) => ({ round, ...g }));
      return {
        seasonId,
        game: items.find((a) => a.season_game)?.season_game ?? null,
        seasonArticles,
        rounds,
        totalCount: items.length,
      };
    });
}

// ─── page ─────────────────────────────────────────────────────────────────────

export function ArticlesPage() {
  const { data: articles, isLoading } = useArticleList();
  const [filter, setFilter] = useState<Filter>("ALL");

  const visible = useMemo(() =>
    articles?.filter((a) => {
      if (filter === "ALL") return true;
      if (filter === "RACE") return a.type === "RECAP" || a.type === "PREVIEW";
      if (filter === "SEASON") return a.type === "SEASON_RECAP" || a.type === "SEASON_PREVIEW";
      if (filter === "RANKINGS") return a.type === "POWER_RANKINGS";
      return true;
    }) ?? []
  , [articles, filter]);

  const groups = useMemo(() => groupBySeasonDesc(visible), [visible]);

  return (
    <div className="articles-page">
      <div className="articles-page-header">
        <h2 className="articles-heading">Articles</h2>
        <div className="articles-filters">
          {(["ALL", "RACE", "SEASON", "RANKINGS"] as Filter[]).map((f) => (
            <button
              key={f}
              className={`articles-filter-btn${filter === f ? " articles-filter-btn--active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "ALL" ? "All" : f === "RACE" ? "Race" : f === "SEASON" ? "Season" : "Rankings"}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="articles-skeleton">
          <div className="skeleton-season-header" />
          <div className="articles-grid">
            <div className="article-card article-card--skeleton article-card--skeleton-featured" />
            {[0, 1].map((i) => (
              <div key={i} className="article-card article-card--skeleton">
                <div className="skeleton-img" />
                <div className="article-card-body" style={{ gap: 10 }}>
                  <div className="skeleton-line skeleton-line--short" />
                  <div className="skeleton-line skeleton-line--title" />
                  <div className="skeleton-line" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : visible.length === 0 ? (
        <p className="articles-empty">
          {articles?.length === 0
            ? "No articles yet. Check back after the next race."
            : "No articles match this filter."}
        </p>
      ) : (
        <div className="articles-seasons">
          {groups.map((group) => (
            <div key={group.seasonId} className="articles-season-group">
              <div className="articles-season-header">
                <div className="articles-season-header-left">
                  <span className="articles-season-number">Season {group.seasonId}</span>
                  {group.game && <span className="articles-season-game">{group.game}</span>}
                </div>
                <span className="articles-season-count">
                  {group.totalCount} article{group.totalCount !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Season-level articles pinned at the top */}
              {group.seasonArticles.length > 0 && (
                <div className="articles-grid articles-grid--season-pinned">
                  {group.seasonArticles.map((a) => (
                    <ArticleSeasonCard key={a.id} article={a} />
                  ))}
                </div>
              )}

              {/* Per-round groups: race articles + rankings side by side */}
              {group.rounds.map((roundGroup) => (
                roundGroup.raceArticles.length > 0 && (
                  <div key={roundGroup.round} className="articles-race-row">
                    {roundGroup.raceArticles.map((a) => (
                      <ArticleFeaturedCard key={a.id} article={a} />
                    ))}
                    {roundGroup.rankingsArticle
                      ? <PowerRankingsCard article={roundGroup.rankingsArticle} />
                      : <div className="articles-rankings-placeholder" />
                    }
                  </div>
                )
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
