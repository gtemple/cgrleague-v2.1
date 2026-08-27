"""Chronologically backtest prediction variance without writing any data."""

from __future__ import annotations

from collections import defaultdict

from django.core.management.base import BaseCommand, CommandError

from results.models import Race, RaceResult
from results.predictions import calculate_race_prediction


DEFAULT_CANDIDATES = "0.30:0.12,0.38:0.16,0.46:0.20,0.54:0.24,0.62:0.28"


def _parse_candidates(raw: str) -> list[tuple[float, float]]:
    candidates = []
    try:
        for pair in raw.split(","):
            base, uncertainty = pair.split(":", 1)
            candidate = (float(base), float(uncertainty))
            if candidate[0] <= 0 or candidate[1] < 0:
                raise ValueError
            candidates.append(candidate)
    except ValueError as exc:
        raise CommandError(
            "Candidates must look like '0.30:0.12,0.40:0.18' with base > 0 and uncertainty >= 0."
        ) from exc
    if not candidates:
        raise CommandError("At least one candidate is required.")
    return candidates


class Command(BaseCommand):
    help = (
        "Read-only rolling backtest for predictor variance. Each race is forecast "
        "using only results from earlier rounds."
    )

    def add_arguments(self, parser):
        parser.add_argument("--simulations", type=int, default=300)
        parser.add_argument("--min-prior-races", type=int, default=3)
        parser.add_argument("--limit", type=int, default=None)
        parser.add_argument("--candidates", default=DEFAULT_CANDIDATES)

    def handle(self, *args, **options):
        simulations = options["simulations"]
        min_prior_races = options["min_prior_races"]
        if simulations < 50:
            raise CommandError("Use at least 50 simulations per race.")

        candidates = _parse_candidates(options["candidates"])
        races = list(
            Race.objects
            .filter(results__isnull=False)
            .select_related("track", "season")
            .distinct()
            .order_by("season_id", "round", "is_sprint")
        )
        if options["limit"]:
            races = races[-options["limit"]:]

        totals = {
            candidate: defaultdict(float, races=0, drivers=0, favourite_wins=0)
            for candidate in candidates
        }
        completed_before = 0
        tested = 0

        for race in races:
            actual_rows = list(
                RaceResult.objects
                .filter(race=race, finish_position__isnull=False)
                .exclude(status__in=("DNS", "DNQ"))
                .select_related("driver_season")
            )
            if completed_before < min_prior_races:
                completed_before += 1
                continue
            actual = {
                row.driver_season.driver_id: row.finish_position
                for row in actual_rows
            }
            if len(actual) < 3:
                completed_before += 1
                continue

            entrant_ids = set(actual)
            tested += 1
            for candidate in candidates:
                base, uncertainty = candidate
                payload = calculate_race_prediction(
                    race,
                    simulations=simulations,
                    noise_base=base,
                    noise_uncertainty=uncertainty,
                    entrant_driver_ids=entrant_ids,
                )
                predictions = payload["predictions"]
                metrics = totals[candidate]
                metrics["races"] += 1
                metrics["drivers"] += len(actual)
                if predictions and actual.get(predictions[0]["driver"]["id"]) == 1:
                    metrics["favourite_wins"] += 1

                for row in predictions:
                    driver_id = row["driver"]["id"]
                    position = actual[driver_id]
                    metrics["winner_brier"] += (
                        row["win_probability"] - int(position == 1)
                    ) ** 2
                    metrics["podium_brier"] += (
                        row["podium_probability"] - int(position <= 3)
                    ) ** 2
                    metrics["finish_error"] += abs(row["expected_finish"] - position)
                    metrics["normalized_finish_error"] += (
                        abs(row["expected_finish"] - position) / len(actual)
                    )
            completed_before += 1

        if not tested:
            raise CommandError("No races met the backtest criteria.")

        results = []
        for candidate, metrics in totals.items():
            drivers = metrics["drivers"]
            races_count = metrics["races"]
            row = {
                "base": candidate[0],
                "uncertainty": candidate[1],
                "winner_brier": metrics["winner_brier"] / drivers,
                "podium_brier": metrics["podium_brier"] / drivers,
                "finish_mae": metrics["finish_error"] / drivers,
                "normalized_finish_mae": metrics["normalized_finish_error"] / drivers,
                "favourite_accuracy": metrics["favourite_wins"] / races_count,
            }
            # A single selection score balances probability calibration with
            # finishing-order usefulness; lower is better.
            row["score"] = (
                row["winner_brier"]
                + row["podium_brier"]
                + row["normalized_finish_mae"]
            )
            results.append(row)
        results.sort(key=lambda row: row["score"])

        self.stdout.write(f"Backtested {tested} races · {simulations} simulations per candidate/race")
        self.stdout.write("BASE   UNCERT  SCORE    WIN-BR   POD-BR   FIN-MAE  FAV-WIN")
        for index, row in enumerate(results):
            marker = "*" if index == 0 else " "
            self.stdout.write(
                f"{marker}{row['base']:<6.2f} {row['uncertainty']:<7.2f} "
                f"{row['score']:<8.4f} {row['winner_brier']:<8.4f} "
                f"{row['podium_brier']:<8.4f} {row['finish_mae']:<8.3f} "
                f"{row['favourite_accuracy'] * 100:>6.1f}%"
            )
        winner = results[0]
        self.stdout.write(self.style.SUCCESS(
            f"Recommended variance: base={winner['base']:.2f}, uncertainty={winner['uncertainty']:.2f}"
        ))
