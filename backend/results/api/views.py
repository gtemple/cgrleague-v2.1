# results/api/views.py
from django.db.models import Case, When, Value, IntegerField, Sum, F, Q
from django.db.models.functions import Coalesce
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status
from typing import Dict, List, Any

from entries.models import DriverSeason
from results.models import Race, RaceResult
from results.scoring import points_for_result

PLACE_POINTS = {
    1: 25, 2: 18, 3: 15, 4: 12, 5: 10,
    6: 8, 7: 6, 8: 4, 9: 2, 10: 1,
}

def _points_case():
    """Sum of race points from finishing position (1..10)."""
    whens = [When(results__finish_position=pos, then=Value(pts))
             for pos, pts in PLACE_POINTS.items()]
    return Case(*whens, default=Value(0), output_field=IntegerField())

def _fl_bonus_case():
    """
    +1 if fastest lap and classified in the points (<=10).
    We also guard against NULL finish_position.
    """
    return Case(
        When(
            Q(results__fastest_lap=True) &
            Q(results__finish_position__isnull=False) &
            Q(results__finish_position__lte=10),
            then=Value(1),
        ),
        default=Value(0),
        output_field=IntegerField(),
    )

class ConstructorStandingsView(APIView):
    """
    Sum team points for a season.
    Scoring: 25-18-15-12-10-8-6-4-2-1 plus +1 for fastest lap (any position).
    """
    def get(self, request, season_id: int, *args, **kwargs):
        # base points by finishing position
        base_pts = Case(
            When(finish_position=1, then=Value(25)),
            When(finish_position=2, then=Value(18)),
            When(finish_position=3, then=Value(15)),
            When(finish_position=4, then=Value(12)),
            When(finish_position=5, then=Value(10)),
            When(finish_position=6, then=Value(8)),
            When(finish_position=7, then=Value(6)),
            When(finish_position=8, then=Value(4)),
            When(finish_position=9, then=Value(2)),
            When(finish_position=10, then=Value(1)),
            default=Value(0),
            output_field=IntegerField(),
        )
        fl_bonus = Case(
            When(fastest_lap=True, then=Value(1)),
            default=Value(0),
            output_field=IntegerField(),
        )

        qs = (
            RaceResult.objects
            .filter(race__season_id=season_id)
            .select_related("driver_season__team_season__team")
            .annotate(points_row=base_pts + fl_bonus)
            .values(
                "driver_season__team_season_id",
                "driver_season__team_season__team__id",
                "driver_season__team_season__team__team_name",
            )
            .annotate(points=Sum("points_row"))
            .order_by("-points", "driver_season__team_season__team__team_name")
        )

        data = [
            {
                "team_season_id": row["driver_season__team_season_id"],
                "team": {
                    "id": row["driver_season__team_season__team__id"],
                    "name": row["driver_season__team_season__team__team_name"],
                },
                "points": row["points"] or 0,
            }
            for row in qs
        ]
        return Response(data)

class SeasonStandingsView(APIView):
    def get(self, request, season_id: int, *args, **kwargs):
        qs = (
            DriverSeason.objects
            .filter(season_id=season_id)
            .select_related("driver", "team_season__team")  # for names
            .annotate(base_points=Coalesce(Sum(_points_case()), 0))
            .annotate(fl_bonus=Coalesce(Sum(_fl_bonus_case()), 0))
            .annotate(points=F("base_points") + F("fl_bonus"))
            .order_by("-points", "driver__last_name", "driver__first_name", "id")
        )

        data = []
        for ds in qs:
            team_name = None
            team_id = None
            if getattr(ds, "team_season", None) and getattr(ds.team_season, "team", None):
                team_name = ds.team_season.team.team_name
                team_id = ds.team_season.team.id
                team_logo = ds.team_season.team.team_img

            drv = ds.driver
            data.append({
                "driver_season_id": ds.id,
                "points": int(ds.points or 0),
                "driver": {
                    "id": drv.id,
                    "first_name": getattr(drv, "first_name", "") or "",
                    "last_name": getattr(drv, "last_name", "") or "",
                    "display_name": (f"{getattr(drv, 'first_name', '') or ''} {getattr(drv, 'last_name', '') or ''}").strip() or getattr(drv, "name", ""),
                    "profile_image": getattr(drv, "profile_image", None),
                },
                "team": {
                    "id": team_id,
                    "name": team_name,
                    "logo_image": team_logo
                },
            })

        return Response(data, status=status.HTTP_200_OK)


class SeasonResultsMatrixView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, season_id: int):
        include_sprints = str(request.GET.get("include_sprints", "")).lower() in ("1", "true", "yes")

        races_qs = (
            Race.objects.filter(season_id=season_id)
            .select_related("track")
            .order_by("round", "is_sprint")
        )
        if not include_sprints:
            races_qs = races_qs.filter(is_sprint=False)

        races = list(races_qs)
        if not races:
            return Response(
                {"season_id": season_id, "races": [], "results": [], "points_leaderboard": [], "constructor_results": []}
            )

        race_index = {r.id: i for i, r in enumerate(races)}

        results_qs = (
            RaceResult.objects
            .filter(race__in=races)
            .select_related(
                "race",
                "race__track",
                "driver_season__driver",
                "driver_season__team_season__team",
            )
        )

        rows_by_ds: Dict[int, Dict[str, Any]] = {}

        # NEW: aggregate constructor totals as we loop
        constructor_totals: Dict[int, Dict[str, Any]] = {}  # team_id -> { team_name, team_image, points }

        def initials_for(driver) -> str:
            first = (getattr(driver, "first_name", "") or "").strip()
            last  = (getattr(driver, "last_name", "") or "").strip()
            if first or last:
                return (first[:1] + last[:1]).upper()
            name = (getattr(driver, "name", "") or "").strip()
            return name[:2].upper() if name else ""

        for rr in results_qs:
            ds = rr.driver_season
            ds_id = ds.id
            if ds_id not in rows_by_ds:
                driver = ds.driver
                team_name = ""
                team_logo = None
                if getattr(ds, "team_season", None) and getattr(ds.team_season, "team", None):
                    team_name = ds.team_season.team.team_name
                    team_logo = getattr(ds.team_season.team, "team_img", None)

                rows_by_ds[ds_id] = {
                    "driver_info": {
                        "first_name": getattr(driver, "first_name", "") or "",
                        "last_name": getattr(driver, "last_name", "") or "",
                        "team_name": team_name,
                        "profile_image": getattr(driver, "profile_image", None),
                        "initials": initials_for(driver),
                    },
                    "finish_positions": [None] * len(races),
                    "grid_positions": [None] * len(races),
                    "statuses": [None] * len(races),
                    "fastest_lap": [False] * len(races),
                    "pole_positions": [False] * len(races),
                    "dotds": [False] * len(races),
                    "finish_points": [0] * len(races),  # if you already added this earlier, keep it
                    "total_points": 0,
                    "_finish_list": [],
                }

            row = rows_by_ds[ds_id]
            idx = race_index[rr.race_id]

            row["finish_positions"][idx] = rr.finish_position
            row["grid_positions"][idx] = rr.grid_position
            row["statuses"][idx] = rr.status
            row["fastest_lap"][idx] = rr.fastest_lap
            row["pole_positions"][idx] = rr.pole_position
            row["dotds"][idx] = rr.dotd

            pts = points_for_result(rr)
            row["total_points"] += pts
            row["finish_points"][idx] = pts  # per-race points

            if rr.finish_position is not None:
                row["_finish_list"].append(rr.finish_position)

            # --- NEW: add to constructor totals ---
            team = getattr(ds, "team_season", None)
            team_id = getattr(team.team, "id", None) if team and getattr(team, "team", None) else None
            if team_id is not None:
                team_name = getattr(team.team, "team_name", "") or ""
                team_img  = getattr(team.team, "team_img", None)
                if team_id not in constructor_totals:
                    constructor_totals[team_id] = {
                        "team_name": team_name,
                        "team_image": team_img,
                        "points": 0,
                    }
                constructor_totals[team_id]["points"] += pts

        # finalize driver rows
        results: List[Dict[str, Any]] = []
        for r in rows_by_ds.values():
            finishes = r.pop("_finish_list")
            avg = (sum(finishes) / len(finishes)) if finishes else None
            r["avg_finish_position"] = avg
            results.append(r)

        # sort drivers by total points DESC, avg finish ASC, last name ASC
        def sort_key(r):
            avg = r["avg_finish_position"]
            avg_norm = avg if avg is not None else 1e9
            last = (r["driver_info"]["last_name"] or "").lower()
            return (-r["total_points"], avg_norm, last)

        results.sort(key=sort_key)

        # races payload with track details
        races_payload = [
            {
                "id": r.id,
                "round": r.round,
                "is_sprint": r.is_sprint,
                "track": {
                    "id": r.track_id,
                    "name": getattr(r.track, "name", ""),
                    "city": getattr(r.track, "city", ""),
                    "country": getattr(r.track, "country", ""),
                },
            }
            for r in races
        ]

        points_leaderboard = [row["total_points"] for row in results]

        # --- NEW: constructor_results: sorted list (highest → lowest) ---
        constructor_results = sorted(
            constructor_totals.values(),
            key=lambda x: x["points"],
            reverse=True,
        )

        return Response(
            {
                "season_id": int(season_id),
                "races": races_payload,
                "results": results,
                "points_leaderboard": points_leaderboard,
                "constructor_results": constructor_results,  # <-- new
            }
        )