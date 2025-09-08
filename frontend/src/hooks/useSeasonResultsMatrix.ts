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
  finish_points: (number | null)[]; // ← NEW
  total_points: number;
  avg_finish_position: number | null;
};

export type ResultsMatrixResponse = {
  season_id: number;
  races: {
    id: number;
    round: number;
    is_sprint: boolean;
    track: { id: number; name: string; city: string; country: string };
  }[];
  results: ResultsMatrixRow[];
  points_leaderboard: number[];
  constructor_results: { team_name: string; team_image: string | null; points: number }[]; // NEW
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