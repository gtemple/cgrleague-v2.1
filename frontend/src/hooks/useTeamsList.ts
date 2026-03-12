import { useApiQuery } from "./useApiQuery";

export type TeamListItem = {
  id: number;
  team_name: string;
};

export function useTeamsList() {
  return useApiQuery<{ teams: TeamListItem[] }>("/api/teams/");
}
