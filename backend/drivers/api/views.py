# drivers/api/views.py
from typing import Any, Dict, List, Optional
from django.core.cache import cache
from django.db.models import (
    Sum, Count, Avg, Min, Q, F, Value, IntegerField, FloatField, OuterRef, Subquery,
    ExpressionWrapper, Case, When
)
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from entries.models import DriverSeason
from results.models import RaceResult
from seasons.models import Season
from drivers.models import Driver
# Reuse your existing points helpers (same ones used in standings)
from results.api.views.utils import points_case, fl_bonus_case, serialize_driver, serialize_team
from results.cache import CACHE_TTL, key_driver_detail, key_driver_history


def serialize_driver(d: Driver) -> Dict[str, Any]:
    """Consistent driver payload."""
    first = getattr(d, "first_name", "") or ""
    last  = getattr(d, "last_name", "") or ""
    display = (f"{first} {last}").strip() or getattr(d, "name", "") or f"Driver {d.id}"
    return {
        "id": d.id,
        "first_name": first,
        "last_name": last,
        "display_name": display,
        "profile_image": getattr(d, "profile_image", None),
        # add more fields if you store them (nationality, number, etc.)
    }


class DriversListView(APIView):
    """
    GET /api/drivers/?q=<search>
    Returns a lightweight, alphabetized list for dropdowns/filters.
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        q = (request.GET.get("q") or "").strip()

        qs = Driver.objects.all()
        if q:
            qs = qs.filter(
                # simple search on first/last/display
                # (add .name if you keep a single-field name)
                # OR conditions via icontains
                # .filter(Q(... ) | Q(...)) if you prefer
                first_name__icontains=q
            ) | Driver.objects.filter(last_name__icontains=q)

        qs = qs.order_by("last_name", "first_name", "id")

        data = [serialize_driver(d) for d in qs]
        return Response(data)


class DriverDetailView(APIView):
    """
    GET /api/drivers/<driver_id>/
    Returns full driver info + career aggregates across all RaceResults.
    """
    permission_classes = [AllowAny]

    def get(self, request, driver_id: int, *args, **kwargs):
        ck = key_driver_detail(driver_id)
        cached = cache.get(ck)
        if cached is not None:
            return Response(cached)

        driver = get_object_or_404(Driver, pk=driver_id)

        rr_qs = RaceResult.objects.filter(driver_season__driver_id=driver_id)

        # Base points from finish position + FL bonus as you use elsewhere
        base_expr = points_case(prefix="")         # uses RaceResult.finish_position
        fl_expr   = fl_bonus_case(prefix="")       # uses RaceResult.fastest_lap (+ classification rule you encoded)

        agg = rr_qs.aggregate(
            base_points=Coalesce(Sum(base_expr), 0),
            fl_bonus_points=Coalesce(Sum(fl_expr), 0),

            total_laps=Coalesce(Sum("laps_completed"), 0),

            # result counts (Case→Count pattern)
            wins=Count(Case(When(finish_position=1, then=1), output_field=IntegerField())),
            podiums=Count(Case(
                When(finish_position__isnull=False, finish_position__lte=3, then=1),
                output_field=IntegerField(),
            )),
            dnfs=Count(Case(When(status="DNF", then=1), output_field=IntegerField())),
            fastest_laps=Count(Case(When(fastest_lap=True, then=1), output_field=IntegerField())),
            poles=Count(Case(When(pole_position=True, then=1), output_field=IntegerField())),
            dotds=Count(Case(When(dotd=True, then=1), output_field=IntegerField())),
            cleanest_awards=Count(Case(When(cleanest_driver=True, then=1), output_field=IntegerField())),
            most_overtakes_awards=Count(Case(When(most_overtakes=True, then=1), output_field=IntegerField())),

            races_completed=Count(Case(When(status="FIN", then=1), output_field=IntegerField())),
            races_count=Count("id"),

            # average finish position across classified results (NULL ignored)
            avg_finish=Avg("finish_position"),

            # advanced stats
            points_finishes=Count(Case(
                When(finish_position__isnull=False, finish_position__lte=10, then=1),
                output_field=IntegerField(),
            )),
            pole_wins=Count(Case(
                When(pole_position=True, finish_position=1, then=1),
                output_field=IntegerField(),
            )),
            avg_positions_gained=Avg(
                ExpressionWrapper(
                    F("grid_position") - F("finish_position"),
                    output_field=FloatField(),
                ),
                filter=Q(grid_position__isnull=False, finish_position__isnull=False, status="FIN"),
            ),
        )

        total_points = int(agg["base_points"]) + int(agg["fl_bonus_points"])
        races = int(agg["races_count"] or 0)
        poles = int(agg["poles"] or 0)
        races_completed = int(agg["races_completed"] or 0)
        points_finishes = int(agg["points_finishes"] or 0)
        pole_wins = int(agg["pole_wins"] or 0)

        payload = {
            "driver": serialize_driver(driver),
            "totals": {
                "points": total_points,
                "points_breakdown": {
                    "base": int(agg["base_points"]),
                    "fastest_lap_bonus": int(agg["fl_bonus_points"]),
                },
                "laps": int(agg["total_laps"] or 0),
                "wins": int(agg["wins"] or 0),
                "podiums": int(agg["podiums"] or 0),
                "dnfs": int(agg["dnfs"] or 0),
                "fastest_laps": int(agg["fastest_laps"] or 0),
                "poles": poles,
                "dotds": int(agg["dotds"] or 0),
                "cleanest_awards": int(agg["cleanest_awards"] or 0),
                "most_overtakes_awards": int(agg["most_overtakes_awards"] or 0),
                "races_completed": races_completed,
                "races": races,
                "avg_finish": (float(agg["avg_finish"]) if agg["avg_finish"] is not None else None),
                # advanced
                "ppr": round(total_points / races, 2) if races > 0 else None,
                "points_finish_rate": round(points_finishes / races * 100, 1) if races > 0 else None,
                "finish_rate": round(races_completed / races * 100, 1) if races > 0 else None,
                "pole_to_win_rate": round(pole_wins / poles * 100, 1) if poles > 0 else None,
                "avg_positions_gained": round(float(agg["avg_positions_gained"]), 2) if agg["avg_positions_gained"] is not None else None,
            },
        }
        cache.set(ck, payload, timeout=CACHE_TTL)
        return Response(payload)


class DriverHistoryView(APIView):
    """
    GET /api/drivers/<driver_id>/history/

    Returns a list of season rows (newest -> oldest):
    - season info
    - team (name, display_name, logo)
    - points (base + FL bonus)
    - wins, podiums, poles, fastest laps, DOTDs, cleanest, most-overtakes
    - DNFs, laps, races, races_completed
    - avg_finish, best_finish
    - PoP: % of team points scored by this driver that season
    """
    permission_classes = [AllowAny]

    def get(self, request, driver_id: int, *args, **kwargs):
        ck = key_driver_history(driver_id)
        cached = cache.get(ck)
        if cached is not None:
            return Response(cached)

        # Subquery: total team points for this team_season in this season
        # We compute on RaceResult with points_case (finish position) + fl_bonus_case.
        team_points_subq = (
            RaceResult.objects
            .filter(
                driver_season__team_season=OuterRef("team_season"),
                race__season=OuterRef("season"),
            )
            .annotate(points_row=points_case(prefix="") + fl_bonus_case(prefix=""))
            .values("driver_season__team_season")     # group key
            .annotate(total=Coalesce(Sum("points_row"), 0))
            .values("total")[:1]
        )

        # Subquery: avg positions gained per driver-season
        avg_pg_subq = (
            RaceResult.objects
            .filter(
                driver_season=OuterRef("pk"),
                grid_position__isnull=False,
                finish_position__isnull=False,
                status="FIN",
            )
            .annotate(gained=ExpressionWrapper(
                F("grid_position") - F("finish_position"),
                output_field=FloatField(),
            ))
            .values("driver_season")
            .annotate(avg_pg=Avg("gained"))
            .values("avg_pg")[:1]
        )

        qs = (
            DriverSeason.objects
            .filter(driver_id=driver_id)
            .select_related("driver", "season", "team_season__team")
            # Points (base + FL)
            .annotate(base_points=Coalesce(Sum(points_case()), 0))
            .annotate(fl_bonus=Coalesce(Sum(fl_bonus_case()), 0))
            .annotate(points=F("base_points") + F("fl_bonus"))
            # Counting flags / outcomes
            .annotate(wins=Coalesce(Count("results", filter=Q(results__finish_position=1)), 0))
            .annotate(podiums=Coalesce(Count("results", filter=Q(results__finish_position__lte=3, results__finish_position__isnull=False)), 0))
            .annotate(poles=Coalesce(Count("results", filter=Q(results__pole_position=True)), 0))
            .annotate(fastest_laps=Coalesce(Count("results", filter=Q(results__fastest_lap=True)), 0))
            .annotate(dotds=Coalesce(Count("results", filter=Q(results__dotd=True)), 0))
            .annotate(cleanest_awards=Coalesce(Count("results", filter=Q(results__cleanest_driver=True)), 0))
            .annotate(most_overtakes_awards=Coalesce(Count("results", filter=Q(results__most_overtakes=True)), 0))
            # Volumes
            .annotate(dnfs=Coalesce(Count("results", filter=~Q(results__status="FIN")), 0))
            .annotate(laps=Coalesce(Sum("results__laps_completed"), 0))
            .annotate(races=Coalesce(Count("results"), 0))
            .annotate(races_completed=Coalesce(Count("results", filter=Q(results__status="FIN")), 0))
            # Finishing stats (classified only)
            .annotate(avg_finish=Avg("results__finish_position", filter=Q(results__finish_position__isnull=False)))
            .annotate(best_finish=Min("results__finish_position"))
            # Advanced stats
            .annotate(points_finishes=Coalesce(Count("results", filter=Q(
                results__finish_position__isnull=False, results__finish_position__lte=10)), 0))
            .annotate(pole_wins=Coalesce(Count("results", filter=Q(
                results__pole_position=True, results__finish_position=1)), 0))
            .annotate(avg_positions_gained=Subquery(avg_pg_subq, output_field=FloatField()))
            # Team season presentation
            .annotate(team_name=F("team_season__team__team_name"))
            .annotate(team_logo=F("team_season__team__team_img"))
            .annotate(team_display_name=Coalesce(F("team_season__display_name"), F("team_season__team__team_name")))
            # Team points (same car across drivers)
            .annotate(team_points=Coalesce(Subquery(team_points_subq, output_field=IntegerField()), 0))
            .order_by("-season_id", "id")
        )

        # PoP: share of team points
        # Use ExpressionWrapper so it's a float; avoid division by 0.
        rows = list(qs)
        history: List[Dict[str, Any]] = []
        drv = rows[0].driver if rows else None

        for ds in rows:
            team_points = int(ds.team_points or 0)
            points = int(ds.points or 0)
            races = int(ds.races or 0)
            poles = int(ds.poles or 0)
            races_completed = int(ds.races_completed or 0)
            points_finishes = int(ds.points_finishes or 0)
            pole_wins = int(ds.pole_wins or 0)
            pop_share = (points * 100.0 / team_points) if team_points > 0 else None

            history.append({
                "season": {
                    "id": ds.season_id,
                    "name": getattr(ds.season, "name", None),
                    "year": getattr(ds.season, "year", None),
                },
                "team": {
                    "id": getattr(getattr(ds, "team_season", None), "team_id", None),
                    "name": ds.team_name or "",
                    "display_name": ds.team_display_name or (ds.team_name or ""),
                    "logo_image": ds.team_logo,
                },
                "points": points,
                "points_breakdown": {
                    "base": int(ds.base_points or 0),
                    "fastest_lap_bonus": int(ds.fl_bonus or 0),
                },
                "wins": int(ds.wins or 0),
                "podiums": int(ds.podiums or 0),
                "poles": poles,
                "fastest_laps": int(ds.fastest_laps or 0),
                "dotds": int(ds.dotds or 0),
                "cleanest_awards": int(ds.cleanest_awards or 0),
                "most_overtakes_awards": int(ds.most_overtakes_awards or 0),
                "dnfs": int(ds.dnfs or 0),
                "laps": int(ds.laps or 0),
                "races": races,
                "races_completed": races_completed,
                "avg_finish": float(ds.avg_finish) if ds.avg_finish is not None else None,
                "best_finish": int(ds.best_finish) if ds.best_finish is not None else None,
                "team_points": team_points,
                "pop_share": pop_share,
                # advanced
                "ppr": round(points / races, 2) if races > 0 else None,
                "points_finish_rate": round(points_finishes / races * 100, 1) if races > 0 else None,
                "finish_rate": round(races_completed / races * 100, 1) if races > 0 else None,
                "pole_to_win_rate": round(pole_wins / poles * 100, 1) if poles > 0 else None,
                "avg_positions_gained": round(float(ds.avg_positions_gained), 2) if ds.avg_positions_gained is not None else None,
            })

        payload = {
            "driver": serialize_driver(drv) if drv else None,
            "history": history,
        }
        cache.set(ck, payload, timeout=CACHE_TTL)
        return Response(payload)