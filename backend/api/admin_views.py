from django.db.models import Count, F, Q, Sum
from django.db.models.functions import Coalesce
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from drivers.models import Driver
from entries.models import DriverSeason, TeamSeason
from results.api.views.utils import fl_bonus_case, points_case
from results.models import Race, RaceResult
from seasons.models import Season


class SeasonGridView(APIView):
    """
    GET /api/admin/seasons/<season_id>/grid/
    Returns all driver_seasons for a season with driver + team info.
    Protected: requires token auth.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, season_id: int):
        # Ordered by where each driver currently stands in the season, so a race
        # with no results yet opens close to its likely finishing order and the
        # entry grid needs fewer drags. Car number breaks ties, which is what
        # everyone is on before the season's first race.
        driver_seasons = (
            DriverSeason.objects
            .filter(season_id=season_id)
            .select_related("driver", "team_season__team")
            .annotate(base_points=Coalesce(Sum(points_case()), 0))
            .annotate(fl_points=Coalesce(Sum(fl_bonus_case()), 0))
            .annotate(season_points=F("base_points") + F("fl_points"))
            .order_by("-season_points", "car_number", "driver__last_name")
        )
        data = [
            {
                "driver_season_id": ds.id,
                "car_number": ds.car_number,
                "is_reserve": ds.is_reserve,
                "season_points": ds.season_points,
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
    Returns all races in a season, each carrying how many results it already
    has, so the picker can show what is left to enter.
    Protected: requires token auth.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, season_id: int):
        races = (
            Race.objects
            .filter(season_id=season_id)
            .select_related("track")
            .annotate(result_count=Count("results"))
            .order_by("round", "is_sprint")
        )
        data = [
            {
                "id": r.id,
                "round": r.round,
                "is_sprint": r.is_sprint,
                "laps": r.laps,
                "started_at": r.started_at,
                "result_count": r.result_count,
                "track": {
                    "id": r.track_id,
                    "name": r.track.name,
                    "country": r.track.country,
                },
            }
            for r in races
        ]
        return Response(data)


class SeasonSeatsAdminView(APIView):
    """
    GET  /api/admin/seasons/<season_id>/seats/   — teams and drivers available
                                                   for a new substitute seat
    POST /api/admin/seasons/<season_id>/seats/   — create one

    A substitute holds their own seat at the team they stand in for, so their
    results carry the right constructor. Adding a seat does not enter anyone in
    a race; the per-race grid decides who actually drove.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, season_id: int):
        teams = (
            TeamSeason.objects
            .filter(season_id=season_id)
            .select_related("team")
            .order_by("team__team_name")
        )
        seated = set(
            DriverSeason.objects
            .filter(season_id=season_id)
            .values_list("driver_id", "team_season_id")
        )
        drivers = Driver.objects.order_by("last_name", "first_name")
        return Response({
            "teams": [
                {
                    "team_season_id": ts.id,
                    "name": ts.display_name or ts.team.team_name,
                    "color": ts.color,
                }
                for ts in teams
            ],
            "drivers": [
                {
                    "id": d.id,
                    "name": f"{d.first_name} {d.last_name}".strip(),
                    "human": d.human,
                    # team_seasons this driver already holds a seat at, so the
                    # UI can stop you creating a duplicate
                    "seated_team_season_ids": [
                        ts_id for (drv_id, ts_id) in seated if drv_id == d.id
                    ],
                }
                for d in drivers
            ],
        })

    def post(self, request, season_id: int):
        driver_id = request.data.get("driver_id")
        team_season_id = request.data.get("team_season_id")
        if not driver_id or not team_season_id:
            return Response(
                {"detail": "driver_id and team_season_id are required."}, status=400
            )

        try:
            team_season = TeamSeason.objects.get(pk=team_season_id, season_id=season_id)
        except TeamSeason.DoesNotExist:
            return Response({"detail": "That team is not in this season."}, status=400)
        if not Driver.objects.filter(pk=driver_id).exists():
            return Response({"detail": "Driver not found."}, status=404)

        if DriverSeason.objects.filter(
            season_id=season_id, driver_id=driver_id, team_season=team_season
        ).exists():
            return Response(
                {"detail": "That driver already has a seat at this team for the season."},
                status=400,
            )

        car_number = request.data.get("car_number")
        seat = DriverSeason.objects.create(
            season_id=season_id,
            driver_id=driver_id,
            team_season=team_season,
            car_number=car_number or None,
            is_reserve=bool(request.data.get("is_reserve", True)),
        )
        return Response(
            {
                "driver_season_id": seat.id,
                "driver": str(seat.driver),
                "team": team_season.display_name or team_season.team.team_name,
            },
            status=201,
        )

    def delete(self, request, season_id: int):
        """Remove a seat that was added by mistake. Refuses once it has results."""
        seat_id = request.data.get("driver_season_id")
        try:
            seat = DriverSeason.objects.get(pk=seat_id, season_id=season_id)
        except DriverSeason.DoesNotExist:
            return Response({"detail": "Seat not found."}, status=404)

        used = RaceResult.objects.filter(driver_season=seat).count()
        if used:
            return Response(
                {"detail": f"That seat has {used} result(s). Clear them before removing it."},
                status=400,
            )
        seat.delete()
        return Response(status=204)


class SeasonsAdminView(APIView):
    """
    GET /api/admin/seasons/

    Every season with its game and how many of its races have results, so the
    results page can edit any season rather than a hardcoded current one.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        seasons = (
            Season.objects
            .annotate(
                race_count=Count("races", distinct=True),
                entered=Count("races", filter=Q(races__results__isnull=False), distinct=True),
            )
            .order_by("-id")
        )
        return Response([
            {
                "id": s.id,
                "game": getattr(s, "game", "") or "",
                "race_count": s.race_count,
                "races_entered": s.entered,
            }
            for s in seasons
        ])
