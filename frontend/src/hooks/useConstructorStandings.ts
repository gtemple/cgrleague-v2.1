import { useApiQuery } from "./useApiQuery";

export type ConstructorRow = {
  team_season_id: number;
  team: { id: number; name: string, display_name: string; logo_image: string | null };
  points: number;
};

export function useConstructorStandings(seasonId: number | string) {
  const { data, isLoading, error, refetch } = useApiQuery<ConstructorRow[]>(
    `/api/seasons/${seasonId}/constructors/`,
    { enabled: !!seasonId }
  );

  return { data, isLoading, error, refetch };
}