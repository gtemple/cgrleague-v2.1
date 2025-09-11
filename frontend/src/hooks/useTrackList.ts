import { useMemo } from "react";
import { useApiQuery } from "./useApiQuery";

export type TrackListItem = {
  id: number;
  name: string;
  city?: string | null;
  country?: string | null;
};

export function useTracksList() {
  // Assumes your API returns: [{ id, name, city, country }, ...]
  const { data, isLoading, error, refetch } = useApiQuery<TrackListItem[]>(
    "/api/tracks/",
    { enabled: true }
  );

  const tracks = useMemo(() => {
    const list = Array.isArray(data) ? data.slice() : [];
    list.sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }));
    return list;
  }, [data]);

  return { tracks, isLoading, error, refetch };
}
