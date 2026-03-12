import { useApiQuery } from "./useApiQuery";

export interface TeamLite {
  id: number;
  name: string;
  display_name: string;
  logo_image: string | null;
  color: string;
}

export interface CurrentSeasonTeam extends TeamLite {
  points: number;
  wins: number;
  champ_pos: number;
}

export interface TeamRecord {
  team: TeamLite;
  value: number;
}

export interface AllTeamEntry extends TeamLite {
  career_points: number;
  career_wins: number;
  career_seasons: number;
}

export interface TeamsHomepageData {
  latest_season_id: number | null;
  current_season: CurrentSeasonTeam[];
  records: {
    points: TeamRecord | null;
    wins: TeamRecord | null;
    podiums: TeamRecord | null;
    poles: TeamRecord | null;
  };
  all_teams: AllTeamEntry[];
}

export function useTeamsHomepage() {
  return useApiQuery<TeamsHomepageData>("/api/teams/homepage/");
}
