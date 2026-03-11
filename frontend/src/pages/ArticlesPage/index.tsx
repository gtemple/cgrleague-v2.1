import { Link } from "react-router-dom";
import { useArticleList } from "../../hooks/useArticles";
import { formatArticleDate, articleTypeLabel } from "../../utils/articleUtils";
import { displayImage } from "../../utils/displayImage";
import "./style.css";

export function ArticlesPage() {
  const { data: articles, isLoading } = useArticleList();

  return (
    <div className="articles-page">
      <h2 className="articles-heading">Articles</h2>

      {isLoading ? (
        <div className="articles-list">
          {[0, 1, 2].map((i) => (
            <div key={i} className="article-card article-card--skeleton">
              <div className="skeleton-line skeleton-line--short" />
              <div className="skeleton-line skeleton-line--title" />
              <div className="skeleton-line" />
              <div className="skeleton-line skeleton-line--short" />
            </div>
          ))}
        </div>
      ) : !articles || articles.length === 0 ? (
        <p className="articles-empty">No articles yet. Check back after the next race.</p>
      ) : (
        <div className="articles-list">
          {articles.map((article) => {
            const trackImg = article.race.track.img
              ? displayImage(article.race.track.img, "trackImage")
              : null;
            const flagImg = article.race.track.country
              ? displayImage(article.race.track.country, "flags")
              : null;
            return (
              <Link key={article.id} to={`/articles/${article.id}`} className="article-card">
                {trackImg && (
                  <div className="article-card-img">
                    <img src={trackImg} alt={article.race.track.name} />
                  </div>
                )}
                <div className="article-card-body">
                  <div className="article-card-top">
                    <span className={`article-badge article-badge--${article.type.toLowerCase()}`}>
                      {articleTypeLabel(article.type)}
                    </span>
                    <span className="article-race-meta">
                      S{article.race.season_id} · R{article.race.round}
                      {article.race.is_sprint && <span className="article-sprint-tag">Sprint</span>}
                    </span>
                  </div>
                  <div className="article-track-name">
                    {flagImg && <img className="article-flag" src={flagImg} alt={article.race.track.country ?? ""} />}
                    {article.race.track.name}
                  </div>
                  <h3 className="article-title">{article.title}</h3>
                  <p className="article-teaser">{article.teaser}</p>
                  <div className="article-card-footer">
                    <span className="article-date">{formatArticleDate(article.generated_at)}</span>
                    <span className="article-read-more">Read →</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
