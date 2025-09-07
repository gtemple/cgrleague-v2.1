import { useEffect, useMemo, useState } from "react";

export type StandingRow = {
  driver_season_id: number;
  points: number;
  driver: { id: number; first_name: string; last_name: string; display_name: string };
  team: { id: number; name: string };
};

type State = {
  data: StandingRow[] | null;
  isLoading: boolean;
  error: Error | null;
};

export function useSeasonStandings(seasonId: number) {
  const [state, setState] = useState<State>({ data: null, isLoading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ data: null, isLoading: true, error: null });

    fetch(`/api/seasons/${seasonId}/standings/`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: StandingRow[]) => {
        if (!cancelled) setState({ data: json, isLoading: false, error: null });
      })
      .catch((err: Error) => {
        if (!cancelled) setState({ data: null, isLoading: false, error: err });
      });

    return () => {
      cancelled = true;
    };
  }, [seasonId]);

  const sorted = useMemo(() => {
    if (!state.data) return null;
    return [...state.data].sort((a, b) => b.points - a.points);
  }, [state.data]);

  return {
    data: sorted,
    isLoading: state.isLoading,
    error: state.error,
    refetch: () => {
      // simple refetch: change state to trigger effect
      setState((s) => ({ ...s, isLoading: true }));
    },
  };
}
