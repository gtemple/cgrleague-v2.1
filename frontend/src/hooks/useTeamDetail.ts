import { useApiQuery } from "./useApiQuery";

export type TeamDriver = {
  id: number;
  display_name: string;
  profile_image: string | null;
  points: number;
  driver_season_id: number;
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
};

export function useTeamDetail(teamId?: string | number) {
  return useApiQuery<TeamDetail>(
    teamId ? `/api/teams/${teamId}/` : "",
    { enabled: !!teamId }
  );
}
