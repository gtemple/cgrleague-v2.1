import { useApiQuery } from "./useApiQuery";

export interface TrackEntry {
  id: number;
  name: string;
  city: string;
  country: string;
  image: string | null;
  races_count: number;
  total_laps: number;
}

export interface TrackRecord {
  track: TrackEntry;
  value: number;
}

export interface TracksHomepageData {
  all_tracks: TrackEntry[];
  records: {
    most_races: TrackRecord | null;
    most_laps: TrackRecord | null;
  };
}

export function useTracksHomepage() {
  return useApiQuery<TracksHomepageData>("/api/tracks/homepage/");
}
