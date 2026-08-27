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
  has_sprint: boolean;
  has_feature: boolean;
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

export type PreRaceStanding = {
  position: number;
  driver: DriverLite & { is_human: boolean };
  team: TeamLite;
  points: number;
  avg_finish: number | null;
  form: (number | null | "DNF")[];
};

export type CircuitSpecialist = {
  driver: DriverLite & { is_human: boolean };
  races: number;
  wins: number;
  podiums: number;
  points: number;
  avg_finish: number | null;
};

export type PreRaceContext = {
  completed_races: number;
  standings: PreRaceStanding[];
  circuit_specialists: CircuitSpecialist[];
};

export type RaceDetailResponse = {
  race: RaceDetail;
  results: RaceDetailResult[];
  standings_impact: StandingsImpactRow[];
  track_history: TrackHistoryRow[];
  pre_race: PreRaceContext | null;
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
