import { useMemo } from "react";
import { useApiQuery } from "./useApiQuery";

export type DriverLite = {
  id: number;
  first_name: string;
  last_name: string;
  display_name: string;
  profile_image: string | null;
  initials: string;
};

export type TrackLite = {
  id: number;
  name: string;
  city: string;
  country: string;
  image: string | null;
};

export type TrackDriverRow = {
  driver: DriverLite;
  total_points: number;
  total_laps: number;
  wins: number;
  podiums: number;
  dnfs: number;
  dotds: number;
  fastest_laps: number;
  avg_finish_position: number | null;
  races_count: number;
};

export type TrackStatsResponse = {
  track: TrackLite | null;
  include_sprints: boolean;
  order: { by: string; direction: "asc" | "desc" };
  drivers: TrackDriverRow[];
};

export type OrderBy =
  | "points"
  | "laps"
  | "wins"
  | "podiums"
  | "dnfs"
  | "dotds"
  | "fastest_laps"
  | "avg_finish"
  | "driver";

type Options = {
  includeSprints?: boolean;
  orderBy?: OrderBy;
  direction?: "asc" | "desc";
  enabled?: boolean;
};

export function useTrackStats(
  trackId: number | string | undefined,
  opts: Options = {}
) {
  const {
    includeSprints = false,
    orderBy = "points",
    direction = "desc",
    enabled = true,
  } = opts;

  const params = useMemo(
    () => ({
      include_sprints: includeSprints ? 1 : 0,
      order_by: orderBy,
      direction,
    }),
    [includeSprints, orderBy, direction]
  );

  const { data, isLoading, error, refetch } = useApiQuery<TrackStatsResponse>(
    trackId ? `/api/tracks/${trackId}/stats/` : "",
    {
      enabled: enabled && !!trackId,
      params,
    }
  );

  return { data, isLoading, error, refetch };
}
