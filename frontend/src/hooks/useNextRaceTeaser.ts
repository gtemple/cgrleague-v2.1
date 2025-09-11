import { useApiQuery } from "./useApiQuery";

export type NextRaceTeaserResponse = {
  season_id: number | null;
  upcoming_race: {
    season_id: number;
    race: { id: number; round: number; is_sprint: boolean };
    track: {
      id: number | null;
      name: string;
      city: string;
      country: string;
      image: string | null; // your Track.img
    };
  } | null;
  recent_winners: Array<{
    season_id: number;
    race_id: number;
    driver: {
      id: number;
      first_name: string;
      last_name: string;
      display_name: string;
      profile_image?: string | null;
    };
    team: {
      id: number | null;
      name: string;
      logo_image?: string | null;
    };
  }>;
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
