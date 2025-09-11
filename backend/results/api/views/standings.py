from typing import Any, Dict, List
from django.db.models import Sum, F
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
    """
    def get(self, request, season_id: int, *args, **kwargs):
        base_pts = points_case(prefix="")  # RaceResult has finish_position on itself
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
            .annotate(points=Sum("points_row"))
            .order_by("-points", "driver_season__team_season__team__team_name")
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
            })

        return Response(data)


class SeasonStandingsView(APIView):
    def get(self, request, season_id: int, *args, **kwargs):
        qs = (
            DriverSeason.objects
            .filter(season_id=season_id)
            .select_related("driver", "team_season__team")
            .annotate(base_points=Coalesce(Sum(points_case()), 0))
            .annotate(fl_bonus=Coalesce(Sum(fl_bonus_case()), 0))
            .annotate(points=F("base_points") + F("fl_bonus"))
            .order_by("-points", "driver__last_name", "driver__first_name", "id")
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
