"""Pre-race probability model for CGR League.

The model deliberately uses only results that happened before the target race.
It is small-data friendly: career ability is learned from pairwise finishes,
while sparse track, category and teammate evidence is shrunk toward neutral.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
import random
from typing import Iterable

from django.db.models import Q

from entries.models import DriverSeason
from results.models import Race, RaceResult
from results.api.views.utils import serialize_driver, serialize_team


MODEL_VERSION = "cgr-predictor-v2"
SIMULATIONS = 5000
# Selected by a rolling 105-race backtest (see backtest_predictions). The v1
# values, 0.62/0.28, were over-dispersed and produced a 3.10-position MAE;
# this pair improved both the combined calibration score and favourite hit rate.
NOISE_BASE = 0.40
NOISE_UNCERTAINTY = 0.16

WEIGHTS = {
    "ability": 0.35,
    "form": 0.25,
    "car": 0.20,
    "track": 0.15,
    "category": 0.05,
}


@dataclass(frozen=True)
class Outcome:
    driver_id: int
    position: int | None
    status: str
    field_size: int
    season_id: int
    round: int
    is_sprint: bool
    track_id: int
    track_category: str
    team_season_id: int

    @property
    def performance(self) -> float:
        """0=last, 1=winner, with unclassified entries at the bottom."""
        if self.position is None or self.field_size <= 1:
            return 0.0
        return max(0.0, min(1.0, (self.field_size - self.position) / (self.field_size - 1)))


def _before_race_q(race: Race, prefix: str = "race__") -> Q:
    """Chronological cutoff used everywhere to prevent future-data leakage."""
    return (
        Q(**{f"{prefix}season_id__lt": race.season_id})
        | Q(**{
            f"{prefix}season_id": race.season_id,
            f"{prefix}round__lt": race.round,
        })
    )


def _load_outcomes(race: Race) -> list[Outcome]:
    rows = list(
        RaceResult.objects
        .filter(_before_race_q(race))
        .exclude(status__in=("DNS", "DNQ"))
        .select_related("race__track", "driver_season")
        .order_by("race__season_id", "race__round", "race__is_sprint", "id")
    )
    field_sizes = defaultdict(int)
    for row in rows:
        field_sizes[row.race_id] += 1
    return [
        Outcome(
            driver_id=row.driver_season.driver_id,
            position=row.finish_position,
            status=row.status,
            field_size=field_sizes[row.race_id],
            season_id=row.race.season_id,
            round=row.race.round,
            is_sprint=row.race.is_sprint,
            track_id=row.race.track_id,
            track_category=row.race.track.category or "",
            team_season_id=row.driver_season.team_season_id,
        )
        for row in rows
    ]


def _ability_ratings(
    outcomes: Iterable[Outcome], target_season_id: int
) -> tuple[dict[int, float], dict[int, int]]:
    """Pairwise Elo, updated once per race to avoid within-race ordering bias."""
    ratings: dict[int, float] = defaultdict(lambda: 1500.0)
    starts: dict[int, int] = defaultdict(int)
    grouped: dict[tuple[int, int, bool], list[Outcome]] = defaultdict(list)
    for outcome in outcomes:
        grouped[(outcome.season_id, outcome.round, outcome.is_sprint)].append(outcome)

    active_season = None
    for (season_id, _round, _sprint), field in sorted(grouped.items()):
        if active_season is not None and season_id != active_season:
            # Old seasons remain useful, but changing games/cars should pull
            # everybody modestly back toward the league mean.
            ratings = defaultdict(
                lambda: 1500.0,
                {driver_id: 1500.0 + (rating - 1500.0) * 0.88 for driver_id, rating in ratings.items()},
            )
        active_season = season_id

        classified = [row for row in field if row.position is not None]
        deltas: dict[int, float] = defaultdict(float)
        comparisons: dict[int, int] = defaultdict(int)
        for index, left in enumerate(classified):
            for right in classified[index + 1:]:
                if left.position == right.position:
                    actual_left = 0.5
                else:
                    actual_left = 1.0 if left.position < right.position else 0.0
                expected_left = 1.0 / (1.0 + 10 ** ((ratings[right.driver_id] - ratings[left.driver_id]) / 400.0))
                change = 28.0 * (actual_left - expected_left)
                deltas[left.driver_id] += change
                deltas[right.driver_id] -= change
                comparisons[left.driver_id] += 1
                comparisons[right.driver_id] += 1

        for driver_id, delta in deltas.items():
            ratings[driver_id] += delta / max(1, comparisons[driver_id])
        for row in field:
            starts[row.driver_id] += 1

    # If the target is a season opener, there was no current-season result in
    # the loop to trigger regression. Carry the same uncertainty adjustment
    # forward now (once per skipped season).
    if active_season is not None:
        for _ in range(max(0, target_season_id - active_season)):
            ratings = defaultdict(
                lambda: 1500.0,
                {driver_id: 1500.0 + (rating - 1500.0) * 0.88 for driver_id, rating in ratings.items()},
            )
    return dict(ratings), dict(starts)


def _mean(values: list[float], default: float = 0.5) -> float:
    return sum(values) / len(values) if values else default


def _shrunk(value: float, samples: int, prior: float, prior_strength: int) -> float:
    return (value * samples + prior * prior_strength) / (samples + prior_strength)


def _current_entrants(
    race: Race,
    outcomes: list[Outcome],
    entrant_driver_ids: set[int] | None = None,
) -> list[DriverSeason]:
    raced_driver_ids = {
        row.driver_id
        for row in outcomes
        if row.season_id == race.season_id
    }
    seats = list(
        DriverSeason.objects
        .filter(season_id=race.season_id)
        .select_related("driver", "team_season__team")
        .order_by("is_reserve", "driver__last_name", "driver__first_name", "id")
    )

    by_driver: dict[int, DriverSeason] = {}
    latest_team_by_driver = {
        row.driver_id: row.team_season_id
        for row in outcomes
        if row.season_id == race.season_id
    }
    for seat in seats:
        if entrant_driver_ids is not None and seat.driver_id not in entrant_driver_ids:
            continue
        if entrant_driver_ids is None and seat.is_reserve and seat.driver_id not in raced_driver_ids:
            continue
        existing = by_driver.get(seat.driver_id)
        if existing is None or seat.team_season_id == latest_team_by_driver.get(seat.driver_id):
            by_driver[seat.driver_id] = seat
    return list(by_driver.values())


def _factor_reason(key: str, value: float, evidence: int) -> str:
    direction = "positive" if value >= 0.55 else "negative" if value <= 0.45 else "neutral"
    messages = {
        "ability": {
            "positive": "Strong long-term head-to-head record",
            "negative": "Career results trail the established field",
            "neutral": "Career rating is close to the field average",
        },
        "form": {
            "positive": "Arrives with strong recent results",
            "negative": "Recent results are below their usual level",
            "neutral": "Recent form is broadly neutral",
        },
        "car": {
            "positive": "Teammate results point to a competitive car",
            "negative": "Teammate results suggest the car is off the pace",
            "neutral": "Limited or balanced teammate evidence",
        },
        "track": {
            "positive": "Has outperformed their baseline at this circuit",
            "negative": "This circuit has historically been a weak spot",
            "neutral": "No clear circuit-specific advantage",
        },
        "category": {
            "positive": "Performs well on this type of circuit",
            "negative": "Usually loses ground on this type of circuit",
            "neutral": "Circuit-type record is close to normal",
        },
    }
    if evidence == 0 and key in {"form", "car", "track", "category"}:
        return f"No {key.replace('car', 'teammate').replace('category', 'circuit-type')} sample yet"
    return messages[key][direction]


def calculate_race_prediction(
    race: Race,
    simulations: int = SIMULATIONS,
    *,
    noise_base: float = NOISE_BASE,
    noise_uncertainty: float = NOISE_UNCERTAINTY,
    entrant_driver_ids: set[int] | None = None,
) -> dict:
    outcomes = _load_outcomes(race)
    entrants = _current_entrants(race, outcomes, entrant_driver_ids)
    ratings, starts = _ability_ratings(outcomes, race.season_id)

    by_driver: dict[int, list[Outcome]] = defaultdict(list)
    by_team_season: dict[int, list[Outcome]] = defaultdict(list)
    all_started = []
    all_failures = 0
    for outcome in outcomes:
        by_driver[outcome.driver_id].append(outcome)
        by_team_season[outcome.team_season_id].append(outcome)
        all_started.append(outcome)
        all_failures += int(outcome.status in {"DNF", "DSQ"})
    league_failure_rate = all_failures / len(all_started) if all_started else 0.03

    rows = []
    for seat in entrants:
        driver_id = seat.driver_id
        history = by_driver.get(driver_id, [])
        overall_performance = _mean([row.performance for row in history])

        ability = 1.0 / (1.0 + 10 ** ((1500.0 - ratings.get(driver_id, 1500.0)) / 400.0))

        season_form = [
            row.performance for row in history
            if row.season_id == race.season_id
        ][-5:]
        form_weights = [0.09, 0.13, 0.18, 0.25, 0.35][-len(season_form):]
        form = (
            sum(value * weight for value, weight in zip(season_form, form_weights)) / sum(form_weights)
            if season_form else 0.5
        )

        teammate_rows = [
            row for row in by_team_season.get(seat.team_season_id, [])
            if row.driver_id != driver_id and row.season_id == race.season_id
        ]
        # Teammate pace is measured against each teammate's own career
        # baseline. That avoids declaring a car strong merely because its
        # other driver is elite (or weak because that driver is a rookie).
        teammate_residuals = [
            row.performance - _mean([
                history_row.performance
                for history_row in by_driver.get(row.driver_id, [])
                if history_row.season_id < race.season_id
            ])
            for row in teammate_rows
        ]
        car_delta = _shrunk(_mean(teammate_residuals, 0.0), len(teammate_residuals), 0.0, 5)
        car = max(0.0, min(1.0, 0.5 + car_delta))

        track_rows = [row for row in history if row.track_id == race.track_id]
        track_delta = _mean([row.performance for row in track_rows], overall_performance) - overall_performance
        track = 0.5 + track_delta * (len(track_rows) / (len(track_rows) + 4))

        category_rows = [
            row for row in history
            if race.track.category and row.track_category == race.track.category and row.track_id != race.track_id
        ]
        category_delta = _mean([row.performance for row in category_rows], overall_performance) - overall_performance
        category = 0.5 + category_delta * (len(category_rows) / (len(category_rows) + 8))

        features = {
            "ability": ability,
            "form": form,
            "car": car,
            "track": max(0.0, min(1.0, track)),
            "category": max(0.0, min(1.0, category)),
        }
        evidence = {
            "ability": starts.get(driver_id, 0),
            "form": len(season_form),
            "car": len(teammate_rows),
            "track": len(track_rows),
            "category": len(category_rows),
        }
        confidence_score = (
            WEIGHTS["ability"] * min(1.0, evidence["ability"] / 12)
            + WEIGHTS["form"] * min(1.0, evidence["form"] / 5)
            + WEIGHTS["car"] * min(1.0, evidence["car"] / 5)
            + WEIGHTS["track"] * min(1.0, evidence["track"] / 4)
            + WEIGHTS["category"] * min(1.0, evidence["category"] / 8)
        )
        score = sum(features[key] * WEIGHTS[key] for key in WEIGHTS)

        failures = sum(row.status in {"DNF", "DSQ"} for row in history)
        failure_probability = _shrunk(
            failures / len(history) if history else league_failure_rate,
            len(history),
            league_failure_rate,
            20,
        )
        failure_probability = max(0.01, min(0.15, failure_probability))

        factors = [
            {
                "key": key,
                "label": {
                    "ability": "Driver ability",
                    "form": "Recent form",
                    "car": "Car strength",
                    "track": "Track affinity",
                    "category": "Circuit type",
                }[key],
                "score": round(value, 3),
                "weight": WEIGHTS[key],
                "evidence": evidence[key],
                "impact": round((value - 0.5) * WEIGHTS[key], 4),
                "reason": _factor_reason(key, value, evidence[key]),
            }
            for key, value in features.items()
        ]
        factors.sort(key=lambda factor: abs(factor["impact"]), reverse=True)

        rows.append({
            "driver": {
                **serialize_driver(seat.driver),
                "is_human": bool(seat.driver.human),
            },
            "team": {
                **serialize_team(seat.team_season.team),
                "color": seat.team_season.color or None,
            },
            "model_score": score,
            "confidence_score": confidence_score,
            "confidence": "high" if confidence_score >= 0.72 else "medium" if confidence_score >= 0.42 else "low",
            "failure_probability": failure_probability,
            "factors": factors,
        })

    rng = random.Random(race.id * 1009 + race.season_id * 9176 + race.round * 37)
    counters = {
        row["driver"]["id"]: {"wins": 0, "podiums": 0, "top_fives": 0, "position_sum": 0}
        for row in rows
    }
    for _ in range(simulations):
        running = []
        failed = []
        for row in rows:
            driver_id = row["driver"]["id"]
            # More evidence narrows the performance distribution; it never
            # removes race-to-race variance entirely.
            noise = noise_base + (1.0 - row["confidence_score"]) * noise_uncertainty
            performance = (row["model_score"] - 0.5) * 5.0 + rng.gauss(0.0, noise)
            target = failed if rng.random() < row["failure_probability"] else running
            target.append((performance, driver_id))
        running.sort(reverse=True)
        failed.sort(reverse=True)
        order = running + failed
        for position, (_performance, driver_id) in enumerate(order, start=1):
            counter = counters[driver_id]
            counter["position_sum"] += position
            counter["wins"] += int(position == 1)
            counter["podiums"] += int(position <= 3)
            counter["top_fives"] += int(position <= 5)

    predictions = []
    for row in rows:
        driver_id = row["driver"]["id"]
        counter = counters[driver_id]
        predictions.append({
            "driver": row["driver"],
            "team": row["team"],
            "expected_finish": round(counter["position_sum"] / simulations, 2),
            "win_probability": round(counter["wins"] / simulations, 4),
            "podium_probability": round(counter["podiums"] / simulations, 4),
            "top_five_probability": round(counter["top_fives"] / simulations, 4),
            "finish_probability": round(1.0 - row["failure_probability"], 4),
            "confidence": row["confidence"],
            "confidence_score": round(row["confidence_score"], 3),
            "factors": row["factors"],
        })
    predictions.sort(key=lambda row: (row["expected_finish"], row["driver"]["last_name"]))
    for rank, prediction in enumerate(predictions, start=1):
        prediction["predicted_rank"] = rank

    completed_rounds = sorted({
        row.round for row in outcomes if row.season_id == race.season_id
    })
    return {
        "model": {
            "version": MODEL_VERSION,
            "stage": "pre_weekend",
            "simulations": simulations,
            "weights": WEIGHTS,
            "uses_grid": False,
            "method": "pairwise_elo_weighted_features_monte_carlo",
            "probability_scale": "0_to_1",
            "variance": {
                "base": noise_base,
                "uncertainty": noise_uncertainty,
            },
        },
        "race": {
            "id": race.id,
            "season_id": race.season_id,
            "round": race.round,
            "is_sprint": race.is_sprint,
            "track": {
                "id": race.track_id,
                "name": race.track.name,
                "category": race.track.category or None,
            },
        },
        "as_of": {
            "season_id": race.season_id,
            "completed_round": completed_rounds[-1] if completed_rounds else None,
            "future_results_excluded": True,
        },
        "field_size": len(predictions),
        "limitations": [
            "Grid position is not included because it is only stored with completed results.",
            "The expected field uses current non-reserve season entries and reserves who have already raced.",
            "Sparse track, category and teammate samples are regressed toward neutral.",
        ],
        "predictions": predictions,
    }
