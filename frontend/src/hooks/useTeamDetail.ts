import { useApiQuery } from "./useApiQuery";

export type TeamDriver = {
  id: number;
  display_name: string;
  profile_image: string | null;
  points: number;
  driver_season_id: number;
  country_of_representation: string | null;
};

export type TeamSeasonRow = {
  season: { id: number };
  display_name: string;
  color: string;
  points: number;
  wins: number;
  podiums: number;
  poles: number;
  fastest_laps: number;
  races: number;
  champ_pos: number;
  drivers: TeamDriver[];
};

export type TeamDetail = {
  team: {
    id: number;
    name: string;
    country: string;
    founded: number | null;
    logo_image: string | null;
  };
  career: {
    points: number;
    wins: number;
    podiums: number;
    poles: number;
    fastest_laps: number;
    dotds: number;
    races: number;
    seasons: number;
    drivers: number;
  };
  seasons: TeamSeasonRow[];
  best_driver: (TeamDriver & { team_points: number; team_wins: number }) | null;
  best_season: {
    season_id: number;
    champ_pos: number;
    points: number;
    display_name: string;
  } | null;
};

export function useTeamDetail(teamId?: string | number) {
  return useApiQuery<TeamDetail>(
    teamId ? `/api/teams/${teamId}/` : "",
    { enabled: !!teamId }
  );
}
