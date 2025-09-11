from typing import Any, Dict, List, Optional
from django.db.models import Count, Q
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from seasons.models import Season
from entries.models import DriverSeason
from results.models import Race, RaceResult
from results.scoring import points_for_result
from .utils import (
    serialize_race_basic, serialize_track, serialize_driver, serialize_team, initials_for
)

class SeasonLastRaceView(APIView):
    """
    Returns:
      - last_race: top 3 classified results from the most recent race that has results
      - next_race: the next upcoming race (earliest race after `last_race` with 0 results),
                   or the first race if the season hasn't started yet.
    Optional query:
      ?include_sprints=1
    """
    permission_classes = [AllowAny]

    def get(self, request, season_id: int, *args, **kwargs):
        include_sprints = str(request.GET.get("include_sprints", "")).lower() in ("1", "true", "yes")

        races_qs = (
            Race.objects
            .filter(season_id=season_id)
            .select_related("track")
            .order_by("round", "is_sprint")
        )
        if not include_sprints:
            races_qs = races_qs.filter(is_sprint=False)

        races = list(races_qs)
        if not races:
            return Response({
                "season_id": int(season_id),
                "include_sprints": include_sprints,
                "last_race": None,
                "next_race": None,
            })

        last_race = (
            Race.objects
            .filter(id__in=[r.id for r in races], results__isnull=False)
            .order_by("round", "is_sprint")
            .last()
        )

        last_race_payload = None
        if last_race:
            top3 = (
                RaceResult.objects
                .filter(race=last_race, finish_position__isnull=False)
                .select_related(
                    "driver_season__driver",
                    "driver_season__team_season__team",
                    "race__track",
                )
                .order_by("finish_position")[:3]
            )

            last_race_payload = {
                "race": {
                    "id": last_race.id,
                    "round": last_race.round,
                    "is_sprint": last_race.is_sprint,
                    "track": {
                        "id": last_race.track_id,
                        "name": getattr(last_race.track, "name", ""),
                        "city": getattr(last_race.track, "city", ""),
                        "country": getattr(last_race.track, "country", ""),
                        "image": getattr(last_race.track, "img", None),
                    },
                },
                "results": [
                    {
                        "finish_position": rr.finish_position,
                        "status": rr.status,
                        "fastest_lap": rr.fastest_lap,
                        "dotd": rr.dotd,
                        "points": points_for_result(rr),
                        "driver": serialize_driver(rr.driver_season.driver),
                        "team": serialize_team(getattr(getattr(rr.driver_season, "team_season", None), "team", None)),
                    }
                    for rr in top3
                ],
            }

        next_race = None
        if last_race:
            next_race = (
                Race.objects
                .filter(id__in=[r.id for r in races])
                .filter(
                    Q(round__gt=last_race.round) |
                    (Q(round=last_race.round) & Q(is_sprint__gt=last_race.is_sprint))
                )
                .annotate(result_count=Count("results"))
                .filter(result_count=0)
                .order_by("round", "is_sprint")
                .first()
            )
        else:
            next_race = (
                Race.objects
                .filter(id__in=[r.id for r in races])
                .annotate(result_count=Count("results"))
                .filter(result_count=0)
                .order_by("round", "is_sprint")
                .first()
            )

        next_race_payload = None
        if next_race:
            next_race_payload = {
                "race": {
                    "id": next_race.id,
                    "round": next_race.round,
                    "is_sprint": next_race.is_sprint,
                    "track": {
                        "id": next_race.track_id,
                        "name": getattr(next_race.track, "name", ""),
                        "city": getattr(next_race.track, "city", ""),
                        "country": getattr(next_race.track, "country", ""),
                        "image": getattr(next_race.track, "img", None),
                    },
                }
            }

        return Response({
            "season_id": int(season_id),
            "include_sprints": include_sprints,
            "last_race": last_race_payload,
            "next_race": next_race_payload,
        })


# ---------- NextRaceTeaser (with following_two) ----------

def _last_winner_for_track(track_id: int) -> Optional[Dict[str, Any]]:
    """
    Most recent non-sprint winner at this track in a prior season.
    Returns {driver, team, race_id} or None.
    """
    past_races = (
        Race.objects
        .filter(track_id=track_id, is_sprint=False)
        .order_by("-season__id", "-round")[:6]
    )
    if not past_races:
        return None

    rr = (
        RaceResult.objects
        .filter(race__in=past_races, finish_position=1)
        .select_related("driver_season__driver", "driver_season__team_season__team", "race")
        .order_by("-race__season__id", "-race__round")
        .first()
    )
    if not rr:
        return None

    return {
        "driver": serialize_driver(rr.driver_season.driver),
        "team": serialize_team(getattr(getattr(rr.driver_season, "team_season", None), "team", None)),
        "race_id": rr.race_id,
    }


class NextRaceTeaserView(APIView):
    """
    GET /api/teasers/next-race/?include_sprints=0|1

    Returns (existing keys + following_two):
    {
      "season_id": <int>,
      "upcoming_race": {...},
      "recent_winners": [...],
      "following_two": [
        { "event": {...}, "last_winner": {...}|null },
        { "event": {...}, "last_winner": {...}|null }
      ]
    }
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        include_sprints = str(request.GET.get("include_sprints", "")).lower() in ("1", "true", "yes")

        latest_season = Season.objects.order_by("-id").first()
        if not latest_season:
            return Response({
                "season_id": None,
                "upcoming_race": None,
                "recent_winners": [],
                "following_two": [],
            })

        races_qs = Race.objects.filter(season=latest_season).select_related("track")
        if not include_sprints:
            races_qs = races_qs.filter(is_sprint=False)

        upcoming = (
            races_qs
            .annotate(result_count=Count("results"))
            .filter(result_count=0)
            .order_by("round", "is_sprint")
            .first()
        )

        upcoming_payload = None
        recent_winners: List[Dict[str, Any]] = []
        following_two: List[Dict[str, Any]] = []

        if upcoming:
            t = upcoming.track
            upcoming_payload = {
                "season_id": latest_season.id,
                "race": {
                    "id": upcoming.id,
                    "round": upcoming.round,
                    "is_sprint": upcoming.is_sprint,
                },
                "track": serialize_track(t),
            }

            prev_seasons = list(Season.objects.filter(id__lt=latest_season.id).order_by("-id"))
            for s in prev_seasons:
                race = (
                    Race.objects
                    .filter(season=s, track_id=upcoming.track_id, is_sprint=False)
                    .order_by("round")
                    .first()
                )
                if not race:
                    continue

                rr = (
                    RaceResult.objects
                    .filter(race=race, finish_position=1)
                    .select_related("driver_season__driver", "driver_season__team_season__team")
                    .first()
                )
                if not rr:
                    continue

                recent_winners.append({
                    "season_id": s.id,
                    "driver": serialize_driver(rr.driver_season.driver),
                    "team": serialize_team(getattr(getattr(rr.driver_season, "team_season", None), "team", None)),
                    "race_id": race.id,
                })
                if len(recent_winners) >= 5:
                    break

            # NEW: following two races after 'upcoming'
            next_two = (
                Race.objects
                .filter(season=latest_season)
                .filter(
                    Q(round__gt=upcoming.round) |
                    (Q(round=upcoming.round) & Q(is_sprint__gt=upcoming.is_sprint))
                )
                .select_related("track")
                .order_by("round", "is_sprint")[:6]
            )
            for ev in next_two:
                following_two.append({
                    "event": serialize_race_basic(ev),
                    "last_winner": _last_winner_for_track(ev.track_id),
                })

        print("DBG NextRaceTeaserView -> following_two len:", len(following_two))

        return Response({
            "season_id": latest_season.id if latest_season else None,
            "upcoming_race": upcoming_payload,
            "recent_winners": recent_winners,
            "following_two": following_two,
        })
