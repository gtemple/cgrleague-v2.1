from collections import defaultdict

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
from seasons.models import Season
from results.api.views.utils import points_case, fl_bonus_case, serialize_driver
from results.cache import CACHE_TTL, key_team_detail


def _serialize_team_lite(team, ts=None):
    return {
        "id": team.id,
        "name": team.team_name,
        "logo_image": team.team_img,
        "display_name": (ts.display_name if ts and ts.display_name else team.team_name),
        "color": (ts.color if ts else "") or "",
    }


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

        # Best driver: highest total points across all seasons for this team
        driver_totals: dict = defaultdict(lambda: {"points": 0, "driver_data": None})
        for season in seasons_data:
            for d in season["drivers"]:
                did = d["id"]
                driver_totals[did]["points"] += d["points"]
                if driver_totals[did]["driver_data"] is None:
                    driver_totals[did]["driver_data"] = d

        best_driver = None
        if driver_totals:
            best = max(driver_totals.values(), key=lambda x: x["points"])
            if best["driver_data"]:
                wins_row = (
                    RaceResult.objects
                    .filter(
                        driver_season__team_season__team_id=team_id,
                        driver_season__driver_id=best["driver_data"]["id"],
                        finish_position=1,
                    )
                    .count()
                )
                best_driver = {
                    **best["driver_data"],
                    "team_points": best["points"],
                    "team_wins": wins_row,
                }

        # Best season: lowest championship position, tiebreak on most points
        best_season = None
        if seasons_data:
            best_s = min(seasons_data, key=lambda s: (s["champ_pos"], -s["points"]))
            best_season = {
                "season_id": best_s["season"]["id"],
                "champ_pos": best_s["champ_pos"],
                "points": best_s["points"],
                "display_name": best_s["display_name"],
            }

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
            "best_driver": best_driver,
            "best_season": best_season,
        }
        cache.set(ck, data, timeout=CACHE_TTL)
        return Response(data)


class TeamsHomepageView(APIView):
    """
    GET /api/teams/homepage/
    Returns everything needed for the teams index page:
      - current_season: constructor standings for the latest season
      - records: all-time team records (points, wins, podiums, poles)
      - all_teams: every team with career totals for the grid
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        latest_season = Season.objects.order_by("-id").first()
        latest_season_id = latest_season.id if latest_season else None

        # ── Current season constructor standings ──────────────────────────
        current_season_teams = []
        if latest_season:
            team_seasons = (
                TeamSeason.objects
                .filter(season=latest_season)
                .select_related("team")
            )
            # Aggregate points per TeamSeason
            ts_points = {}
            for ts in team_seasons:
                rr = RaceResult.objects.filter(driver_season__team_season=ts)
                agg = rr.aggregate(
                    base=Coalesce(Sum(points_case(prefix="")), 0),
                    fl=Coalesce(Sum(fl_bonus_case(prefix="")), 0),
                    wins=Count(Case(When(finish_position=1, then=1), output_field=IntegerField())),
                )
                ts_points[ts.id] = {
                    "ts": ts,
                    "points": int(agg["base"]) + int(agg["fl"]),
                    "wins": int(agg["wins"]),
                }

            # Rank by points desc
            ranked = sorted(ts_points.values(), key=lambda x: (-x["points"], -x["wins"]))
            for pos, row in enumerate(ranked, 1):
                ts = row["ts"]
                current_season_teams.append({
                    **_serialize_team_lite(ts.team, ts),
                    "points": row["points"],
                    "wins": row["wins"],
                    "champ_pos": pos,
                })

        # ── All-time records (per team across all seasons) ────────────────
        # Aggregate across all RaceResults grouped by team
        all_career = list(
            RaceResult.objects
            .values("driver_season__team_season__team_id")
            .annotate(base=Coalesce(Sum(points_case(prefix="")), 0))
            .annotate(fl=Coalesce(Sum(fl_bonus_case(prefix="")), 0))
            .annotate(wins=Count(Case(When(finish_position=1, then=1), output_field=IntegerField())))
            .annotate(podiums=Count(Case(
                When(finish_position__lte=3, finish_position__isnull=False, then=1),
                output_field=IntegerField(),
            )))
            .annotate(poles=Count(Case(When(pole_position=True, then=1), output_field=IntegerField())))
        )
        team_map = {t.id: t for t in Team.objects.all()}

        # Build career dict keyed by team_id
        career_by_team = {}
        for row in all_career:
            tid = row["driver_season__team_season__team_id"]
            if tid not in team_map:
                continue
            total_pts = int(row["base"]) + int(row["fl"])
            career_by_team[tid] = {
                "team": team_map[tid],
                "total_points": total_pts,
                "wins": int(row["wins"]),
                "podiums": int(row["podiums"]),
                "poles": int(row["poles"]),
            }

        def record_for(field):
            if not career_by_team:
                return None
            best = max(career_by_team.values(), key=lambda r: r[field] or 0)
            if not best[field]:
                return None
            t = best["team"]
            # Use most recent TeamSeason for display_name/color
            latest_ts = TeamSeason.objects.filter(team=t).order_by("-season_id").first()
            return {
                "team": _serialize_team_lite(t, latest_ts),
                "value": best[field],
            }

        records = {
            "points": record_for("total_points"),
            "wins":   record_for("wins"),
            "podiums": record_for("podiums"),
            "poles":  record_for("poles"),
        }

        # ── All teams grid ────────────────────────────────────────────────
        seasons_per_team = dict(
            TeamSeason.objects
            .values("team_id")
            .annotate(n=Count("id"))
            .values_list("team_id", "n")
        )

        all_teams = []
        for tid, row in career_by_team.items():
            t = row["team"]
            latest_ts = TeamSeason.objects.filter(team=t).order_by("-season_id").first()
            all_teams.append({
                **_serialize_team_lite(t, latest_ts),
                "career_points": row["total_points"],
                "career_wins": row["wins"],
                "career_seasons": seasons_per_team.get(tid, 0),
            })

        all_teams.sort(key=lambda x: -x["career_points"])

        return Response({
            "latest_season_id": latest_season_id,
            "current_season": current_season_teams,
            "records": records,
            "all_teams": all_teams,
        })
