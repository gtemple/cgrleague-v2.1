from typing import Any, Dict, List
from django.db.models import Count, Q
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from entries.models import DriverSeason
from results.models import Race, RaceResult
from results.scoring import points_for_result
from .utils import initials_for

class SeasonResultsMatrixView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, season_id: int):
        include_sprints = str(request.GET.get("include_sprints", "")).lower() in ("1", "true", "yes")

        races_qs = (
            Race.objects.filter(season_id=season_id)
            .select_related("track")
            .order_by("round", "is_sprint")
        )
        if not include_sprints:
            races_qs = races_qs.filter(is_sprint=False)

        races = list(races_qs)
        race_index = {r.id: i for i, r in enumerate(races)}
        race_count = len(races)

        ds_qs = (
            DriverSeason.objects
            .filter(season_id=season_id)
            .select_related("driver", "team_season__team")
            .order_by("driver__last_name", "driver__first_name", "id")
        )

        rows_by_ds: Dict[int, Dict[str, Any]] = {}
        constructor_totals: Dict[int, Dict[str, Any]] = {}

        for ds in ds_qs:
            driver = ds.driver

            team_name = ""
            team_logo = None
            team_id = None
            team_display_name = ""

            if getattr(ds, "team_season", None) and getattr(ds.team_season, "team", None):
                base_name = ds.team_season.team.team_name
                team_display_name = (ds.team_season.display_name or base_name) or ""
                team_name = base_name
                team_logo = getattr(ds.team_season.team, "team_img", None)
                team_id = ds.team_season.team.id

            rows_by_ds[ds.id] = {
                "driver_info": {
                    "first_name": getattr(driver, "first_name", "") or "",
                    "last_name": getattr(driver, "last_name", "") or "",
                    "team_name": team_name,
                    "team_display_name": team_display_name,
                    "profile_image": getattr(driver, "profile_image", None),
                    "initials": initials_for(driver),
                },
                "finish_positions": [None] * race_count,
                "grid_positions": [None] * race_count,
                "statuses": [None] * race_count,
                "fastest_lap": [False] * race_count,
                "pole_positions": [False] * race_count,
                "dotds": [False] * race_count,
                "finish_points": [0] * race_count,
                "total_points": 0,
                "_finish_list": [],
            }

            if team_id is not None and team_id not in constructor_totals:
                constructor_totals[team_id] = {
                    "team_name": team_name,
                    "team_display_name": team_display_name,
                    "team_image": team_logo,
                    "points": 0,
                    "_finish_sum": 0,
                    "_finish_count": 0,
                }

        if race_count > 0:
            results_qs = (
                RaceResult.objects
                .filter(race__in=races)
                .select_related(
                    "race",
                    "race__track",
                    "driver_season__driver",
                    "driver_season__team_season__team",
                )
            )

            for rr in results_qs:
                ds = rr.driver_season
                if ds.id not in rows_by_ds:
                    driver = ds.driver
                    team_name = ""
                    team_logo = None
                    team_display_name = ""
                    if getattr(ds, "team_season", None) and getattr(ds.team_season, "team", None):
                        base_name = ds.team_season.team.team_name
                        team_display_name = (ds.team_season.display_name or base_name) or ""
                        team_name = base_name
                        team_logo = getattr(ds.team_season.team, "team_img", None)

                    rows_by_ds[ds.id] = {
                        "driver_info": {
                            "first_name": getattr(driver, "first_name", "") or "",
                            "last_name": getattr(driver, "last_name", "") or "",
                            "team_name": team_name,
                            "team_display_name": team_display_name,
                            "profile_image": getattr(driver, "profile_image", None),
                            "initials": initials_for(driver),
                        },
                        "finish_positions": [None] * race_count,
                        "grid_positions": [None] * race_count,
                        "statuses": [None] * race_count,
                        "fastest_lap": [False] * race_count,
                        "pole_positions": [False] * race_count,
                        "dotds": [False] * race_count,
                        "finish_points": [0] * race_count,
                        "total_points": 0,
                        "_finish_list": [],
                    }

                row = rows_by_ds[ds.id]
                idx = race_index.get(rr.race_id)
                if idx is None:
                    continue

                row["finish_positions"][idx] = rr.finish_position
                row["grid_positions"][idx] = rr.grid_position
                row["statuses"][idx] = rr.status
                row["fastest_lap"][idx] = rr.fastest_lap
                row["pole_positions"][idx] = rr.pole_position
                row["dotds"][idx] = rr.dotd

                pts = points_for_result(rr)
                row["finish_points"][idx] = pts
                row["total_points"] += pts
                if rr.finish_position is not None:
                    row["_finish_list"].append(rr.finish_position)

                team = getattr(ds, "team_season", None)
                t_id = getattr(team.team, "id", None) if team and getattr(team, "team", None) else None
                if t_id is not None:
                    if t_id not in constructor_totals:
                        base_name = getattr(team.team, "team_name", "") or ""
                        constructor_totals[t_id] = {
                            "team_name": base_name,
                            "team_display_name": (getattr(team, "display_name", "") or base_name) or "",
                            "team_image": getattr(team.team, "team_img", None),
                            "points": 0,
                            "_finish_sum": 0,
                            "_finish_count": 0,
                        }
                    constructor_totals[t_id]["points"] += pts
                    if rr.finish_position is not None:
                        constructor_totals[t_id]["_finish_sum"] += rr.finish_position
                        constructor_totals[t_id]["_finish_count"] += 1

        results: List[Dict[str, Any]] = []
        for r in rows_by_ds.values():
            finishes = r.pop("_finish_list")
            r["avg_finish_position"] = (sum(finishes) / len(finishes)) if finishes else None
            results.append(r)

        # Drivers: points desc, avg finish asc, last name asc
        def driver_sort_key(r):
            avg = r["avg_finish_position"]
            avg_norm = avg if avg is not None else 1e9
            last = (r["driver_info"]["last_name"] or "").lower()
            return (-r["total_points"], avg_norm, last)

        results.sort(key=driver_sort_key)

        races_payload = [
            {
                "id": r.id,
                "round": r.round,
                "is_sprint": r.is_sprint,
                "track": {
                    "id": r.track_id,
                    "name": getattr(r.track, "name", ""),
                    "city": getattr(r.track, "city", ""),
                    "country": getattr(r.track, "country", ""),
                },
            }
            for r in races
        ]

        points_leaderboard = [row["total_points"] for row in results]

        # Constructors: compute avg_finish and sort by points desc, avg asc, then name
        constructor_results: List[Dict[str, Any]] = []
        for t in constructor_totals.values():
            cnt = t.get("_finish_count", 0) or 0
            s = t.get("_finish_sum", 0) or 0
            avg = (s / cnt) if cnt > 0 else None
            constructor_results.append({
                "team_name": t["team_name"],
                "team_display_name": t["team_display_name"],
                "team_image": t["team_image"],
                "points": t["points"],
                "avg_finish": avg,
            })

        def ctor_sort_key(x):
            avg = x.get("avg_finish")
            avg_norm = avg if avg is not None else 1e9
            stable = (x.get("team_display_name") or x.get("team_name") or "").lower()
            return (-x["points"], avg_norm, stable)

        constructor_results.sort(key=ctor_sort_key)

        return Response(
            {
                "season_id": int(season_id),
                "races": races_payload,
                "results": results,
                "points_leaderboard": points_leaderboard,
                "constructor_results": constructor_results,
            }
        )
