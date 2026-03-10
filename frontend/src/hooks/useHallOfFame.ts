import { useApiQuery } from "./useApiQuery";

export type HallOfFameDriver = {
  id: number;
  first_name: string;
  last_name: string;
  driver_img: string | null;
  total_wins: number;
  total_podiums: number;
  total_points: number;
  total_fastest_laps: number;
  total_dotd: number;
  total_clean_driver: number;
  total_overtakes: number;
  total_championships: number;
};

export function useHallOfFame(includeAI: boolean) {
  return useApiQuery<HallOfFameDriver[]>(
    `/api/hall-of-fame/`,
    { params: { include_ai: includeAI } }
  );
}
