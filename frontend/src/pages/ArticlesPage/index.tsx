import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useArticleList } from "../../hooks/useArticles";
import type { ArticleSummary } from "../../hooks/useArticles";
import { useNextRaceTeaser } from "../../hooks/useNextRaceTeaser";
import { useSeasonStandings } from "../../hooks/useSeasonStandings";
import { formatArticleDate, articleTypeLabel } from "../../utils/articleUtils";
import { readingTime } from "../../utils/readingTime";
import { displayImage } from "../../utils/displayImage";
import { StatusTicker } from "../../components/StatusTicker";
import "./style.css";

type Filter = "ALL" | "RACE" | "SEASON" | "RANKINGS";

const RECENT_SEASON_COUNT = 2;

function articleCategory(type: ArticleSummary["type"]): Filter {
  if (type === "RECAP" || type === "PREVIEW") return "RACE";
  if (type === "SEASON_RECAP" || type === "SEASON_PREVIEW") return "SEASON";
  return "RANKINGS";
}

function tagClass(type: ArticleSummary["type"]) {
  switch (type) {
    case "RECAP": return "atag-red";
    case "PREVIEW": return "atag-blue";
    case "POWER_RANKINGS": return "atag-gold";
    case "SEASON_PREVIEW":
    case "SEASON_RECAP": return "atag-purple";
  }
}

function articleMeta(article: ArticleSummary): string {
  if (article.type === "POWER_RANKINGS" && article.race) {
    return `AFTER ROUND ${article.race.round}`;
  }
  if (article.race) {
    return `R${article.race.round} · ${article.race.track.name.toUpperCase()}`;
  }
  return `SEASON ${article.season_id}`;
}

// ─── card ─────────────────────────────────────────────────────────────────────

function ArticleCard({ article }: { article: ArticleSummary }) {
  const img = article.race?.track.img ? displayImage(article.race.track.img, "trackImage") : null;

  return (
    <Link to={`/articles/${article.id}`} className="acard">
      <div className="acard-thumb">
        {img && <img loading="lazy" src={img} alt="" />}
        <span className={`acard-tag ${tagClass(article.type)}`}>{articleTypeLabel(article.type).toUpperCase()}</span>
      </div>
      <div className="acard-body">
        <div className="acard-meta">{articleMeta(article)}</div>
        <div className="acard-title">{article.title}</div>
        <p className="acard-excerpt">{article.teaser}</p>
        <div className="acard-footer">
          <span className="acard-date">{formatArticleDate(article.generated_at)} · {readingTime(article.reading_time_minutes)}</span>
          <span className="acard-cta">READ →</span>
        </div>
      </div>
    </Link>
  );
}

// ─── archive row ────────────────────────────────────────────────────────────

function ArchiveRow({ article }: { article: ArticleSummary }) {
  return (
    <Link to={`/articles/${article.id}`} className="aarchive-row">
      <span className="aarchive-season">S{article.season_id}</span>
      <span className={`aarchive-tag ${tagClass(article.type)}`}>{articleTypeLabel(article.type).toUpperCase()}</span>
      <span className="aarchive-title">{article.title}</span>
      <span className="aarchive-date">{formatArticleDate(article.generated_at)} · {readingTime(article.reading_time_minutes)}</span>
      <span className="aarchive-cta">READ →</span>
    </Link>
  );
}

// ─── grouping ─────────────────────────────────────────────────────────────────

function groupBySeasonDesc(articles: ArticleSummary[]): { seasonId: number; items: ArticleSummary[] }[] {
  const map = new Map<number, ArticleSummary[]>();
  for (const a of articles) {
    const sid = a.season_id ?? 0;
    if (!map.has(sid)) map.set(sid, []);
    map.get(sid)!.push(a);
  }
  return [...map.entries()]
    .sort(([a], [b]) => b - a)
    .map(([seasonId, items]) => ({
      seasonId,
      items: [...items].sort((a, b) => +new Date(b.generated_at) - +new Date(a.generated_at)),
    }));
}

// ─── page ─────────────────────────────────────────────────────────────────────

export function ArticlesPage() {
  const { data: articles, isLoading } = useArticleList();
  const [filter, setFilter] = useState<Filter>("ALL");

  const { data: teaser } = useNextRaceTeaser({ includeSprints: true });
  const seasonId = teaser?.season_id ?? null;
  const { data: driverStandings } = useSeasonStandings(seasonId ?? 0);

  const latestRecap = useMemo(() => {
    const recaps = (articles ?? []).filter((a) => a.type === "RECAP");
    if (recaps.length === 0) return null;
    return [...recaps].sort((a, b) => +new Date(b.generated_at) - +new Date(a.generated_at))[0];
  }, [articles]);

  const visible = useMemo(() =>
    (articles ?? []).filter((a) => filter === "ALL" || articleCategory(a.type) === filter)
  , [articles, filter]);

  const groups = useMemo(() => groupBySeasonDesc(visible), [visible]);
  const recentGroups = groups.slice(0, RECENT_SEASON_COUNT);
  const archiveGroups = groups.slice(RECENT_SEASON_COUNT);
  const archiveArticles = archiveGroups.flatMap((g) => g.items);

  const leader = driverStandings?.[0];
  const runnerUp = driverStandings?.[1];

  return (
    <div className="articles-page">

      {/* ── Header band ── */}
      <div className="art-header-band">
        <div className="art-header-inner">
          <div>
            <div className="art-eyebrow">CGR LEAGUE · COVERAGE</div>
            <h1 className="art-title">Articles</h1>
          </div>
          <div className="art-filter-tabs">
            {(["ALL", "RACE", "SEASON", "RANKINGS"] as Filter[]).map((f) => (
              <button
                key={f}
                className={`art-tab${filter === f ? " art-tab-active" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f === "ALL" ? "All" : f === "RACE" ? "Race" : f === "SEASON" ? "Season" : "Rankings"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Status ticker ── */}
      {seasonId && leader && (
        <StatusTicker
          seasonLabel={`SEASON ${seasonId}`}
          roundCurrent={teaser?.completed_rounds ?? 0}
          roundTotal={teaser?.total_rounds ?? 0}
          leaderName={leader.driver.display_name}
          leaderPoints={leader.points}
          margin={leader.points - (runnerUp?.points ?? 0)}
          right={latestRecap ? (
            <Link to={`/articles/${latestRecap.id}`}>
              LAST RACE <b>{articleMeta(latestRecap)}</b> · <span className="ticker-recap-cta">READ RECAP →</span>
            </Link>
          ) : null}
        />
      )}

      <div className="art-body">
        {isLoading ? (
          <div className="art-skeleton-grid">
            {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="acard acard--skeleton" />)}
          </div>
        ) : visible.length === 0 ? (
          <p className="art-empty">
            {(articles?.length ?? 0) === 0
              ? "No articles yet. Check back after the next race."
              : "No articles match this filter."}
          </p>
        ) : (
          <>
            {recentGroups.map((group) => (
              <div key={group.seasonId} className="art-season-group">
                <div className="art-season-header">
                  <span className="art-season-chip">S{group.seasonId}</span>
                  <span className="art-season-label">Season {group.seasonId}</span>
                  <span className="art-season-count">{group.items.length} ARTICLES</span>
                </div>
                <div className="art-grid">
                  {group.items.map((a) => <ArticleCard key={a.id} article={a} />)}
                </div>
              </div>
            ))}

            {archiveArticles.length > 0 && (
              <div className="art-season-group">
                <div className="art-season-header">
                  <span className="art-season-chip art-season-chip--archive">
                    S{archiveGroups[archiveGroups.length - 1].seasonId}–S{archiveGroups[0].seasonId}
                  </span>
                  <span className="art-season-label">Archive</span>
                  <span className="art-season-count">{archiveArticles.length} ARTICLES</span>
                </div>
                <div className="aarchive-list">
                  {archiveArticles.map((a) => <ArchiveRow key={a.id} article={a} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
