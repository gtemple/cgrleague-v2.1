import { useMemo } from "react";
import { useApiQuery } from "./useApiQuery";
import type { DriverLite, TeamLite } from "./useSeasonLastRace";

export type PredictionFactorKey = "ability" | "form" | "car" | "track" | "category";

export type PredictionFactor = {
  key: PredictionFactorKey;
  label: string;
  score: number;
  weight: number;
  evidence: number;
  impact: number;
  reason: string;
};

export type DriverPrediction = {
  predicted_rank: number;
  driver: DriverLite & { is_human: boolean };
  team: TeamLite;
  expected_finish: number;
  win_probability: number;
  podium_probability: number;
  top_five_probability: number;
  finish_probability: number;
  confidence: "low" | "medium" | "high";
  confidence_score: number;
  factors: PredictionFactor[];
};

export type RacePredictionResponse = {
  model: {
    version: string;
    stage: "pre_weekend";
    simulations: number;
    weights: Record<PredictionFactorKey, number>;
    uses_grid: boolean;
    method: string;
    probability_scale: "0_to_1";
  };
  race: {
    id: number;
    season_id: number;
    round: number;
    is_sprint: boolean;
    track: { id: number; name: string; category: string | null };
  };
  as_of: {
    season_id: number;
    completed_round: number | null;
    future_results_excluded: boolean;
  };
  field_size: number;
  limitations: string[];
  predictions: DriverPrediction[];
};

type Options = {
  isSprint?: boolean;
  enabled?: boolean;
};

export function useRacePrediction(
  seasonId: number | string | undefined,
  round: number | string | undefined,
  options: Options = {},
) {
  const { isSprint = false, enabled = true } = options;
  const params = useMemo(() => ({ is_sprint: isSprint ? 1 : 0 }), [isSprint]);

  return useApiQuery<RacePredictionResponse>(
    `/api/seasons/${seasonId}/races/${round}/prediction/`,
    {
      params,
      enabled: enabled && !!seasonId && !!round,
    },
  );
}
