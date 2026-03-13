import { useApiQuery } from "./useApiQuery";

export type HistoryResult = {
  finish_position: number;
  fastest_lap: boolean;
  pole_position: boolean;
  points: number;
  driver: {
    id: number;
    display_name: string;
    profile_image: string | null;
    country_of_representation: string | null;
  };
  team: {
    id: number | null;
    name: string;
    logo_image: string | null;
  };
};

export type HistoryTeaser = {
  season_id: number;
  race: {
    id: number;
    round: number;
    track: {
      id: number;
      name: string;
      city: string;
      country: string;
      image: string | null;
    };
  };
  results: HistoryResult[];
  blurb: string | null;
  quote: string | null;
};

export function useHistoryTeaser() {
  return useApiQuery<HistoryTeaser | null>("/api/teasers/history/");
}
