// src/hooks/useDriversList.ts
import { useMemo } from "react";
import { useApiQuery } from "./useApiQuery";

export type DriverListItem = {
  id: number;
  first_name: string;
  last_name: string;
  display_name: string;
  profile_image: string | null;
};

export function useDriversList(q = "") {
  const transform = useMemo(
    () => (rows: DriverListItem[]) =>
      [...rows].sort((a, b) => {
        const la = (a.last_name || "").toLowerCase();
        const lb = (b.last_name || "").toLowerCase();
        if (la !== lb) return la.localeCompare(lb);
        return (a.first_name || "").toLowerCase()
          .localeCompare((b.first_name || "").toLowerCase());
      }),
    []
  );

  return useApiQuery<DriverListItem[]>(
    `/api/drivers/`,
    {
      params: q ? { q } : undefined,
      transform,
      keepPreviousData: true, // <-- don’t clear options while loading
    }
  );
}
