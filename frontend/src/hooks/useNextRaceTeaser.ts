import { useApiQuery } from "./useApiQuery";

export type DriverLite = {
  id: number;
  display_name: string;
  profile_image?: string | null;
};

export type TeamLite = {
  id: number | null;
  name: string;
  logo_image?: string | null;
};

export type TrackLite = {
  id: number | null;
  name: string;
  city?: string;
  country?: string;
  image?: string | null;
};

export type EventLite = {
  id: number;
  round: number;
  is_sprint: boolean;
  track: TrackLite;
  name?: string;
  start_at?: string;
};

export type WinnerLite = {
  driver: DriverLite;
  team: TeamLite;
  race_id: number;
};

// Existing blocks
export type UpcomingRaceBlock = {
  season_id: number;
  race: {
    id: number;
    round: number;
    is_sprint: boolean;
  };
  track: TrackLite;
};

export type RecentWinnerItem = {
  season_id: number;
  driver: DriverLite;
  team: TeamLite;
  race_id: number;
};

// New block (next two items)
export type NextTwoItem = {
  event: EventLite;
  last_winner: WinnerLite | null;
};

// Raw response from API (allow either following_two or next_two)
export type NextRaceTeaserResponseRaw = {
  season_id: number | null;
  upcoming_race: UpcomingRaceBlock | null;
  recent_winners: RecentWinnerItem[];
  following_two?: NextTwoItem[]; // new on backend
  next_two?: NextTwoItem[];      // just in case of legacy name
};

// Normalized response your UI consumes
export type NextRaceTeaserResponse = {
  season_id: number | null;
  upcoming_race: UpcomingRaceBlock | null;
  recent_winners: RecentWinnerItem[];
  following_two: NextTwoItem[]; // always present (possibly empty)
};
export function useNextRaceTeaser(opts?: { includeSprints?: boolean; enabled?: boolean }) {
  const includeSprints = opts?.includeSprints ?? false;
  const enabled = opts?.enabled ?? true;

  return useApiQuery<NextRaceTeaserResponse>(
    "/api/teasers/next-race/",
    {
      params: { include_sprints: includeSprints ? 1 : 0 },
      enabled,
    }
  );
}
