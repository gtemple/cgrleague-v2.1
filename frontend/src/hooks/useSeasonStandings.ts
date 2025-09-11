// src/hooks/useSeasonStandings.ts
import { useApiQuery } from "./useApiQuery.ts";
import { useMemo } from "react";

export type StandingRow = {
  driver_season_id: number;
  points: number;
  driver: { id: number; first_name: string; last_name: string; display_name: string };
  team: { id: number; name: string };
};

export function useSeasonStandings(seasonId: number) {
  const transform = useMemo(
    () => (rows: StandingRow[]) => [...rows].sort((a, b) => b.points - a.points),
    []
  );

  const { data, isLoading, error, refetch } = useApiQuery<StandingRow[]>(
    `/api/seasons/${seasonId}/standings/`,
    {
      enabled: !!seasonId,
      transform,
    }
  );

  return { data, isLoading, error, refetch };
}
