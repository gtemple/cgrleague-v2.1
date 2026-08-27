import { useApiQuery } from "./useApiQuery";
import type { TrackLite, DriverLite, TeamLite } from "./useSeasonLastRace";

export type RaceDetailResult = {
  finish_position: number | null;
  grid_position: number | null;
  status: string;
  laps_completed: number | null;
  fastest_lap: boolean;
  pole_position: boolean;
  dotd: boolean;
  cleanest_driver: boolean;
  most_overtakes: boolean;
  points: number;
  driver: DriverLite;
  team: TeamLite;
};

export type RaceDetail = {
  id: number;
  round: number;
  is_sprint: boolean;
  laps: number | null;
  started_at: string | null;
  track: TrackLite;
};

export type StandingsImpactRow = {
  driver: DriverLite;
  points_before: number;
  points_after: number;
  gained: number;
  position_before: number | null;
  position_after: number | null;
  move: number;
};

export type TrackHistoryRow = {
  season_id: number;
  round: number;
  driver: DriverLite;
  team: TeamLite;
};

export type RaceDetailResponse = {
  race: RaceDetail;
  results: RaceDetailResult[];
  standings_impact: StandingsImpactRow[];
  track_history: TrackHistoryRow[];
};

export function useRaceDetail(
  seasonId: string | undefined,
  round: string | undefined,
  isSprint = false,
) {
  return useApiQuery<RaceDetailResponse>(
    `/api/seasons/${seasonId}/races/${round}/`,
    {
      params: { is_sprint: isSprint ? 1 : 0 },
      enabled: !!seasonId && !!round,
    }
  );
}
