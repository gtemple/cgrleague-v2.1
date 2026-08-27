import { useApiQuery } from "./useApiQuery";

export type RivalryDriver = {
  id: number;
  first_name: string;
  last_name: string;
  display_name: string;
  profile_image: string | null;
  initials: string;
  country_of_representation: string | null;
  team: { name: string; color: string };
};

export type RivalryTotals = {
  races: number;
  ahead: number;
  points: number;
  wins: number;
  podiums: number;
  poles: number;
  fastest_laps: number;
  dotd: number;
  dnfs: number;
  best_finish: number | null;
  avg_finish: number | null;
  grid_races: number;
  avg_grid: number | null;
  avg_positions_gained: number | null;
  cleanest_driver: number;
  most_overtakes: number;
};

export type RivalryTimelineEntry = {
  race_id: number;
  season_id: number;
  round: number;
  is_sprint: boolean;
  track: string;
  country: string;
  a_finish: number;
  b_finish: number;
  a_points: number;
  b_points: number;
  winner: "a" | "b";
  margin: number;
  cum_a: number;
  cum_b: number;
};

export type RivalrySeason = {
  season_id: number;
  races: number;
  a_ahead: number;
  b_ahead: number;
  a_points: number;
  b_points: number;
};

export type RivalryTrack = {
  track_id: number;
  name: string;
  country: string;
  races: number;
  a_ahead: number;
  b_ahead: number;
};

export type RivalryData = {
  driver_a: RivalryDriver;
  driver_b: RivalryDriver;
  shared_races: number;
  summary: {
    summary: string;
    content: string;
    generated_at: string;
    stale: boolean;
  } | null;
  totals: { a: RivalryTotals; b: RivalryTotals };
  seasons: RivalrySeason[];
  tracks: RivalryTrack[];
  timeline: RivalryTimelineEntry[];
  teammate_seasons: number[];
  streaks: {
    current: { driver: "a" | "b" | null; length: number };
    best_a: number;
    best_b: number;
  };
  closest_races: number;
  biggest_margin: { race_id: number; margin: number } | null;
  tracked: {
    grid: number[];
    cleanest: number[];
    overtakes: number[];
    grid_races: number;
  };
};

export function useRivalry(a: number, b: number, enabled = true) {
  return useApiQuery<RivalryData>(`/api/rivalry/${a}/${b}/`, { enabled });
}
