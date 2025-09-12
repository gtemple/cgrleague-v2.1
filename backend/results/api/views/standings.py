from typing import Any, Dict, List
from django.db.models import Sum, F, Avg, Value, Q, FloatField
from django.db.models.functions import Coalesce
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from entries.models import DriverSeason
from results.models import RaceResult
from .utils import points_case, fl_bonus_case, serialize_team


class ConstructorStandingsView(APIView):
    """
    Sum team points for a season.
    Scoring: 25-18-15-12-10-8-6-4-2-1 +1 for fastest lap (any position).
    Tie-breaker: lower average finish (better) wins; unknown averages sort last.
    """
    def get(self, request, season_id: int, *args, **kwargs):
        base_pts = points_case(prefix="")  # RaceResult fields live on this model
        fl_bonus = fl_bonus_case(prefix="")

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

        data: List[Dict[str, Any]] = []
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
                # If you want to expose it to the UI later, uncomment the next line:
                # "avg_finish": row["avg_finish"],
            })

        return Response(data)


class SeasonStandingsView(APIView):
    """
    Driver standings with tie-breaker on average finish (lower is better).
    """
    def get(self, request, season_id: int, *args, **kwargs):
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
            .annotate(avg_finish_norm=Coalesce("avg_finish", Value(1e9)))
            .order_by(
                "-points",
                "avg_finish_norm",  # lower is better; unknowns last
                "driver__last_name",
                "driver__first_name",
                "id",
            )
        )

        data = []
        for ds in qs:
            team_name = None
            team_id = None
            team_logo = None
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
                    "display_name": (
                        f"{getattr(drv, 'first_name', '') or ''} {getattr(drv, 'last_name', '') or ''}"
                    ).strip() or getattr(drv, "name", ""),
                    "profile_image": getattr(drv, "profile_image", None),
                },
                "team": {
                    "id": team_id,
                    "name": team_name,
                    "logo_image": team_logo
                },
                # If you want to surface it to the UI, you can add:
                # "avg_finish": ds.avg_finish,
            })

        return Response(data, status=status.HTTP_200_OK)
