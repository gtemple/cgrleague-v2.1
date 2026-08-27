from typing import Any, Dict, List
from django.core.cache import cache
from django.db.models import Sum, F, Avg, Count, Max, Value, Q, FloatField
from django.db.models.functions import Coalesce
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from entries.models import DriverSeason
from results.models import Race, RaceResult
from results.cache import CACHE_TTL, key_season_standings, key_constructor_standings
from .utils import points_case, fl_bonus_case, serialize_team


def _completed_main_rounds(season_id: int) -> List[int]:
    """Distinct non-sprint rounds with at least one result, newest first."""
    return list(
        Race.objects
        .filter(season_id=season_id, is_sprint=False, results__isnull=False)
        .values_list("round", flat=True)
        .distinct()
        .order_by("-round")
    )


def _combine_seats(seat_rows) -> List[Dict[str, Any]]:
    """
    Fold a season's seats into one row per driver.

    A driver can hold more than one seat in a season — a substitute keeps their
    own drive and stands in elsewhere — and their championship points are the
    sum across all of them, as in F1, rather than a line per seat. The team
    shown is the one they most recently raced for.

    Expects seats already ordered best-first and annotated with `points` and
    `avg_finish`.
    """
    combined: Dict[int, Dict[str, Any]] = {}
    for ds in seat_rows:
        row = combined.get(ds.driver_id)
        if row is None:
            combined[ds.driver_id] = {
                "driver_id": ds.driver_id,
                "driver": ds.driver,
                "seat": ds,
                "seats": [ds],
                "points": int(ds.points or 0),
                # weighted so the tie-break average stays a real average across seats
                "finish_sum": (ds.avg_finish or 0) * (ds.classified or 0),
                "classified": ds.classified or 0,
            }
            continue
        row["points"] += int(ds.points or 0)
        row["seats"].append(ds)
        row["finish_sum"] += (ds.avg_finish or 0) * (ds.classified or 0)
        row["classified"] += ds.classified or 0

    rows = list(combined.values())
    for row in rows:
        row["avg_finish"] = (row["finish_sum"] / row["classified"]) if row["classified"] else None
        # Display the seat they last actually drove for.
        row["seat"] = max(row["seats"], key=lambda d: (d.last_round or -1, d.id))
    rows.sort(key=lambda r: (
        -r["points"],
        r["avg_finish"] if r["avg_finish"] is not None else 1e9,
        (r["driver"].last_name or ""),
        (r["driver"].first_name or ""),
        r["driver_id"],
    ))
    return rows


def _driver_trend_map(season_id: int, current_positions: Dict[int, int]) -> Dict[int, int]:
    """driver_id -> position delta vs. standings as of the previous completed round (+ = moved up)."""
    rounds = _completed_main_rounds(season_id)
    if len(rounds) < 2:
        return {}
    prev_cutoff = rounds[1]

    qs = (
        DriverSeason.objects
        .filter(season_id=season_id)
        .annotate(base_pts=Coalesce(Sum(points_case(), filter=Q(results__race__round__lte=prev_cutoff)), 0))
        .annotate(fl_pts=Coalesce(Sum(fl_bonus_case(), filter=Q(results__race__round__lte=prev_cutoff)), 0))
        .annotate(points=F("base_pts") + F("fl_pts"))
        .annotate(
            avg_finish=Avg(
                "results__finish_position",
                filter=Q(results__finish_position__isnull=False, results__race__round__lte=prev_cutoff),
                output_field=FloatField(),
            )
        )
        .annotate(n_results=Count("results"))
        .exclude(is_reserve=True, n_results=0)
        .annotate(
            classified=Count(
                "results",
                filter=Q(results__finish_position__isnull=False, results__race__round__lte=prev_cutoff),
            )
        )
        .annotate(last_round=Max("results__race__round", filter=Q(results__race__round__lte=prev_cutoff)))
        .annotate(avg_finish_norm=Coalesce("avg_finish", Value(1e9)))
        .order_by("-points", "avg_finish_norm", "driver__last_name", "driver__first_name", "id")
    )
    prev_positions = {
        row["driver_id"]: i + 1
        for i, row in enumerate(_combine_seats(qs))
    }
    return {
        driver_id: prev_positions[driver_id] - cur_pos
        for driver_id, cur_pos in current_positions.items()
        if driver_id in prev_positions
    }


def _constructor_trend_map(season_id: int, current_positions: Dict[int, int]) -> Dict[int, int]:
    """team_id -> position delta vs. standings as of the previous completed round (+ = moved up)."""
    rounds = _completed_main_rounds(season_id)
    if len(rounds) < 2:
        return {}
    prev_cutoff = rounds[1]

    qs = (
        RaceResult.objects
        .filter(race__season_id=season_id, race__round__lte=prev_cutoff)
        .annotate(points_row=points_case(prefix="") + fl_bonus_case(prefix=""))
        .values("driver_season__team_season__team__id")
        .annotate(points=Sum("points_row"))
        .order_by("-points")
    )
    prev_positions = {
        row["driver_season__team_season__team__id"]: i + 1 for i, row in enumerate(qs)
    }
    return {
        team_id: prev_positions[team_id] - cur_pos
        for team_id, cur_pos in current_positions.items()
        if team_id in prev_positions
    }


class ConstructorStandingsView(APIView):
    """
    Sum team points for a season.
    Scoring: 25-18-15-12-10-8-6-4-2-1 +1 for fastest lap (any position).
    Tie-breaker: lower average finish (better) wins; unknown averages sort last.
    """
    def get(self, request, season_id: int, *args, **kwargs):
        ck = key_constructor_standings(season_id)
        cached = cache.get(ck)
        if cached is not None:
            return Response(cached)

        base_pts = points_case(prefix="")  # RaceResult fields live on this model
        fl_bonus = fl_bonus_case(prefix="")

        qs = (
            RaceResult.objects
            .filter(race__season_id=season_id)
            .select_related("driver_season__team_season__team")
            .annotate(points_row=base_pts + fl_bonus)
            .values(
                "driver_season__team_season__team__id",
                "driver_season__team_season__team__team_name",
                "driver_season__team_season__team__team_img",
                "driver_season__team_season__color",
            )
            # aggregate team totals + average finish across all their results
            .annotate(
                points=Sum("points_row"),
                avg_finish=Avg(
                    "finish_position",
                    filter=Q(finish_position__isnull=False),
                    output_field=FloatField(),
                ),
            )
            # normalize avg so NULLs (no results) sort last
            .annotate(avg_finish_norm=Coalesce("avg_finish", Value(1e9)))
            .order_by(
                "-points",
                "avg_finish_norm",  # lower is better
                "driver_season__team_season__team__team_name",
            )
        )

        rows = list(qs)
        current_positions = {
            row["driver_season__team_season__team__id"]: i + 1 for i, row in enumerate(rows)
        }
        trend_map = _constructor_trend_map(season_id, current_positions)

        data: List[Dict[str, Any]] = []
        for row in rows:
            team_id = row["driver_season__team_season__team__id"]
            display_name = row["driver_season__team_season__team__team_name"]

            data.append({
                "team_season_id": None,
                "team": {
                    "id": team_id,
                    "name": display_name,
                    "display_name": display_name,
                    "logo_image": row.get("driver_season__team_season__team__team_img"),
                    "color": row.get("driver_season__team_season__color") or None,
                },
                "points": row["points"] or 0,
                "trend": trend_map.get(team_id, 0),
            })

        cache.set(ck, data, timeout=CACHE_TTL)
        return Response(data)


class SeasonStandingsView(APIView):
    """
    Driver standings with tie-breaker on average finish (lower is better).
    """
    def get(self, request, season_id: int, *args, **kwargs):
        ck = key_season_standings(season_id)
        cached = cache.get(ck)
        if cached is not None:
            return Response(cached)

        qs = (
            DriverSeason.objects
            .filter(season_id=season_id)
            .select_related("driver", "team_season__team")
            .annotate(base_points=Coalesce(Sum(points_case()), 0))
            .annotate(fl_bonus=Coalesce(Sum(fl_bonus_case()), 0))
            .annotate(points=F("base_points") + F("fl_bonus"))
            # average finish across this driver's classified results
            .annotate(
                avg_finish=Avg(
                    "results__finish_position",
                    filter=Q(results__finish_position__isnull=False),
                    output_field=FloatField(),
                )
            )
            .annotate(n_results=Count("results"))
            # A reserve who has not driven is not in the championship. A regular
            # entrant who never raced stays listed, as they always have been.
            .exclude(is_reserve=True, n_results=0)
            .annotate(
                classified=Count("results", filter=Q(results__finish_position__isnull=False))
            )
            .annotate(last_round=Max("results__race__round"))
            .annotate(avg_finish_norm=Coalesce("avg_finish", Value(1e9)))
            .order_by(
                "-points",
                "avg_finish_norm",  # lower is better; unknowns last
                "driver__last_name",
                "driver__first_name",
                "id",
            )
        )

        rows = _combine_seats(qs)
        current_positions = {row["driver_id"]: i + 1 for i, row in enumerate(rows)}
        trend_map = _driver_trend_map(season_id, current_positions)

        data = []
        for row in rows:
            ds = row["seat"]
            team_name = None
            team_id = None
            team_logo = None
            team_color = None
            if getattr(ds, "team_season", None) and getattr(ds.team_season, "team", None):
                team_name = ds.team_season.team.team_name
                team_id = ds.team_season.team.id
                team_logo = ds.team_season.team.team_img
                team_color = ds.team_season.color or None

            drv = row["driver"]
            data.append({
                "driver_season_id": ds.id,
                "points": row["points"],
                "trend": trend_map.get(drv.id, 0),
                "driver": {
                    "id": drv.id,
                    "first_name": getattr(drv, "first_name", "") or "",
                    "last_name": getattr(drv, "last_name", "") or "",
                    "display_name": (
                        f"{getattr(drv, 'first_name', '') or ''} {getattr(drv, 'last_name', '') or ''}"
                    ).strip() or getattr(drv, "name", ""),
                    "profile_image": getattr(drv, "profile_image", None),
                    "is_human": bool(getattr(drv, "human", False)),
                },
                "team": {
                    "id": team_id,
                    "name": team_name,
                    "logo_image": team_logo,
                    "color": team_color,
                },
                # If you want to surface it to the UI, you can add:
                # "avg_finish": ds.avg_finish,
            })

        cache.set(ck, data, timeout=CACHE_TTL)
        return Response(data, status=status.HTTP_200_OK)
