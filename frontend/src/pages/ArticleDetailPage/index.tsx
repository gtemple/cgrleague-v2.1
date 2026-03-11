import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useArticleDetail } from "../../hooks/useArticles";
import { formatArticleDateLong, articleTypeLabel } from "../../utils/articleUtils";
import { readingTime } from "../../utils/readingTime";
import { displayImage } from "../../utils/displayImage";
import { highlightDrivers } from "../../utils/highlightDrivers";
import "./style.css";

export function ArticleDetailPage() {
  const { articleId } = useParams<{ articleId: string }>();
  const { data: article, isLoading, error } = useArticleDetail(articleId!);

  const trackImg = article?.race?.track.img
    ? displayImage(article.race.track.img, "trackImage")
    : null;

  // OG / page title
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
    );
  }

  if (error || !article) {
    return (
      <div className="article-detail-page">
        <Link to="/articles" className="article-back">← Articles</Link>
        <p className="article-detail-empty">Article not found.</p>
      </div>
    );
  }

  const flagImg = article.race?.track.country
    ? displayImage(article.race.track.country, "flags")
    : null;

  const isSeason = article.type === "SEASON_RECAP" || article.type === "SEASON_PREVIEW";

  return (
    <div className="article-detail-page">
      <Link to="/articles" className="article-back">← Articles</Link>

      {trackImg && (
        <div className="article-detail-hero">
          <img src={trackImg} alt={article.race!.track.name} />
          <div className="article-detail-hero-overlay" />
        </div>
      )}

      <header className="article-detail-header">
        <div className="article-detail-top">
          <span className={`article-badge article-badge--${article.type.toLowerCase().replace("_", "-")}`}>
            {articleTypeLabel(article.type)}
          </span>
          {isSeason ? (
            <span className="article-detail-race-meta">Season {article.season_id}</span>
          ) : article.race && (
            <span className="article-detail-race-meta">
              Season {article.race.season_id} · Round {article.race.round}
              {article.race.is_sprint && <span className="article-sprint-tag">Sprint</span>}
            </span>
          )}
        </div>
        {article.race && (
          <div className="article-detail-track">
            {flagImg && <img className="article-detail-flag" src={flagImg} alt={article.race.track.country ?? ""} />}
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

      <div className="article-detail-content">
        {article.content.split("\n\n").map((para, i) => (
          <p key={i}>{highlightDrivers(para, article.human_driver_names, "driver-highlight")}</p>
        ))}
      </div>
    </div>
  );
}
