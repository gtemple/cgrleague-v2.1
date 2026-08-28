import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useArticleList, useLatestArticles } from "../../hooks/useArticles";
import type { ArticleRace, ArticleSummary } from "../../hooks/useArticles";
import { useNextRaceTeaser } from "../../hooks/useNextRaceTeaser";
import { useSeasonStandings } from "../../hooks/useSeasonStandings";
import { formatArticleDate, articleTypeLabel } from "../../utils/articleUtils";
import { readingTime } from "../../utils/readingTime";
import { articleTrackImage } from "../../utils/displayImage";
import { StatusTicker } from "../../components/StatusTicker";
import "./style.css";

type Filter = "ALL" | "RACE" | "SESSION" | "SEASON" | "RANKINGS";

const ARCHIVE_PAGE_SIZE = 25;

const FILTER_LABELS: Record<Filter, string> = {
  ALL: "All",
  RACE: "Race",
  SESSION: "Session",
  SEASON: "Season",
  RANKINGS: "Rankings",
};

function articleCategory(type: ArticleSummary["type"]): Filter {
  if (type === "RECAP" || type === "PREVIEW") return "RACE";
  if (type === "SESSION") return "SESSION";
  if (type === "SEASON_RECAP" || type === "SEASON_PREVIEW") return "SEASON";
  return "RANKINGS";
}

function tagClass(type: ArticleSummary["type"]) {
  switch (type) {
    case "RECAP": return "atag-red";
    case "PREVIEW": return "atag-blue";
    case "POWER_RANKINGS": return "atag-gold";
    case "SESSION": return "atag-green";
    case "SEASON_PREVIEW": return "atag-purple";
    case "SEASON_RECAP": return "atag-magenta";
  }
}

function articleMeta(article: ArticleSummary): string {
  if (article.type === "SESSION" && article.session_summary) {
    const { round_span, race_count } = article.session_summary;
    return `${round_span.toUpperCase()} · ${race_count} RACES`;
  }
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
  const img = article.race?.track.img
    ? articleTrackImage(article.race.track.img, article.type, article.id)
    : null;

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

// Within a season: season preview first, then each round newest→oldest, each
// round grouped newest-first (power rankings → recap → preview), season review last.
const WITHIN_ROUND_RANK: Record<string, number> = { SESSION: 0, POWER_RANKINGS: 1, RECAP: 2, PREVIEW: 3 };

function articleSection(a: ArticleSummary): number {
  if (a.type === "SEASON_PREVIEW") return 0;
  if (a.type === "SEASON_RECAP") return 2;
  return 1; // per-round article
}

function compareArticles(a: ArticleSummary, b: ArticleSummary): number {
  const sa = articleSection(a);
  const sb = articleSection(b);
  if (sa !== sb) return sa - sb;
  if (sa === 1) {
    const ra = a.race?.round ?? 0;
    const rb = b.race?.round ?? 0;
    if (ra !== rb) return rb - ra; // rounds descending (most recent/upcoming first)
    return (WITHIN_ROUND_RANK[a.type] ?? 9) - (WITHIN_ROUND_RANK[b.type] ?? 9);
  }
  return +new Date(a.generated_at) - +new Date(b.generated_at);
}

function compareArchive(a: ArticleSummary, b: ArticleSummary): number {
  const sa = a.season_id ?? 0;
  const sb = b.season_id ?? 0;
  if (sa !== sb) return sb - sa;
  return compareArticles(a, b);
}

/** Newer of two races in calendar order. */
function newerRace(a: ArticleRace, b: ArticleRace): ArticleRace {
  if (a.season_id !== b.season_id) return a.season_id > b.season_id ? a : b;
  return a.round >= b.round ? a : b;
}

// ─── page ─────────────────────────────────────────────────────────────────────

export function ArticlesPage() {
  const { data: articles, isLoading } = useArticleList();
  const [filter, setFilter] = useState<Filter>("ALL");

  const [page, setPage] = useState(0);

  const { data: teaser } = useNextRaceTeaser({ includeSprints: true });
  const { data: latest } = useLatestArticles();
  const seasonId = teaser?.season_id ?? null;
  const { data: driverStandings } = useSeasonStandings(seasonId ?? 0);

  const latestRecap = useMemo(() => {
    const recaps = (articles ?? []).filter((a) => a.type === "RECAP");
    if (recaps.length === 0) return null;
    return [...recaps].sort((a, b) => +new Date(b.generated_at) - +new Date(a.generated_at))[0];
  }, [articles]);

  // The two races either side of now. The upcoming one comes from the teaser;
  // the last one raced comes from /articles/latest/, which is the only place
  // that knows which races actually have results.
  const featuredRaces = useMemo(() => {
    const upcoming = teaser?.upcoming_race
      ? { id: teaser.upcoming_race.race.id, round: teaser.upcoming_race.race.round,
          name: teaser.upcoming_race.track.name }
      : null;
    const completed = [latest?.recap, latest?.rankings, latest?.session]
      .map((a) => a?.race)
      .filter((r): r is ArticleRace => !!r);
    const last = completed.length ? completed.reduce(newerRace) : null;
    return {
      ids: new Set([upcoming?.id, last?.id].filter((id): id is number => id != null)),
      upcoming,
      last: last ? { id: last.id, round: last.round, name: last.track.name } : null,
    };
  }, [teaser, latest]);

  const visible = useMemo(() =>
    (articles ?? []).filter((a) => filter === "ALL" || articleCategory(a.type) === filter)
  , [articles, filter]);

  const featured = useMemo(
    () => visible.filter((a) => a.race && featuredRaces.ids.has(a.race.id)).sort(compareArticles),
    [visible, featuredRaces],
  );

  const archiveArticles = useMemo(
    () => visible.filter((a) => !(a.race && featuredRaces.ids.has(a.race.id))).sort(compareArchive),
    [visible, featuredRaces],
  );

  const pageCount = Math.max(1, Math.ceil(archiveArticles.length / ARCHIVE_PAGE_SIZE));
  // A filter change can leave the reader past the end of the shorter list.
  const currentPage = Math.min(page, pageCount - 1);
  const pageItems = archiveArticles.slice(
    currentPage * ARCHIVE_PAGE_SIZE,
    currentPage * ARCHIVE_PAGE_SIZE + ARCHIVE_PAGE_SIZE,
  );

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
            {(["ALL", "RACE", "SESSION", "SEASON", "RANKINGS"] as Filter[]).map((f) => (
              <button
                key={f}
                className={`art-tab${filter === f ? " art-tab-active" : ""}`}
                onClick={() => { setFilter(f); setPage(0); }}
              >
                {FILTER_LABELS[f]}
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
            {featured.length > 0 && (
              <div className="art-season-group">
                <div className="art-season-header">
                  <span className="art-season-chip">NOW</span>
                  <span className="art-season-label">
                    {[featuredRaces.last && `Last: R${featuredRaces.last.round} ${featuredRaces.last.name}`,
                      featuredRaces.upcoming && `Next: R${featuredRaces.upcoming.round} ${featuredRaces.upcoming.name}`]
                      .filter(Boolean)
                      .join("  ·  ") || "Latest"}
                  </span>
                  <span className="art-season-count">{featured.length} ARTICLES</span>
                </div>
                <div className="art-grid">
                  {featured.map((a) => <ArticleCard key={a.id} article={a} />)}
                </div>
              </div>
            )}

            {archiveArticles.length > 0 && (
              <div className="art-season-group">
                <div className="art-season-header">
                  <span className="art-season-chip art-season-chip--archive">ALL</span>
                  <span className="art-season-label">Archive</span>
                  <span className="art-season-count">{archiveArticles.length} ARTICLES</span>
                </div>
                <div className="aarchive-list">
                  {pageItems.map((a) => <ArchiveRow key={a.id} article={a} />)}
                </div>

                {pageCount > 1 && (
                  <div className="art-pager">
                    <button
                      className="art-pager-btn"
                      onClick={() => setPage(currentPage - 1)}
                      disabled={currentPage === 0}
                    >
                      ← Prev
                    </button>
                    <span className="art-pager-state">
                      Page {currentPage + 1} of {pageCount}
                    </span>
                    <button
                      className="art-pager-btn"
                      onClick={() => setPage(currentPage + 1)}
                      disabled={currentPage >= pageCount - 1}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
