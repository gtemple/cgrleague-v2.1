import { useApiQuery } from "./useApiQuery";

export interface DriverLite {
  id: number;
  first_name: string;
  last_name: string;
  display_name: string;
  profile_image: string | null;
  country_of_representation: string | null;
}

export interface TeamLite {
  id: number | null;
  name: string | null;
  display_name: string | null;
  logo_image: string | null;
  color: string | null;
}

export interface HumanSpotlightEntry {
  driver: DriverLite;
  position: number;
  points: number;
  wins: number;
  team: TeamLite | null;
  last_finish: number | null;
  form: (number | "DNF")[];
  is_reserve: boolean;
}

export interface LeaderEntry {
  driver: DriverLite;
  value: number;
}

export interface AllDriverEntry {
  driver: DriverLite;
  is_human: boolean;
  career_points: number;
  career_wins: number;
  career_races: number;
  specialist_label: string | null;
}

export interface DriversHomepageData {
  latest_season_id: number | null;
  last_race: { round: number; track_name: string } | null;
  human_spotlight: HumanSpotlightEntry[];
  leaders: {
    points: LeaderEntry | null;
    wins: LeaderEntry | null;
    podiums: LeaderEntry | null;
    poles: LeaderEntry | null;
    fastest_laps: LeaderEntry | null;
  };
  all_drivers: AllDriverEntry[];
}

export function useDriversHomepage() {
  return useApiQuery<DriversHomepageData>("/api/drivers/homepage/");
}
