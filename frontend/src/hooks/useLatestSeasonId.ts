import { useMemo } from "react";
import { useApiQuery } from "./useApiQuery";

interface SeasonListResponse {
  seasons: { id: number; game: string }[];
}

export function useLatestSeasonId(): number | null {
  const { data } = useApiQuery<SeasonListResponse>("/api/seasons/");
  return useMemo(() => {
    if (!data?.seasons?.length) return null;
    return Math.max(...data.seasons.map((s) => s.id));
  }, [data]);
}
