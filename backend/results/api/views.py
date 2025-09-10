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
from django.db.models import Count, Q


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
    Scoring: 25-18-15-12-10-8-6-4-2-1 +1 for fastest lap (any position).
    """
    def get(self, request, season_id: int, *args, **kwargs):
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
                "driver_season__team_season__display_name",
                "driver_season__team_season__team__id",
                "driver_season__team_season__team__team_name",
                "driver_season__team_season__team__team_img", 
            )
            .annotate(points=Sum("points_row"))
            .order_by("-points", "driver_season__team_season__team__team_name")
        )

        data = []
        for row in qs:
            team_id = row["driver_season__team_season__team__id"]
            base_name = row["driver_season__team_season__team__team_name"]
            season_display = row["driver_season__team_season__display_name"] or ""
            display_name = season_display or base_name

            data.append({
                "team_season_id": row["driver_season__team_season_id"],
                "team": {
                    "id": team_id,
                    "name": base_name,
                    "display_name": display_name, 
                    "logo_image": row.get("driver_season__team_season__team__team_img"),
                },
                "points": row["points"] or 0,
            })

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


# results/api/views.py
from typing import Any, Dict, List

from django.db.models import Count, Q
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from entries.models import DriverSeason
from results.models import Race, RaceResult
from results.scoring import points_for_result


class SeasonResultsMatrixView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, season_id: int):
        include_sprints = str(request.GET.get("include_sprints", "")).lower() in ("1", "true", "yes")

        # 1) Races (maybe none yet)
        races_qs = (
            Race.objects.filter(season_id=season_id)
            .select_related("track")
            .order_by("round", "is_sprint")
        )
        if not include_sprints:
            races_qs = races_qs.filter(is_sprint=False)

        races = list(races_qs)
        race_index = {r.id: i for i, r in enumerate(races)}
        race_count = len(races)

        # 2) All driver entries so everyone appears even with zero results
        ds_qs = (
            DriverSeason.objects
            .filter(season_id=season_id)
            .select_related("driver", "team_season__team")
            .order_by("driver__last_name", "driver__first_name", "id")
        )

        def initials_for(driver) -> str:
            first = (getattr(driver, "first_name", "") or "").strip()
            last  = (getattr(driver, "last_name", "") or "").strip()
            if first or last:
                return (first[:1] + last[:1]).upper()
            name = (getattr(driver, "name", "") or "").strip()
            return name[:2].upper() if name else ""

        # 3) Pre-seed rows & constructor totals
        rows_by_ds: Dict[int, Dict[str, Any]] = {}
        constructor_totals: Dict[int, Dict[str, Any]] = {}

        for ds in ds_qs:
            driver = ds.driver

            team_name = ""
            team_logo = None
            team_id = None
            team_display_name = ""

            if getattr(ds, "team_season", None) and getattr(ds.team_season, "team", None):
                base_name = ds.team_season.team.team_name
                team_display_name = (ds.team_season.display_name or base_name) or ""
                team_name = base_name
                team_logo = getattr(ds.team_season.team, "team_img", None)
                team_id = ds.team_season.team.id

            rows_by_ds[ds.id] = {
                "driver_info": {
                    "first_name": getattr(driver, "first_name", "") or "",
                    "last_name": getattr(driver, "last_name", "") or "",
                    "team_name": team_name,                 # base team name
                    "team_display_name": team_display_name, # per-season display name
                    "profile_image": getattr(driver, "profile_image", None),
                    "initials": initials_for(driver),
                },
                "finish_positions": [None] * race_count,
                "grid_positions": [None] * race_count,
                "statuses": [None] * race_count,
                "fastest_lap": [False] * race_count,
                "pole_positions": [False] * race_count,
                "dotds": [False] * race_count,
                "finish_points": [0] * race_count,  # per-race points (default 0)
                "total_points": 0,
                "_finish_list": [],                 # for avg finish
            }

            if team_id is not None and team_id not in constructor_totals:
                constructor_totals[team_id] = {
                    "team_name": team_name,
                    "team_display_name": team_display_name,
                    "team_image": team_logo,
                    "points": 0,
                }

        # 4) Overlay actual results (if any)
        if race_count > 0:
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

            for rr in results_qs:
                ds = rr.driver_season

                # Safety: if a result appears for a DS we didn't preload (edge cases)
                if ds.id not in rows_by_ds:
                    driver = ds.driver
                    team_name = ""
                    team_logo = None
                    team_display_name = ""
                    if getattr(ds, "team_season", None) and getattr(ds.team_season, "team", None):
                        base_name = ds.team_season.team.team_name
                        team_display_name = (ds.team_season.display_name or base_name) or ""
                        team_name = base_name
                        team_logo = getattr(ds.team_season.team, "team_img", None)

                    rows_by_ds[ds.id] = {
                        "driver_info": {
                            "first_name": getattr(driver, "first_name", "") or "",
                            "last_name": getattr(driver, "last_name", "") or "",
                            "team_name": team_name,
                            "team_display_name": team_display_name,
                            "profile_image": getattr(driver, "profile_image", None),
                            "initials": initials_for(driver),
                        },
                        "finish_positions": [None] * race_count,
                        "grid_positions": [None] * race_count,
                        "statuses": [None] * race_count,
                        "fastest_lap": [False] * race_count,
                        "pole_positions": [False] * race_count,
                        "dotds": [False] * race_count,
                        "finish_points": [0] * race_count,
                        "total_points": 0,
                        "_finish_list": [],
                    }

                row = rows_by_ds[ds.id]
                idx = race_index.get(rr.race_id)
                if idx is None:
                    continue  # not in this include_sprints view

                row["finish_positions"][idx] = rr.finish_position
                row["grid_positions"][idx] = rr.grid_position
                row["statuses"][idx] = rr.status
                row["fastest_lap"][idx] = rr.fastest_lap
                row["pole_positions"][idx] = rr.pole_position
                row["dotds"][idx] = rr.dotd

                pts = points_for_result(rr)
                row["finish_points"][idx] = pts
                row["total_points"] += pts
                if rr.finish_position is not None:
                    row["_finish_list"].append(rr.finish_position)

                team = getattr(ds, "team_season", None)
                t_id = getattr(team.team, "id", None) if team and getattr(team, "team", None) else None
                if t_id is not None:
                    if t_id not in constructor_totals:
                        base_name = getattr(team.team, "team_name", "") or ""
                        constructor_totals[t_id] = {
                            "team_name": base_name,
                            "team_display_name": (getattr(team, "display_name", "") or base_name) or "",
                            "team_image": getattr(team.team, "team_img", None),
                            "points": 0,
                        }
                    constructor_totals[t_id]["points"] += pts

        # 5) Finalize rows: avg finish & sorting
        results: List[Dict[str, Any]] = []
        for r in rows_by_ds.values():
            finishes = r.pop("_finish_list")
            r["avg_finish_position"] = (sum(finishes) / len(finishes)) if finishes else None
            results.append(r)

        def sort_key(r):
            avg = r["avg_finish_position"]
            avg_norm = avg if avg is not None else 1e9
            last = (r["driver_info"]["last_name"] or "").lower()
            return (-r["total_points"], avg_norm, last)

        results.sort(key=sort_key)

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
                "constructor_results": constructor_results,
            }
        )




class SeasonLastRaceView(APIView):
    """
    Returns:
      - last_race: top 3 classified results from the most recent race that has results
      - next_race: the next upcoming race (earliest race after `last_race` with 0 results),
                   or the first race if the season hasn't started yet.
    Optional query:
      ?include_sprints=1   # include sprint races in the ordering
    """
    permission_classes = [AllowAny]

    def get(self, request, season_id: int, *args, **kwargs):
        include_sprints = str(request.GET.get("include_sprints", "")).lower() in ("1", "true", "yes")

        races_qs = (
            Race.objects
            .filter(season_id=season_id)
            .select_related("track")
            .order_by("round", "is_sprint")
        )
        if not include_sprints:
            races_qs = races_qs.filter(is_sprint=False)

        races = list(races_qs)
        if not races:
            return Response({
                "season_id": int(season_id),
                "include_sprints": include_sprints,
                "last_race": None,
                "next_race": None,
            })

        # Last race that has any results
        last_race = (
            Race.objects
            .filter(id__in=[r.id for r in races], results__isnull=False)
            .order_by("round", "is_sprint")
            .last()
        )

        last_race_payload = None
        if last_race:
            top3 = (
                RaceResult.objects
                .filter(race=last_race, finish_position__isnull=False)
                .select_related(
                    "driver_season__driver",
                    "driver_season__team_season__team",
                    "race__track",
                )
                .order_by("finish_position")[:3]
            )

            def initials_for(driver) -> str:
                first = (getattr(driver, "first_name", "") or "").strip()
                last = (getattr(driver, "last_name", "") or "").strip()
                if first or last:
                    return (first[:1] + last[:1]).upper()
                name = (getattr(driver, "name", "") or "").strip()
                return name[:2].upper() if name else ""

            last_race_payload = {
                "race": {
                    "id": last_race.id,
                    "round": last_race.round,
                    "is_sprint": last_race.is_sprint,
                    "track": {
                        "id": last_race.track_id,
                        "name": getattr(last_race.track, "name", ""),
                        "city": getattr(last_race.track, "city", ""),
                        "country": getattr(last_race.track, "country", ""),
                        "image": getattr(last_race.track, "img", None),
                    },
                },
                "results": [
                    {
                        "finish_position": rr.finish_position,
                        "status": rr.status,
                        "fastest_lap": rr.fastest_lap,
                        "dotd": rr.dotd,
                        "points": points_for_result(rr),
                        "driver": {
                            "id": rr.driver_season.driver_id,
                            "first_name": getattr(rr.driver_season.driver, "first_name", "") or "",
                            "last_name": getattr(rr.driver_season.driver, "last_name", "") or "",
                            "display_name": (
                                f"{getattr(rr.driver_season.driver, 'first_name', '') or ''} "
                                f"{getattr(rr.driver_season.driver, 'last_name', '') or ''}"
                            ).strip() or getattr(rr.driver_season.driver, "name", ""),
                            "profile_image": getattr(rr.driver_season.driver, "profile_image", None),
                            "initials": initials_for(rr.driver_season.driver),
                        },
                        "team": {
                            "id": getattr(getattr(rr.driver_season, "team_season", None), "team_id", None),
                            "name": (
                                getattr(
                                    getattr(getattr(rr.driver_season, "team_season", None), "team", None),
                                    "team_name",
                                    "",
                                ) or ""
                            ),
                            "logo_image": (
                                getattr(
                                    getattr(getattr(rr.driver_season, "team_season", None), "team", None),
                                    "team_img",
                                    None,
                                )
                            ),
                        },
                    }
                    for rr in top3
                ],
            }

        # Next upcoming race (first with zero results) AFTER last_race.
        # If no last_race (season not started), pick the very first race.
        next_race = None
        if last_race:
            next_race = (
                Race.objects
                .filter(id__in=[r.id for r in races])
                .filter(
                    Q(round__gt=last_race.round) |
                    (Q(round=last_race.round) & Q(is_sprint__gt=last_race.is_sprint))
                )
                .annotate(result_count=Count("results"))
                .filter(result_count=0)
                .order_by("round", "is_sprint")
                .first()
            )
        else:
            next_race = (
                Race.objects
                .filter(id__in=[r.id for r in races])
                .annotate(result_count=Count("results"))
                .filter(result_count=0)
                .order_by("round", "is_sprint")
                .first()
            )

        next_race_payload = None
        if next_race:
            next_race_payload = {
                "race": {
                    "id": next_race.id,
                    "round": next_race.round,
                    "is_sprint": next_race.is_sprint,
                    "track": {
                        "id": next_race.track_id,
                        "name": getattr(next_race.track, "name", ""),
                        "city": getattr(next_race.track, "city", ""),
                        "country": getattr(next_race.track, "country", ""),
                        "image": getattr(next_race.track, "img", None),
                    },
                }
            }

        return Response({
            "season_id": int(season_id),
            "include_sprints": include_sprints,
            "last_race": last_race_payload,
            "next_race": next_race_payload,
        })