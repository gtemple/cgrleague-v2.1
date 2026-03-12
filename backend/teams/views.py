from django.core.cache import cache
from django.http import JsonResponse
from django.db.models import Sum, Count, Case, When, Value, IntegerField, Q, F
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Team
from entries.models import TeamSeason, DriverSeason
from results.models import RaceResult
from results.api.views.utils import points_case, fl_bonus_case, serialize_driver
from results.cache import CACHE_TTL, key_team_detail


def list_teams(request):
    data = list(Team.objects.values("id", "team_name", "country", "founded", "team_img"))
    return JsonResponse({"teams": data})


class TeamDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, team_id: int, *args, **kwargs):
        ck = key_team_detail(team_id)
        cached = cache.get(ck)
        if cached is not None:
            return Response(cached)

        team = get_object_or_404(Team, pk=team_id)

        # Career totals across all seasons
        career_rr = RaceResult.objects.filter(driver_season__team_season__team_id=team_id)
        career_agg = career_rr.aggregate(
            base_points=Coalesce(Sum(points_case(prefix="")), 0),
            fl_points=Coalesce(Sum(fl_bonus_case(prefix="")), 0),
            wins=Count(Case(When(finish_position=1, then=1), output_field=IntegerField())),
            podiums=Count(Case(
                When(finish_position__isnull=False, finish_position__lte=3, then=1),
                output_field=IntegerField(),
            )),
            poles=Count(Case(When(pole_position=True, then=1), output_field=IntegerField())),
            fastest_laps=Count(Case(When(fastest_lap=True, then=1), output_field=IntegerField())),
            dotds=Count(Case(When(dotd=True, then=1), output_field=IntegerField())),
            races=Count("id"),
        )
        career_points = int(career_agg["base_points"]) + int(career_agg["fl_points"])
        unique_drivers = (
            DriverSeason.objects
            .filter(team_season__team_id=team_id)
            .values("driver_id")
            .distinct()
            .count()
        )

        # Season history
        team_seasons = (
            TeamSeason.objects
            .filter(team_id=team_id)
            .select_related("season", "team")
            .order_by("-season_id")
        )

        seasons_data = []
        for ts in team_seasons:
            ts_rr = RaceResult.objects.filter(driver_season__team_season=ts)
            ts_agg = ts_rr.aggregate(
                base_points=Coalesce(Sum(points_case(prefix="")), 0),
                fl_points=Coalesce(Sum(fl_bonus_case(prefix="")), 0),
                wins=Count(Case(When(finish_position=1, then=1), output_field=IntegerField())),
                podiums=Count(Case(
                    When(finish_position__isnull=False, finish_position__lte=3, then=1),
                    output_field=IntegerField(),
                )),
                poles=Count(Case(When(pole_position=True, then=1), output_field=IntegerField())),
                fastest_laps=Count(Case(When(fastest_lap=True, then=1), output_field=IntegerField())),
                races=Count("id"),
            )
            season_pts = int(ts_agg["base_points"]) + int(ts_agg["fl_points"])

            # Championship position: count teams with more points this season
            teams_ahead = (
                RaceResult.objects
                .filter(race__season=ts.season)
                .exclude(driver_season__team_season=ts)
                .annotate(pts_row=points_case(prefix="") + fl_bonus_case(prefix=""))
                .values("driver_season__team_season_id")
                .annotate(team_pts=Sum("pts_row"))
                .filter(team_pts__gt=season_pts)
                .count()
            )
            champ_pos = teams_ahead + 1

            # Drivers this season with their points
            driver_seasons = (
                DriverSeason.objects
                .filter(team_season=ts)
                .select_related("driver")
                .annotate(
                    base_pts=Coalesce(Sum(points_case()), 0),
                    fl_pts=Coalesce(Sum(fl_bonus_case()), 0),
                )
                .annotate(drv_points=F("base_pts") + F("fl_pts"))
                .order_by("-drv_points")
            )

            drivers_list = []
            for ds in driver_seasons:
                drivers_list.append({
                    **serialize_driver(ds.driver),
                    "points": int(ds.drv_points or 0),
                    "driver_season_id": ds.id,
                })

            seasons_data.append({
                "season": {"id": ts.season_id},
                "display_name": ts.display_name or team.team_name,
                "color": ts.color or "",
                "points": season_pts,
                "wins": int(ts_agg["wins"]),
                "podiums": int(ts_agg["podiums"]),
                "poles": int(ts_agg["poles"]),
                "fastest_laps": int(ts_agg["fastest_laps"]),
                "races": int(ts_agg["races"]),
                "champ_pos": champ_pos,
                "drivers": drivers_list,
            })

        data = {
            "team": {
                "id": team.id,
                "name": team.team_name,
                "country": team.country or "",
                "founded": team.founded,
                "logo_image": team.team_img,
            },
            "career": {
                "points": career_points,
                "wins": int(career_agg["wins"]),
                "podiums": int(career_agg["podiums"]),
                "poles": int(career_agg["poles"]),
                "fastest_laps": int(career_agg["fastest_laps"]),
                "dotds": int(career_agg["dotds"]),
                "races": int(career_agg["races"]),
                "seasons": len(seasons_data),
                "drivers": unique_drivers,
            },
            "seasons": seasons_data,
        }
        cache.set(ck, data, timeout=CACHE_TTL)
        return Response(data)
