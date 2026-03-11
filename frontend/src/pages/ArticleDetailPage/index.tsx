import { useParams, Link } from "react-router-dom";
import { useArticleDetail } from "../../hooks/useArticles";
import { formatArticleDateLong, articleTypeLabel } from "../../utils/articleUtils";
import "./style.css";

export function ArticleDetailPage() {
  const { articleId } = useParams<{ articleId: string }>();
  const { data: article, isLoading, error } = useArticleDetail(articleId!);

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

  return (
    <div className="article-detail-page">
      <Link to="/articles" className="article-back">← Articles</Link>

      <header className="article-detail-header">
        <div className="article-detail-top">
          <span className={`article-badge article-badge--${article.type.toLowerCase()}`}>
            {articleTypeLabel(article.type)}
          </span>
          <span className="article-detail-race-meta">
            Season {article.race.season_id} · Round {article.race.round}
            {article.race.is_sprint && <span className="article-sprint-tag">Sprint</span>}
          </span>
        </div>
        <div className="article-detail-track">{article.race.track.name}</div>
        <h1 className="article-detail-title">{article.title}</h1>
        <div className="article-detail-date">{formatArticleDateLong(article.generated_at)}</div>
      </header>

      <div className="article-detail-content">
        {article.content.split("\n\n").map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>
    </div>
  );
}
