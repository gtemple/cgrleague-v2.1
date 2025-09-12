// src/hooks/useDriverDetail.ts
import { useApiQuery } from "./useApiQuery";

export type DriverDetail = {
  driver: {
    id: number;
    first_name: string;
    last_name: string;
    display_name: string;
    profile_image: string | null;
  };
  totals: {
    points: number;
    points_breakdown: { base: number; fastest_lap_bonus: number };
    laps: number;
    wins: number;
    podiums: number;
    dnfs: number;
    fastest_laps: number;
    poles: number;
    dotds: number;
    cleanest_awards: number;
    most_overtakes_awards: number;
    races_completed: number;
    races: number;
    avg_finish: number | null;
  };
};

export function useDriverDetail(driverId?: string) {
  return useApiQuery<DriverDetail>(
    driverId ? `/api/drivers/${driverId}/` : "",
    { enabled: !!driverId }
  );
}
