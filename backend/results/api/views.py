# results/api/views.py
from django.db.models import Case, When, Value, IntegerField, Sum, F, Q
from django.db.models.functions import Coalesce
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from entries.models import DriverSeason
from results.models import RaceResult

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
