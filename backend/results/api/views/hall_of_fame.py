from typing import Any, Dict, List
from django.core.cache import cache
from django.db.models import Sum, Count, Q, F, FloatField, Value, Avg
from django.db.models.functions import Coalesce
from rest_framework.views import APIView
from rest_framework.response import Response
from results.models import RaceResult
from drivers.models import Driver
from seasons.models import Season
from entries.models import DriverSeason
from results.cache import CACHE_TTL, key_hof
from .utils import points_case, fl_bonus_case


def _serialize_driver_brief(ds):
    drv = ds.driver
    return {
        "id": drv.id,
        "first_name": drv.first_name or "",
        "last_name": drv.last_name or "",
        "profile_image": drv.profile_image,
    }


class HallOfFameView(APIView):
    """
    All-time statistics for drivers plus single-season records.
    """
    def get(self, request, *args, **kwargs):
        only_human = request.query_params.get("only_human") == "true"
        include_ai = request.query_params.get("include_ai", "true").lower() == "true"

        ck = key_hof(only_human, include_ai)
        cached = cache.get(ck)
        if cached is not None:
            return Response(cached)

        human_filter = only_human or not include_ai

        # ── 1. Career driver metrics ──────────────────────────────────────────
        drivers_qs = Driver.objects.all()
        if human_filter:
            drivers_qs = drivers_qs.filter(human=True)

        points_expr = points_case("season_entries__results__") + fl_bonus_case("season_entries__results__")

        metrics = drivers_qs.annotate(
            total_wins=Count("season_entries__results", filter=Q(season_entries__results__finish_position=1)),
            total_podiums=Count("season_entries__results", filter=Q(season_entries__results__finish_position__lte=3)),
            total_points=Coalesce(Sum(points_expr), 0),
            total_fastest_laps=Count("season_entries__results", filter=Q(season_entries__results__fastest_lap=True)),
            total_poles=Count("season_entries__results", filter=Q(season_entries__results__pole_position=True)),
            total_dotd=Count("season_entries__results", filter=Q(season_entries__results__dotd=True)),
            total_clean_driver=Count("season_entries__results", filter=Q(season_entries__results__cleanest_driver=True)),
            total_overtakes=Count("season_entries__results", filter=Q(season_entries__results__most_overtakes=True)),
        ).values(
            "id", "first_name", "last_name", "profile_image",
            "total_wins", "total_podiums", "total_points", "total_poles",
            "total_fastest_laps", "total_dotd", "total_clean_driver", "total_overtakes",
        )

        # ── 2. Championships ──────────────────────────────────────────────────
        championships_map = {}
        season_champions: List[Dict[str, Any]] = []
        for season in Season.objects.order_by("-id"):
            winner = (
                DriverSeason.objects.filter(season=season)
                .select_related("driver", "team_season__team")
                .annotate(
                    points=Coalesce(Sum(points_case("results__")), 0) + Coalesce(Sum(fl_bonus_case("results__")), 0),
                    avg_finish=Avg(
                        "results__finish_position",
                        filter=Q(results__finish_position__isnull=False),
                        output_field=FloatField(),
                    )
                )
                .annotate(avg_finish_norm=Coalesce("avg_finish", Value(1e9)))
                .order_by("-points", "avg_finish_norm")
                .first()
            )
            if winner:
                championships_map[winner.driver_id] = championships_map.get(winner.driver_id, 0) + 1
                team = winner.team_season.team if winner.team_season else None
                season_champions.append({
                    "season_id": season.id,
                    "driver": _serialize_driver_brief(winner),
                    "team": {
                        "id": team.id if team else None,
                        "name": team.team_name if team else None,
                        "color": (winner.team_season.color or None) if winner.team_season else None,
                    },
                })

        drivers = []
        for d in metrics:
            d["total_championships"] = championships_map.get(d["id"], 0)
            drivers.append(d)

        # ── 3. Single-season bests ────────────────────────────────────────────
        ds_qs = DriverSeason.objects.select_related("driver", "season")
        if human_filter:
            ds_qs = ds_qs.filter(driver__human=True)

        best_wins_ds = (
            ds_qs
            .annotate(season_wins=Count("results", filter=Q(results__finish_position=1)))
            .order_by("-season_wins")
            .first()
        )

        best_points_ds = (
            ds_qs
            .annotate(
                base_pts=Coalesce(Sum(points_case()), 0),
                fl_pts=Coalesce(Sum(fl_bonus_case()), 0),
            )
            .annotate(season_points=F("base_pts") + F("fl_pts"))
            .order_by("-season_points")
            .first()
        )

        best_poles_ds = (
            ds_qs
            .annotate(season_poles=Count("results", filter=Q(results__pole_position=True)))
            .order_by("-season_poles")
            .first()
        )

        def _best(ds, value_field):
            if not ds:
                return None
            return {
                "driver": _serialize_driver_brief(ds),
                "season_id": ds.season_id,
                "value": int(getattr(ds, value_field) or 0),
            }

        season_bests = {
            "most_wins":   _best(best_wins_ds,   "season_wins"),
            "most_points": _best(best_points_ds, "season_points"),
            "most_poles":  _best(best_poles_ds,  "season_poles"),
        }

        payload = {"drivers": drivers, "season_bests": season_bests, "season_champions": season_champions}
        cache.set(ck, payload, timeout=CACHE_TTL)
        return Response(payload)
