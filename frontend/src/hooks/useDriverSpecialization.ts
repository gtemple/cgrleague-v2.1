import { useApiQuery } from "./useApiQuery";

export type CategoryStats = {
  category: string;
  label: string;
  races: number;
  points: number;
  wins: number;
  podiums: number;
  fastest_laps: number;
  poles: number;
  dnfs: number;
  avg_finish: number | null;
  ppr: number | null;
  win_rate: number | null;
  podium_rate: number | null;
};

export type DriverSpecialization = {
  categories: CategoryStats[];
  best_category: string | null;
  specialist_label: string | null;
};

export function useDriverSpecialization(driverId?: string | number) {
  return useApiQuery<DriverSpecialization>(
    driverId ? `/api/drivers/${driverId}/specialization/` : "",
    { enabled: !!driverId }
  );
}
