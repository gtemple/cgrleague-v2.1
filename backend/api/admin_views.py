from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from entries.models import DriverSeason
from results.models import Race


class SeasonGridView(APIView):
    """
    GET /api/admin/seasons/<season_id>/grid/
    Returns all driver_seasons for a season with driver + team info.
    Protected: requires token auth.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, season_id: int):
        driver_seasons = (
            DriverSeason.objects
            .filter(season_id=season_id)
            .select_related("driver", "team_season__team")
            .order_by("car_number", "driver__last_name")
        )
        data = [
            {
                "driver_season_id": ds.id,
                "car_number": ds.car_number,
                "is_reserve": ds.is_reserve,
                "driver": {
                    "id": ds.driver_id,
                    "first_name": ds.driver.first_name,
                    "last_name": ds.driver.last_name,
                },
                "team": {
                    "id": ds.team_season.team_id,
                    "name": ds.team_season.display_name or ds.team_season.team.team_name,
                    "color": ds.team_season.color,
                },
            }
            for ds in driver_seasons
        ]
        return Response(data)


class SeasonRacesAdminView(APIView):
    """
    GET /api/admin/seasons/<season_id>/races/
    Returns all races in a season (id, round, is_sprint, track name, started_at).
    Protected: requires token auth.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, season_id: int):
        races = (
            Race.objects
            .filter(season_id=season_id)
            .select_related("track")
            .order_by("round", "is_sprint")
        )
        data = [
            {
                "id": r.id,
                "round": r.round,
                "is_sprint": r.is_sprint,
                "laps": r.laps,
                "started_at": r.started_at,
                "track": {
                    "id": r.track_id,
                    "name": r.track.name,
                    "country": r.track.country,
                },
            }
            for r in races
        ]
        return Response(data)
