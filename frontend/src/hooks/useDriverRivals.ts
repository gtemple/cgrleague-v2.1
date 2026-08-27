import { useApiQuery } from "./useApiQuery";

export type RivalEntry = {
  driver: {
    id: number;
    first_name: string;
    last_name: string;
    display_name: string;
    profile_image: string | null;
    human: boolean;
  };
  wins: number;
  losses: number;
  races: number;
};

export type DriverRivalsData = {
  driver_id: number;
  rivals: RivalEntry[];
};

export function useDriverRivals(driverId: string | number | undefined) {
  return useApiQuery<DriverRivalsData>(`/api/drivers/${driverId}/rivals/`, {
    enabled: driverId != null && driverId !== "",
  });
}
