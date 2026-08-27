from collections import defaultdict

from django.core.cache import cache
from django.db.models import Sum
from django.db.models.functions import Coalesce
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.exceptions import NotFound

from entries.models import DriverSeason
from results.models import Race, RaceResult
from results.api.views.utils import points_case, fl_bonus_case
from results.cache import CACHE_TTL, key_timeline
from seasons.models import Season


@api_view(["GET"])
def championship_timeline(request, season_id):
    try:
        season = Season.objects.get(pk=season_id)
    except Season.DoesNotExist:
        raise NotFound("Season not found")

    ck = key_timeline(season_id)
    cached = cache.get(ck)
    if cached is not None:
        return Response(cached)

    # All races in order — each sprint counts as a separate data point
    races = list(
        Race.objects
        .filter(season=season)
        .select_related("track")
        .order_by("round", "is_sprint")
    )
    if not races:
        return Response({"races": [], "drivers": []})

    # All results for this season in one query, annotated with points earned
    results_qs = (
        RaceResult.objects
        .filter(race__season=season)
        .values("driver_season_id", "race_id")
        .annotate(
            pts=Coalesce(Sum(points_case(prefix="")), 0)
              + Coalesce(Sum(fl_bonus_case(prefix="")), 0)
        )
    )

    # {driver_season_id: {race_id: pts}}
    pts_by_driver = defaultdict(lambda: defaultdict(int))
    for row in results_qs:
        pts_by_driver[row["driver_season_id"]][row["race_id"]] = row["pts"]

    # Set of race IDs that have at least one result
    completed_race_ids = set(row["race_id"] for row in results_qs)

    # Find the last completed race index
    last_raced_index = -1
    for i, race in enumerate(races):
        if race.id in completed_race_ids:
            last_raced_index = i

    # All drivers in the season. A driver can hold more than one seat — a
    # substitute keeps their own drive and stands in elsewhere — so seats are
    # folded into one line per driver, matching the standings.
    driver_seasons = (
        DriverSeason.objects
        .filter(season=season)
        .select_related("driver", "team_season__team")
    )

    seats_by_driver = defaultdict(list)
    for ds in driver_seasons:
        seats_by_driver[ds.driver_id].append(ds)

    # seat -> index of the last race it has a result for, so a combined line is
    # labelled with the team that driver most recently drove for
    raced_index = {
        ds.id: max(
            (i for i, race in enumerate(races) if race.id in pts_by_driver[ds.id]),
            default=-1,
        )
        for ds in driver_seasons
    }

    drivers_data = []
    for driver_id, seats in seats_by_driver.items():
        driver = seats[0].driver
        cumulative = 0
        points_by_race = []
        for i, race in enumerate(races):
            if i <= last_raced_index:
                cumulative += sum(pts_by_driver[ds.id].get(race.id, 0) for ds in seats)
                points_by_race.append(cumulative)
            else:
                # Future race — null so the line stops here
                points_by_race.append(None)

        seat = max(seats, key=lambda ds: (raced_index[ds.id], ds.id))
        team_name = (
            seat.team_season.team.team_name
            if seat.team_season and seat.team_season.team else "—"
        )
        final_points = points_by_race[last_raced_index] if last_raced_index >= 0 else 0
        drivers_data.append({
            "id": driver_id,
            "name": f"{driver.first_name} {driver.last_name}".strip(),
            "team": team_name,
            "is_human": driver.human,
            "points_by_race": points_by_race,
            "final_points": final_points or 0,
        })

    # Sort by final points descending
    drivers_data.sort(key=lambda x: -x["final_points"])

    races_data = [
        {
            "round": r.round,
            "is_sprint": r.is_sprint,
            "track_name": r.track.name,
            "label": f"R{r.round}" + (" (S)" if r.is_sprint else ""),
            "completed": r.id in completed_race_ids,
        }
        for r in races
    ]

    data = {"races": races_data, "drivers": drivers_data}
    cache.set(ck, data, timeout=CACHE_TTL)
    return Response(data)
