import { useApiQuery } from "./useApiQuery";

export interface ArticleRace {
  id: number;
  round: number;
  is_sprint: boolean;
  season_id: number;
  track: { id: number; name: string; img: string | null; country: string | null };
}

export interface ArticleSummary {
  id: number;
  type: "RECAP" | "PREVIEW" | "SEASON_RECAP" | "SEASON_PREVIEW";
  title: string;
  teaser: string;
  generated_at: string;
  race: ArticleRace | null;
  season_id: number | null;
  reading_time_minutes: number;
}

export interface PreviewSidebarH2H {
  driver_a: string;
  driver_b: string;
  context: string;
}

export interface PreviewSidebarDriver {
  name: string;
  reason: string;
  stat: string;
}

export interface PreviewSidebar {
  head_to_head: PreviewSidebarH2H;
  drivers_to_watch: PreviewSidebarDriver[];
}

export interface ArticleDetail extends ArticleSummary {
  content: string;
  rivalry_callout: string;
  preview_sidebar: PreviewSidebar | null;
  human_driver_names: string[];
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
