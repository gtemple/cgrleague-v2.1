import { useApiQuery } from "./useApiQuery";

export interface TimelineRace {
  round: number;
  is_sprint: boolean;
  track_name: string;
  label: string;
  completed: boolean;
}

export interface TimelineDriver {
  id: number;
  name: string;
  team: string;
  is_human: boolean;
  points_by_race: (number | null)[];
  final_points: number;
}

export interface ChampionshipTimelineData {
  races: TimelineRace[];
  drivers: TimelineDriver[];
}

export function useChampionshipTimeline(seasonId: number) {
  return useApiQuery<ChampionshipTimelineData>(`/api/seasons/${seasonId}/timeline/`);
}
