// src/hooks/useSeasonStandings.ts
import { useApiQuery } from "./useApiQuery.ts";

export type StandingRow = {
  driver_season_id: number;
  points: number;
  driver: { id: number; first_name: string; last_name: string; display_name: string };
  team: { id: number; name: string };
};

export function useSeasonStandings(seasonId: number) {
  const { data, isLoading, error, refetch } = useApiQuery<StandingRow[]>(
    `/api/seasons/${seasonId}/standings/`,
    {
      enabled: !!seasonId,
      transform: (rows) => [...rows].sort((a, b) => b.points - a.points),
    }
  );

  return { data, isLoading, error, refetch };
}
