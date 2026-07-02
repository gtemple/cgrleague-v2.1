# tracks/api/views.py
from typing import Dict, Any, List
from collections import defaultdict

from django.core.cache import cache
from django.db.models import Count, Sum, Q
from django.db.models.functions import Coalesce
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.generics import ListAPIView

from tracks.models import Track
from results.models import Race, RaceResult
from results.scoring import points_for_result

# If you already have these utils, reuse them for consistency.
# Fall back to small inlines if you prefer not to cross-import.
from results.api.views.utils import serialize_driver  # adjust path if needed
from results.cache import CACHE_TTL, key_track_stats
from .serializers import TrackLiteSerializer


def _serialize_track_full(track: Track) -> Dict[str, Any]:
    return {
        "id": track.id,
        "name": getattr(track, "name", ""),
        "city": getattr(track, "city", ""),
        "country": getattr(track, "country", ""),
        "image": getattr(track, "img", None),
        "bio": getattr(track, "bio", None),
        "distance": getattr(track, "distance", None),
    }


class TrackListView(ListAPIView):
    """
    GET /api/tracks/  ->  [{ id, name, city, country, image }, ...] sorted A→Z
    """
    permission_classes = [AllowAny]
    serializer_class = TrackLiteSerializer

    def get_queryset(self):
        return Track.objects.all().order_by("name")

class TrackDriverStatsView(APIView):
    """
    GET /api/tracks/{track_id}/stats/?include_sprints=0|1&order_by=points|laps|wins|podiums|dnfs|dotds|fastest_laps|avg_finish|driver&direction=asc|desc

    Returns:
    {
      "track": {...},
      "include_sprints": false,
      "order": {"by":"points","direction":"desc"},
      "drivers": [
        {
          "driver": {...},
          "total_points": 0,
          "total_laps": 0,
          "wins": 0,
          "podiums": 0,
          "dnfs": 0,
          "dotds": 0,
          "fastest_laps": 0,
          "avg_finish_position": 12.5,
          "races_count": 3
        },
        ...
      ]
    }
    """
    permission_classes = [AllowAny]

    def get(self, request, track_id: int, *args, **kwargs):
        include_sprints = str(request.GET.get("include_sprints", "")).lower() in ("1", "true", "yes")

        # Sorting controls (applied after cache lookup — sorting is cheap Python)
        order_by = (request.GET.get("order_by") or "points").lower()
        direction = (request.GET.get("direction") or "desc").lower()
        if direction not in ("asc", "desc"):
            direction = "desc"

        # Validate order_by
        allowed = {
            "points": "total_points",
            "laps": "total_laps",
            "wins": "wins",
            "podiums": "podiums",
            "dnfs": "dnfs",
            "dotds": "dotds",
            "fastest_laps": "fastest_laps",
            "avg_finish": "avg_finish_position",
            "driver": "driver_sort_key",
        }
        sort_key_name = allowed.get(order_by, "total_points")

        # Track
        try:
            track = Track.objects.get(pk=track_id)
        except Track.DoesNotExist:
            return Response(
                {
                    "track": None,
                    "include_sprints": include_sprints,
                    "order": {"by": order_by, "direction": direction},
                    "drivers": [],
                }
            )

        # Races at this track
        races_qs = Race.objects.filter(track_id=track_id)
        if not include_sprints:
            races_qs = races_qs.filter(is_sprint=False)

        race_ids = list(races_qs.values_list("id", flat=True))
        if not race_ids:
            return Response(
                {
                    "track": _serialize_track_full(track),
                    "include_sprints": include_sprints,
                    "order": {"by": order_by, "direction": direction},
                    "drivers": [],
                }
            )

        ck = key_track_stats(track_id, include_sprints)
        rows = cache.get(ck)

        if rows is None:
            results_qs = (
                RaceResult.objects
                .filter(race_id__in=race_ids)
                .select_related(
                    "driver_season__driver",
                    "driver_season__team_season__team",
                    "race",
                )
            )

            # Aggregate per driver (cross-season)
            agg: Dict[int, Dict[str, Any]] = {}
            finishes_for_avg: Dict[int, List[int]] = defaultdict(list)

            for rr in results_qs:
                drv = rr.driver_season.driver
                drv_id = drv.id
                row = agg.get(drv_id)
                if row is None:
                    row = {
                        "driver": serialize_driver(drv),
                        "total_points": 0,
                        "total_laps": 0,
                        "wins": 0,
                        "podiums": 0,
                        "dnfs": 0,
                        "dotds": 0,
                        "fastest_laps": 0,
                        "races_count": 0,
                        "driver_sort_key": (getattr(drv, "last_name", "") or "").lower()
                                           + " "
                                           + (getattr(drv, "first_name", "") or "").lower(),
                    }
                    agg[drv_id] = row

                row["races_count"] += 1
                row["total_points"] += int(points_for_result(rr))

                laps = getattr(rr, "laps_completed", None)
                if laps is None:
                    laps = getattr(rr, "laps", 0)
                row["total_laps"] += int(laps or 0)

                fp = rr.finish_position
                status = (rr.status or "").upper() if rr.status else None

                if fp is not None:
                    if fp == 1:
                        row["wins"] += 1
                    if fp in (1, 2, 3):
                        row["podiums"] += 1
                    finishes_for_avg[drv_id].append(int(fp))

                if status and status != "FIN":
                    row["dnfs"] += 1
                if getattr(rr, "dotd", False):
                    row["dotds"] += 1
                if getattr(rr, "fastest_lap", False):
                    row["fastest_laps"] += 1

            rows = []
            for drv_id, row in agg.items():
                finishes = finishes_for_avg.get(drv_id, [])
                row["avg_finish_position"] = (sum(finishes) / len(finishes)) if finishes else None
                rows.append(row)
            cache.set(ck, rows, timeout=CACHE_TTL)

        # sorting
        def _key(r):
            v = r.get(sort_key_name)
            # For avg_finish, None should go to the end regardless of direction
            if sort_key_name == "avg_finish_position":
                return (v is None, v if v is not None else 10**9)
            # Generic: put None last
            return (v is None, v)

        rows.sort(key=_key, reverse=(direction == "desc"))

        return Response(
            {
                "track": _serialize_track_full(track),
                "include_sprints": include_sprints,
                "order": {"by": order_by, "direction": direction},
                "drivers": rows,
            }
        )


class TracksHomepageView(APIView):
    """
    GET /api/tracks/homepage/
    Returns everything needed for the tracks index page:
      - all_tracks: every track with races_count and total_laps
      - records: track with most races held, track with most total laps
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        # Races count per track (non-sprint only)
        races_by_track = {
            row["track_id"]: row["races_count"]
            for row in Race.objects
            .filter(is_sprint=False)
            .values("track_id")
            .annotate(races_count=Count("id"))
        }

        # Total laps_completed per track (non-sprint)
        laps_by_track = {
            row["race__track_id"]: int(row["total_laps"])
            for row in RaceResult.objects
            .filter(race__is_sprint=False)
            .values("race__track_id")
            .annotate(total_laps=Coalesce(Sum("laps_completed"), 0))
        }

        all_tracks = []
        for track in Track.objects.all().order_by("name"):
            all_tracks.append({
                "id": track.id,
                "name": track.name,
                "city": track.city,
                "country": track.country,
                "image": track.img or None,
                "races_count": races_by_track.get(track.id, 0),
                "total_laps": laps_by_track.get(track.id, 0),
            })

        # Sort by most-raced first
        all_tracks.sort(key=lambda x: -x["races_count"])

        def track_record(field):
            candidates = [t for t in all_tracks if t[field] > 0]
            if not candidates:
                return None
            best = max(candidates, key=lambda t: t[field])
            return {"track": best, "value": best[field]}

        records = {
            "most_races": track_record("races_count"),
            "most_laps": track_record("total_laps"),
        }

        return Response({
            "all_tracks": all_tracks,
            "records": records,
        })
