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

export type ArticleType =
  | "RECAP"
  | "PREVIEW"
  | "SEASON_RECAP"
  | "SEASON_PREVIEW"
  | "POWER_RANKINGS"
  | "SESSION";

export interface SessionSummary {
  race_count: number;
  round_span: string;
}

export interface ArticleSummary {
  id: number;
  type: ArticleType;
  title: string;
  teaser: string;
  generated_at: string;
  race: ArticleRace | null;
  season_id: number | null;
  season_game: string | null;
  reading_time_minutes: number;
  biggest_movers: MoverSummary[] | null;
  session_summary: SessionSummary | null;
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

export interface RankingsHistoryRound {
  round: number;
  track_name: string;
  article_id: number;
  is_current: boolean;
}

export interface RankingsHistoryDriver {
  driver_id: number;
  name: string;
  team_color: string;
  is_human: boolean;
  ranks: (number | null)[];
}

export interface RankingsHistory {
  rounds: RankingsHistoryRound[];
  drivers: RankingsHistoryDriver[];
}

export interface SessionRaceEntry {
  race_id: number;
  round: number;
  is_sprint: boolean;
  track_name: string;
  track_country: string | null;
  winner: string | null;
  podium: string[];
  awards: { pole?: string; fastest_lap?: string; dotd?: string };
  beat: string;
}

export interface SessionDriverEntry {
  driver_id: number;
  name: string;
  team: string;
  team_color: string;
  profile_image: string;
  is_human: boolean;
  points: number;
  wins: number;
  podiums: number;
  best_finish: number | null;
  finishes: { race_id: number; position: number | null; status: string }[];
}

export interface SessionSwingEntry {
  name: string;
  team: string;
  is_human: boolean;
  pos: number;
  prev_pos: number | null;
  points: number;
  prev_points: number;
  pos_delta: number | null;
  points_gained: number;
}

export interface SessionData {
  race_count: number;
  round_span: string;
  races: SessionRaceEntry[];
  session_points: SessionDriverEntry[];
  standings_swing: SessionSwingEntry[];
  driver_of_the_session: { name: string; reason: string } | null;
}

export interface ArticleDetail extends ArticleSummary {
  content: string;
  rivalry_callout: string;
  preview_sidebar: PreviewSidebar | null;
  rankings_data: RankingsData | null;
  rankings_history: RankingsHistory | null;
  session_data: SessionData | null;
  session_races: ArticleRace[] | null;
  human_driver_names: string[];
}

export interface LatestArticles {
  recap: ArticleSummary | null;
  preview: ArticleSummary | null;
  rankings: ArticleSummary | null;
  session: ArticleSummary | null;
}

export function useArticleList() {
  return useApiQuery<ArticleSummary[]>("/api/articles/");
}

export function useArticleDetail(id: number | string | undefined, enabled = true) {
  return useApiQuery<ArticleDetail>(id ? `/api/articles/${id}/` : "", {
    enabled: enabled && !!id,
  });
}

export function useLatestArticles() {
  return useApiQuery<LatestArticles>("/api/articles/latest/");
}

export function useRaceArticles(
  seasonId: number | string | undefined,
  round: number | string | undefined,
) {
  return useApiQuery<ArticleSummary[]>("/api/articles/", {
    params: seasonId && round ? { season_id: seasonId, round } : undefined,
    enabled: !!seasonId && !!round,
  });
}
