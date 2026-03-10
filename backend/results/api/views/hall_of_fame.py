from typing import Any, Dict, List
from django.db.models import Sum, Count, Q, F, FloatField, Value, Avg
from django.db.models.functions import Coalesce
from rest_framework.views import APIView
from rest_framework.response import Response
from results.models import RaceResult
from drivers.models import Driver
from seasons.models import Season
from entries.models import DriverSeason
from .utils import points_case, fl_bonus_case


class HallOfFameView(APIView):
    """
    All-time statistics for drivers.
    Includes wins, podiums, points, awards, and championships.
    """
    def get(self, request, *args, **kwargs):
        only_human = request.query_params.get("only_human") == "true"

        # 1. Base query for drivers
        drivers_qs = Driver.objects.all()
        if only_human:
            drivers_qs = drivers_qs.filter(human=True)

        # 2. Get race-level stats (Wins, Podiums, Awards, Points)
        points_expr = points_case() + fl_bonus_case()
        
        metrics = drivers_qs.annotate(
            total_wins=Count("results", filter=Q(results__finish_position=1)),
            total_podiums=Count("results", filter=Q(results__finish_position__lte=3)),
            total_points=Coalesce(Sum(points_expr), 0),
            total_fastest_laps=Count("results", filter=Q(results__fastest_lap=True)),
            total_dotd=Count("results", filter=Q(results__dotd=True)),
            total_clean_driver=Count("results", filter=Q(results__cleanest_driver=True)),
            total_overtakes=Count("results", filter=Q(results__most_overtakes=True)),
        ).values(
            "id", "first_name", "last_name", "driver_img",
            "total_wins", "total_podiums", "total_points",
            "total_fastest_laps", "total_dotd", "total_clean_driver", "total_overtakes"
        )

        # 3. Calculate Championships
        # We need to find the #1 driver for each season.
        championships_map = {} # driver_id -> count
        seasons = Season.objects.all()
        for season in seasons:
            winner = (
                DriverSeason.objects.filter(season=season)
                .annotate(
                    points=Coalesce(Sum(points_case()), 0) + Coalesce(Sum(fl_bonus_case()), 0),
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

        # 4. Combine data
        data = []
        for d in metrics:
            d["total_championships"] = championships_map.get(d["id"], 0)
            data.append(d)

        return Response(data)
