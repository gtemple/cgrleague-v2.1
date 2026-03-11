import { useApiQuery } from "./useApiQuery";

export interface ArticleRace {
  id: number;
  round: number;
  is_sprint: boolean;
  season_id: number;
  track: { id: number; name: string; img: string | null; country: string | null };
}

export interface MoverSummary {
  name: string;
  rank: number;
  prev_rank: number;
  delta: number;
}

export interface ArticleSummary {
  id: number;
  type: "RECAP" | "PREVIEW" | "SEASON_RECAP" | "SEASON_PREVIEW" | "POWER_RANKINGS";
  title: string;
  teaser: string;
  generated_at: string;
  race: ArticleRace | null;
  season_id: number | null;
  season_game: string | null;
  reading_time_minutes: number;
  biggest_movers: MoverSummary[] | null;
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

export interface RankingsEntry {
  rank: number;
  prev_rank: number | null;
  driver_id: number;
  name: string;
  team: string;
  team_color: string;
  profile_image: string;
  is_human: boolean;
  score: number;
  blurb: string;
  recent_finishes: (number | null)[];
  championship_pos: number | null;
  championship_points: number;
}

export interface RankingsData {
  race_round: number;
  is_sprint: boolean;
  track_name: string;
  rankings: RankingsEntry[];
  biggest_movers: MoverSummary[];
}

export interface ArticleDetail extends ArticleSummary {
  content: string;
  rivalry_callout: string;
  preview_sidebar: PreviewSidebar | null;
  rankings_data: RankingsData | null;
  human_driver_names: string[];
}

export interface LatestArticles {
  recap: ArticleSummary | null;
  preview: ArticleSummary | null;
  rankings: ArticleSummary | null;
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
