import { useApiQuery } from "./useApiQuery";
import { useMemo } from "react";

export type ResultsMatrixRow = {
  driver_info: {
    first_name: string;
    last_name: string;
    team_name: string;
    profile_image: string | null;
    initials: string;
  };
  finish_positions: (number | null)[];
  grid_positions: (number | null)[];
  statuses: (string | null)[];
  fastest_lap: boolean[];
  pole_positions: boolean[];
  dotds: boolean[];
  total_points: number;              // NEW
  avg_finish_position: number | null; // NEW
};

export type ResultsMatrixResponse = {
  season_id: number;
  races: {
    id: number;
    round: number;
    is_sprint: boolean;
    track: {
      id: number;
      name: string;
      city: string;
      country: string;
    };
  }[];
  results: ResultsMatrixRow[]; 
  points_leaderboard: number[];    
};

export function useSeasonResultsMatrix(
  seasonId: number,
  opts?: { includeSprints?: boolean }
) {
  const { includeSprints = false } = opts || {};
  const params = useMemo(
    () => ({ include_sprints: includeSprints ? 1 : 0 }),
    [includeSprints]
  );

  return useApiQuery<ResultsMatrixResponse>(
    `/api/seasons/${seasonId}/results-matrix/`,
    { params, enabled: !!seasonId }
  );
}