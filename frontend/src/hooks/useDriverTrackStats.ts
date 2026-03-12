import { useApiQuery } from "./useApiQuery";

export type DriverTrackRow = {
  track: {
    id: number;
    name: string;
    city: string;
    country: string;
    image: string | null;
  };
  total_points: number;
  wins: number;
  podiums: number;
  fastest_laps: number;
  avg_finish_position: number | null;
  races_count: number;
};

export function useDriverTrackStats(driverId?: string | number) {
  return useApiQuery<DriverTrackRow[]>(
    driverId ? `/api/drivers/${driverId}/tracks/` : "",
    { enabled: !!driverId }
  );
}
