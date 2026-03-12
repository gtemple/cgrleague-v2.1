import { useApiQuery } from "./useApiQuery";

export type HallOfFameDriver = {
  id: number;
  first_name: string;
  last_name: string;
  profile_image: string | null;
  total_wins: number;
  total_podiums: number;
  total_points: number;
  total_fastest_laps: number;
  total_poles: number;
  total_dotd: number;
  total_clean_driver: number;
  total_overtakes: number;
  total_championships: number;
};

export type SeasonBestEntry = {
  driver: {
    id: number;
    first_name: string;
    last_name: string;
    profile_image: string | null;
  };
  season_id: number;
  value: number;
} | null;

export type HallOfFameData = {
  drivers: HallOfFameDriver[];
  season_bests: {
    most_wins: SeasonBestEntry;
    most_points: SeasonBestEntry;
    most_poles: SeasonBestEntry;
  };
};

function normalize(raw: unknown): HallOfFameData {
  // Old backend returned a flat array; new backend returns { drivers, season_bests }
  if (Array.isArray(raw)) {
    return {
      drivers: raw as HallOfFameDriver[],
      season_bests: { most_wins: null, most_points: null, most_poles: null },
    };
  }
  return raw as HallOfFameData;
}

export function useHallOfFame(includeAI: boolean) {
  return useApiQuery<HallOfFameData>(
    `/api/hall-of-fame/`,
    { params: { include_ai: includeAI }, transform: normalize }
  );
}
