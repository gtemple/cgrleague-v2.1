import { useOutletContext } from "react-router-dom";
import type { SeasonInfo } from "../../api/admin";

export type AdminContextValue = {
  token: string;
  seasonId: number | null;
  seasons: SeasonInfo[];
  season: SeasonInfo | null;
  setSeasonId: (seasonId: number) => void;
};

export function useAdmin() {
  const context = useOutletContext<AdminContextValue | null>();
  if (!context) throw new Error("useAdmin must be used inside AdminLayout");
  return context;
}
