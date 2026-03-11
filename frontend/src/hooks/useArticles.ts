import { useApiQuery } from "./useApiQuery";

export interface ArticleRace {
  id: number;
  round: number;
  is_sprint: boolean;
  season_id: number;
  track: { id: number; name: string };
}

export interface ArticleSummary {
  id: number;
  type: "RECAP" | "PREVIEW";
  title: string;
  teaser: string;
  generated_at: string;
  race: ArticleRace;
}

export interface ArticleDetail extends ArticleSummary {
  content: string;
}

export interface LatestArticles {
  recap: ArticleSummary | null;
  preview: ArticleSummary | null;
}

export function useArticleList() {
  return useApiQuery<ArticleSummary[]>("/api/articles/");
}

export function useArticleDetail(id: number | string) {
  return useApiQuery<ArticleDetail>(`/api/articles/${id}/`);
}

export function useLatestArticles() {
  return useApiQuery<LatestArticles>("/api/articles/latest/");
}
