import { useApiQuery } from "./useApiQuery";
import { useMemo } from "react";

type Options = {
  includeSprints?: boolean;
  enabled?: boolean; // default true
};

export type TrackLite = {
  id: number;
  name: string;
  city: string;
  country: string;
  image: string | null;
};

export type TeamLite = {
  id: number | null;
  name: string;
  logo_image: string | null;
};

export type DriverLite = {
  id: number;
  first_name: string;
  last_name: string;
  display_name: string;
  profile_image: string | null;
  initials: string;
};

// Race wrapper
export type RaceLite = {
  id: number;
  round: number;
  is_sprint: boolean;
  track: TrackLite;
};

// A single classified result (top 3 only in this API)
export type LastRaceResult = {
  finish_position: number;
  status: string; // "FIN" | "DNF" | ...
  fastest_lap: boolean;
  dotd: boolean;
  points: number;
  driver: DriverLite;
  team: TeamLite;
};

// Payloads
export type LastRacePayload = {
  race: RaceLite;
  results: LastRaceResult[]; // top 3
};

export type NextRacePayload = {
  race: RaceLite;
} | null;

export type SeasonLastRaceResponse = {
  season_id: number;
  include_sprints: boolean;
  last_race: LastRacePayload | null;
  next_race: NextRacePayload;
};

export function useSeasonLastRace(seasonId: number, opts: Options = {}) {
  const { includeSprints = false, enabled = true } = opts;

  const transform = useMemo(() => {
    return (data: SeasonLastRaceResponse) => {
      if (data?.last_race?.results) {
        return {
          ...data,
          last_race: {
            ...data.last_race,
            results: [...data.last_race.results].sort(
              (a, b) => a.finish_position - b.finish_position
            ),
          },
        };
      }
      return data;
    };
  }, []); // stable

  return useApiQuery<SeasonLastRaceResponse>(
    `/api/seasons/${seasonId}/last-race/`,
    {
      params: { include_sprints: includeSprints ? 1 : 0 },
      enabled: enabled && !!seasonId,
      transform,
    }
  );
}