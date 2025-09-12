// src/hooks/useDriverHistory.ts
import { useApiQuery } from "./useApiQuery";

export type DriverHistoryRow = {
  season: { id: number; name: string | null; year: number | null };
  team: { id: number | null; name: string; display_name: string; logo_image: string | null };
  points: number;
  points_breakdown: { base: number; fastest_lap_bonus: number };
  wins: number;
  podiums: number;
  poles: number;
  fastest_laps: number;
  dotds: number;
  cleanest_awards: number;
  most_overtakes_awards: number;
  dnfs: number;
  laps: number;
  races: number;
  races_completed: number;
  avg_finish: number | null;
  best_finish: number | null;
  team_points: number;
  pop_share: number | null; // 0..100
};

export type DriverHistoryResponse = {
  driver: {
    id: number;
    first_name: string;
    last_name: string;
    display_name: string;
    profile_image: string | null;
  } | null;
  history: DriverHistoryRow[];
};

export function useDriverHistory(driverId?: string) {
  return useApiQuery<DriverHistoryResponse>(
    driverId ? `/api/drivers/${driverId}/history/` : "",
    { enabled: !!driverId }
  );
}
