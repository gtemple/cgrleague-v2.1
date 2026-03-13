import { fetchJson } from "./client";

function authedHeaders(token: string): Record<string, string> {
  return { Authorization: `Token ${token}` };
}

export type GridDriver = {
  driver_season_id: number;
  car_number: number | null;
  is_reserve: boolean;
  driver: { id: number; first_name: string; last_name: string };
  team: { id: number; name: string; color: string };
};

export type RaceInfo = {
  id: number;
  round: number;
  is_sprint: boolean;
  laps: number | null;
  started_at: string | null;
  track: { id: number; name: string; country: string };
};

export type ExistingResult = {
  driver_season_id: number;
  finish_position: number | null;
  grid_position: number | null;
  status: string;
  laps_completed: number | null;
  fastest_lap: boolean;
  pole_position: boolean;
  dotd: boolean;
  cleanest_driver: boolean;
  most_overtakes: boolean;
};

export type RaceDetailResponse = {
  race: RaceInfo;
  results: ExistingResult[];
};

export type ResultRow = {
  driver_season_id: number;
  finish_position: number | null;
  grid_position: number | null;
  status: string;
  laps_completed: number | null;
  fastest_lap: boolean;
  pole_position: boolean;
  dotd: boolean;
  cleanest_driver: boolean;
  most_overtakes: boolean;
};

export const adminApi = {
  async getGrid(token: string, seasonId: number): Promise<GridDriver[]> {
    return fetchJson(`/api/admin/seasons/${seasonId}/grid/`, {
      headers: authedHeaders(token),
    });
  },

  async getRaces(token: string, seasonId: number): Promise<RaceInfo[]> {
    return fetchJson(`/api/admin/seasons/${seasonId}/races/`, {
      headers: authedHeaders(token),
    });
  },

  async getRaceDetail(seasonId: number, round: number, isSprint: boolean): Promise<RaceDetailResponse> {
    return fetchJson(`/api/seasons/${seasonId}/races/${round}/`, {
      params: { is_sprint: isSprint ? "1" : "0" },
    });
  },

  async submitResults(token: string, raceId: number, results: ResultRow[]): Promise<{ created: number }> {
    return fetchJson(`/api/admin/races/${raceId}/results/`, {
      method: "POST",
      headers: authedHeaders(token),
      body: JSON.stringify({ results }),
    });
  },
};
