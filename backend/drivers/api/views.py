# drivers/api/views.py
from typing import Any, Dict, List, Optional
from django.core.cache import cache
from django.db.models import (
    Sum, Count, Avg, Min, Q, F, Value, IntegerField, FloatField, OuterRef, Subquery,
    ExpressionWrapper, Case, When
)
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from entries.models import DriverSeason
from results.models import RaceResult, Race
from seasons.models import Season
from drivers.models import Driver
# Reuse your existing points helpers (same ones used in standings)
from results.api.views.utils import points_case, fl_bonus_case, serialize_driver, serialize_team
from results.cache import CACHE_TTL, key_driver_detail, key_driver_history, key_driver_tracks, key_driver_specialization
from drivers.dna import get_dna_map
from tracks.models import Track


def specialist_label_from_rows(rows: List[Dict[str, Any]]) -> Optional[str]:
    """
    Plain-language track-specialty verdict from per-category rows
    (each with category, races, avg_finish). Requires both categories
    comparable (>=3 races each); otherwise None. A >=1.5-position
    avg-finish gap reads as a specialty, else all-rounder.
    """
    qualified = [r for r in rows if r["races"] >= 3 and r["avg_finish"] is not None]
    if len(qualified) < 2:
        return None
    best_row = min(qualified, key=lambda r: r["avg_finish"])
    worst_row = max(qualified, key=lambda r: r["avg_finish"])
    if worst_row["avg_finish"] - best_row["avg_finish"] >= 1.5:
        return {
            "STREET": "Street Specialist",
            "PERMANENT": "Permanent-Circuit Specialist",
        }.get(best_row["category"])
    return "All-Rounder"


def serialize_driver(d: Driver) -> Dict[str, Any]:
    """Consistent driver payload."""
    first = getattr(d, "first_name", "") or ""
    last  = getattr(d, "last_name", "") or ""
    display = (f"{first} {last}").strip() or getattr(d, "name", "") or f"Driver {d.id}"
    return {
        "id": d.id,
        "first_name": first,
        "last_name": last,
        "display_name": display,
        "profile_image": getattr(d, "profile_image", None),
        "country_of_representation": getattr(d, "country_of_representation", None),
        "bio": getattr(d, "bio", None),
        "is_human": bool(getattr(d, "human", False)),
    }


class DriversListView(APIView):
    """
    GET /api/drivers/?q=<search>
    Returns a lightweight, alphabetized list for dropdowns/filters.
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        q = (request.GET.get("q") or "").strip()

        qs = Driver.objects.all()
        if q:
            qs = qs.filter(
                # simple search on first/last/display
                # (add .name if you keep a single-field name)
                # OR conditions via icontains
                # .filter(Q(... ) | Q(...)) if you prefer
                first_name__icontains=q
            ) | Driver.objects.filter(last_name__icontains=q)

        qs = qs.order_by("last_name", "first_name", "id")

        data = [serialize_driver(d) for d in qs]
        return Response(data)


class DriverDetailView(APIView):
    """
    GET /api/drivers/<driver_id>/
    Returns full driver info + career aggregates across all RaceResults.
    """
    permission_classes = [AllowAny]

    def get(self, request, driver_id: int, *args, **kwargs):
        ck = key_driver_detail(driver_id)
        cached = cache.get(ck)
        if cached is not None:
            # DNA is percentile-ranked against the whole grid, so it lives in a
            # separate map (fresh even when this driver's core blob is cached).
            return Response({**cached, "dna": get_dna_map().get(driver_id)})

        driver = get_object_or_404(Driver, pk=driver_id)

        rr_qs = RaceResult.objects.filter(driver_season__driver_id=driver_id)

        # Base points from finish position + FL bonus as you use elsewhere
        base_expr = points_case(prefix="")         # uses RaceResult.finish_position
        fl_expr   = fl_bonus_case(prefix="")       # uses RaceResult.fastest_lap (+ classification rule you encoded)

        agg = rr_qs.aggregate(
            base_points=Coalesce(Sum(base_expr), 0),
            fl_bonus_points=Coalesce(Sum(fl_expr), 0),

            total_laps=Coalesce(Sum("laps_completed"), 0),

            # result counts (Case→Count pattern)
            wins=Count(Case(When(finish_position=1, then=1), output_field=IntegerField())),
            podiums=Count(Case(
                When(finish_position__isnull=False, finish_position__lte=3, then=1),
                output_field=IntegerField(),
            )),
            dnfs=Count(Case(When(status="DNF", then=1), output_field=IntegerField())),
            fastest_laps=Count(Case(When(fastest_lap=True, then=1), output_field=IntegerField())),
            poles=Count(Case(When(pole_position=True, then=1), output_field=IntegerField())),
            dotds=Count(Case(When(dotd=True, then=1), output_field=IntegerField())),
            cleanest_awards=Count(Case(When(cleanest_driver=True, then=1), output_field=IntegerField())),
            most_overtakes_awards=Count(Case(When(most_overtakes=True, then=1), output_field=IntegerField())),

            races_completed=Count(Case(When(status="FIN", then=1), output_field=IntegerField())),
            races_count=Count("id"),

            # average finish position across classified results (NULL ignored)
            avg_finish=Avg("finish_position"),

            # advanced stats
            points_finishes=Count(Case(
                When(finish_position__isnull=False, finish_position__lte=10, then=1),
                output_field=IntegerField(),
            )),
            pole_wins=Count(Case(
                When(pole_position=True, finish_position=1, then=1),
                output_field=IntegerField(),
            )),
            avg_positions_gained=Avg(
                ExpressionWrapper(
                    F("grid_position") - F("finish_position"),
                    output_field=FloatField(),
                ),
                filter=Q(grid_position__isnull=False, finish_position__isnull=False, status="FIN"),
            ),
        )

        total_points = int(agg["base_points"]) + int(agg["fl_bonus_points"])
        races = int(agg["races_count"] or 0)
        poles = int(agg["poles"] or 0)
        races_completed = int(agg["races_completed"] or 0)
        points_finishes = int(agg["points_finishes"] or 0)
        pole_wins = int(agg["pole_wins"] or 0)

        seasons_played = DriverSeason.objects.filter(driver_id=driver_id).count()

        payload = {
            "driver": serialize_driver(driver),
            "totals": {
                "seasons_played": seasons_played,
                "points": total_points,
                "points_breakdown": {
                    "base": int(agg["base_points"]),
                    "fastest_lap_bonus": int(agg["fl_bonus_points"]),
                },
                "laps": int(agg["total_laps"] or 0),
                "wins": int(agg["wins"] or 0),
                "podiums": int(agg["podiums"] or 0),
                "dnfs": int(agg["dnfs"] or 0),
                "fastest_laps": int(agg["fastest_laps"] or 0),
                "poles": poles,
                "dotds": int(agg["dotds"] or 0),
                "cleanest_awards": int(agg["cleanest_awards"] or 0),
                "most_overtakes_awards": int(agg["most_overtakes_awards"] or 0),
                "races_completed": races_completed,
                "races": races,
                "avg_finish": (float(agg["avg_finish"]) if agg["avg_finish"] is not None else None),
                # advanced
                "ppr": round(total_points / races, 2) if races > 0 else None,
                "points_finish_rate": round(points_finishes / races * 100, 1) if races > 0 else None,
                "finish_rate": round(races_completed / races * 100, 1) if races > 0 else None,
                "pole_to_win_rate": round(pole_wins / poles * 100, 1) if poles > 0 else None,
                "avg_positions_gained": round(float(agg["avg_positions_gained"]), 2) if agg["avg_positions_gained"] is not None else None,
            },
        }
        cache.set(ck, payload, timeout=CACHE_TTL)
        return Response({**payload, "dna": get_dna_map().get(driver_id)})


class DriverHistoryView(APIView):
    """
    GET /api/drivers/<driver_id>/history/

    Returns a list of season rows (newest -> oldest):
    - season info
    - team (name, display_name, logo)
    - points (base + FL bonus)
    - wins, podiums, poles, fastest laps, DOTDs, cleanest, most-overtakes
    - DNFs, laps, races, races_completed
    - avg_finish, best_finish
    - PoP: % of team points scored by this driver that season
    """
    permission_classes = [AllowAny]

    def get(self, request, driver_id: int, *args, **kwargs):
        ck = key_driver_history(driver_id)
        cached = cache.get(ck)
        if cached is not None:
            return Response(cached)

        # Subquery: total team points for this team_season in this season
        # We compute on RaceResult with points_case (finish position) + fl_bonus_case.
        team_points_subq = (
            RaceResult.objects
            .filter(
                driver_season__team_season=OuterRef("team_season"),
                race__season=OuterRef("season"),
            )
            .annotate(points_row=points_case(prefix="") + fl_bonus_case(prefix=""))
            .values("driver_season__team_season")     # group key
            .annotate(total=Coalesce(Sum("points_row"), 0))
            .values("total")[:1]
        )

        # Subquery: avg positions gained per driver-season
        avg_pg_subq = (
            RaceResult.objects
            .filter(
                driver_season=OuterRef("pk"),
                grid_position__isnull=False,
                finish_position__isnull=False,
                status="FIN",
            )
            .annotate(gained=ExpressionWrapper(
                F("grid_position") - F("finish_position"),
                output_field=FloatField(),
            ))
            .values("driver_season")
            .annotate(avg_pg=Avg("gained"))
            .values("avg_pg")[:1]
        )

        qs = (
            DriverSeason.objects
            .filter(driver_id=driver_id)
            .select_related("driver", "season", "team_season__team")
            # Points (base + FL)
            .annotate(base_points=Coalesce(Sum(points_case()), 0))
            .annotate(fl_bonus=Coalesce(Sum(fl_bonus_case()), 0))
            .annotate(points=F("base_points") + F("fl_bonus"))
            # Counting flags / outcomes
            .annotate(wins=Coalesce(Count("results", filter=Q(results__finish_position=1)), 0))
            .annotate(podiums=Coalesce(Count("results", filter=Q(results__finish_position__lte=3, results__finish_position__isnull=False)), 0))
            .annotate(poles=Coalesce(Count("results", filter=Q(results__pole_position=True)), 0))
            .annotate(fastest_laps=Coalesce(Count("results", filter=Q(results__fastest_lap=True)), 0))
            .annotate(dotds=Coalesce(Count("results", filter=Q(results__dotd=True)), 0))
            .annotate(cleanest_awards=Coalesce(Count("results", filter=Q(results__cleanest_driver=True)), 0))
            .annotate(most_overtakes_awards=Coalesce(Count("results", filter=Q(results__most_overtakes=True)), 0))
            # Volumes
            .annotate(dnfs=Coalesce(Count("results", filter=~Q(results__status="FIN")), 0))
            .annotate(laps=Coalesce(Sum("results__laps_completed"), 0))
            .annotate(races=Coalesce(Count("results"), 0))
            .annotate(races_completed=Coalesce(Count("results", filter=Q(results__status="FIN")), 0))
            # Finishing stats (classified only)
            .annotate(avg_finish=Avg("results__finish_position", filter=Q(results__finish_position__isnull=False)))
            .annotate(best_finish=Min("results__finish_position"))
            # Advanced stats
            .annotate(points_finishes=Coalesce(Count("results", filter=Q(
                results__finish_position__isnull=False, results__finish_position__lte=10)), 0))
            .annotate(pole_wins=Coalesce(Count("results", filter=Q(
                results__pole_position=True, results__finish_position=1)), 0))
            .annotate(avg_positions_gained=Subquery(avg_pg_subq, output_field=FloatField()))
            # Team season presentation
            .annotate(team_name=F("team_season__team__team_name"))
            .annotate(team_logo=F("team_season__team__team_img"))
            .annotate(team_display_name=Coalesce(F("team_season__display_name"), F("team_season__team__team_name")))
            # Team points (same car across drivers)
            .annotate(team_points=Coalesce(Subquery(team_points_subq, output_field=IntegerField()), 0))
            .order_by("-season_id", "id")
        )

        # PoP: share of team points
        # Use ExpressionWrapper so it's a float; avoid division by 0.
        rows = list(qs)
        history: List[Dict[str, Any]] = []
        drv = rows[0].driver if rows else None

        for ds in rows:
            team_points = int(ds.team_points or 0)
            points = int(ds.points or 0)
            races = int(ds.races or 0)
            poles = int(ds.poles or 0)
            races_completed = int(ds.races_completed or 0)
            points_finishes = int(ds.points_finishes or 0)
            pole_wins = int(ds.pole_wins or 0)
            pop_share = (points * 100.0 / team_points) if team_points > 0 else None

            history.append({
                "season": {
                    "id": ds.season_id,
                    "name": getattr(ds.season, "name", None),
                    "year": getattr(ds.season, "year", None),
                },
                "team": {
                    "id": getattr(getattr(ds, "team_season", None), "team_id", None),
                    "name": ds.team_name or "",
                    "display_name": ds.team_display_name or (ds.team_name or ""),
                    "logo_image": ds.team_logo,
                },
                "points": points,
                "points_breakdown": {
                    "base": int(ds.base_points or 0),
                    "fastest_lap_bonus": int(ds.fl_bonus or 0),
                },
                "wins": int(ds.wins or 0),
                "podiums": int(ds.podiums or 0),
                "poles": poles,
                "fastest_laps": int(ds.fastest_laps or 0),
                "dotds": int(ds.dotds or 0),
                "cleanest_awards": int(ds.cleanest_awards or 0),
                "most_overtakes_awards": int(ds.most_overtakes_awards or 0),
                "dnfs": int(ds.dnfs or 0),
                "laps": int(ds.laps or 0),
                "races": races,
                "races_completed": races_completed,
                "avg_finish": float(ds.avg_finish) if ds.avg_finish is not None else None,
                "best_finish": int(ds.best_finish) if ds.best_finish is not None else None,
                "team_points": team_points,
                "pop_share": pop_share,
                # advanced
                "ppr": round(points / races, 2) if races > 0 else None,
                "points_finish_rate": round(points_finishes / races * 100, 1) if races > 0 else None,
                "finish_rate": round(races_completed / races * 100, 1) if races > 0 else None,
                "pole_to_win_rate": round(pole_wins / poles * 100, 1) if poles > 0 else None,
                "avg_positions_gained": round(float(ds.avg_positions_gained), 2) if ds.avg_positions_gained is not None else None,
            })

        payload = {
            "driver": serialize_driver(drv) if drv else None,
            "history": history,
        }
        cache.set(ck, payload, timeout=CACHE_TTL)
        return Response(payload)


class DriverTrackStatsView(APIView):
    """
    GET /api/drivers/<driver_id>/tracks/
    Returns per-track career stats for a single driver, sorted by total points desc.
    """
    permission_classes = [AllowAny]

    def get(self, request, driver_id: int, *args, **kwargs):
        ck = key_driver_tracks(driver_id)
        cached = cache.get(ck)
        if cached is not None:
            return Response(cached)

        get_object_or_404(Driver, pk=driver_id)

        results_qs = (
            RaceResult.objects
            .filter(driver_season__driver_id=driver_id, race__is_sprint=False)
            .select_related("race__track", "driver_season")
        )

        from collections import defaultdict
        agg: Dict[int, Dict[str, Any]] = {}
        finishes: Dict[int, list] = defaultdict(list)

        for rr in results_qs:
            track = rr.race.track
            tid = track.id
            if tid not in agg:
                agg[tid] = {
                    "track": {
                        "id": track.id,
                        "name": track.name,
                        "city": getattr(track, "city", ""),
                        "country": getattr(track, "country", ""),
                        "image": getattr(track, "img", None),
                    },
                    "total_points": 0,
                    "wins": 0,
                    "podiums": 0,
                    "fastest_laps": 0,
                    "races_count": 0,
                }

            from results.scoring import points_for_result
            agg[tid]["total_points"] += int(points_for_result(rr))
            agg[tid]["races_count"] += 1

            fp = rr.finish_position
            if fp is not None:
                if fp == 1:
                    agg[tid]["wins"] += 1
                if fp <= 3:
                    agg[tid]["podiums"] += 1
                finishes[tid].append(fp)

            if getattr(rr, "fastest_lap", False):
                agg[tid]["fastest_laps"] += 1

        rows = []
        for tid, row in agg.items():
            fs = finishes[tid]
            row["avg_finish_position"] = round(sum(fs) / len(fs), 1) if fs else None
            rows.append(row)

        rows.sort(key=lambda r: r["total_points"], reverse=True)

        cache.set(ck, rows, timeout=CACHE_TTL)
        return Response(rows)


class DriversHomepageView(APIView):
    """
    GET /api/drivers/homepage/
    Returns everything needed for the drivers index page:
      - human_spotlight: human drivers in the latest season with standing + last race finish
      - leaders: all-time leader per stat category (human drivers only)
      - all_drivers: every driver with career totals for the grid
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        latest_season = Season.objects.order_by("-id").first()

        # ── Human spotlight ───────────────────────────────────────────────
        human_spotlight = []
        latest_season_id = None
        last_race = None

        if latest_season:
            latest_season_id = latest_season.id

            season_ds = list(
                DriverSeason.objects
                .filter(season=latest_season)
                .select_related("driver", "team_season__team")
                .annotate(base_pts=Coalesce(Sum(points_case()), 0))
                .annotate(fl_pts=Coalesce(Sum(fl_bonus_case()), 0))
                .annotate(points=F("base_pts") + F("fl_pts"))
                .annotate(wins=Count("results", filter=Q(results__finish_position=1)))
                .order_by("-points", "-wins")
            )

            pos_map = {ds.driver_id: i + 1 for i, ds in enumerate(season_ds)}

            completed_race_ids = set(
                RaceResult.objects
                .filter(race__season=latest_season)
                .values_list("race_id", flat=True)
                .distinct()
            )
            last_race = (
                Race.objects
                .filter(id__in=completed_race_ids, season=latest_season)
                .order_by("-round").first()
            )
            last_results: Dict[int, Optional[int]] = {}
            if last_race:
                for rr in RaceResult.objects.filter(race=last_race).select_related("driver_season__driver"):
                    last_results[rr.driver_season.driver_id] = rr.finish_position

            # ── Last-5 race form per human driver (oldest → newest) ────────
            human_ds_ids = [ds.id for ds in season_ds if ds.driver.human]
            recent_form: Dict[int, List] = {}
            if human_ds_ids:
                recent_results = (
                    RaceResult.objects
                    .filter(driver_season_id__in=human_ds_ids, race__season=latest_season)
                    .select_related("race")
                    .order_by("driver_season_id", "-race__round", "-race__is_sprint")
                )
                for rr in recent_results:
                    bucket = recent_form.setdefault(rr.driver_season_id, [])
                    if len(bucket) < 5:
                        bucket.append("DNF" if rr.status != "FIN" else rr.finish_position)
                for bucket in recent_form.values():
                    bucket.reverse()

            for ds in season_ds:
                if not ds.driver.human:
                    continue
                team = ds.team_season.team if ds.team_season else None
                human_spotlight.append({
                    "driver": serialize_driver(ds.driver),
                    "position": pos_map[ds.driver_id],
                    "points": int(ds.points),
                    "wins": int(ds.wins),
                    "team": {
                        "id": team.id if team else None,
                        "name": team.team_name if team else None,
                        "display_name": (ds.team_season.display_name or team.team_name) if team else None,
                        "logo_image": team.team_img if team else None,
                        "color": ds.team_season.color if ds.team_season else None,
                    } if team else None,
                    "last_finish": last_results.get(ds.driver_id),
                    "form": recent_form.get(ds.id, []),
                })

        # ── All-time leaders (human only) ─────────────────────────────────
        human_career = list(
            DriverSeason.objects
            .filter(driver__human=True)
            .values("driver")
            .annotate(base_pts=Coalesce(Sum(points_case()), 0))
            .annotate(fl_pts=Coalesce(Sum(fl_bonus_case()), 0))
            .annotate(total_points=F("base_pts") + F("fl_pts"))
            .annotate(wins=Count("results", filter=Q(results__finish_position=1)))
            .annotate(podiums=Count("results", filter=Q(
                results__finish_position__lte=3, results__finish_position__isnull=False)))
            .annotate(poles=Count("results", filter=Q(results__pole_position=True)))
            .annotate(fastest_laps=Count("results", filter=Q(results__fastest_lap=True)))
        )
        human_driver_map = {d.id: d for d in Driver.objects.filter(human=True)}

        def leader_for(field: str) -> Optional[Dict]:
            if not human_career:
                return None
            best = max(human_career, key=lambda r: r[field] or 0)
            if not best[field]:
                return None
            d = human_driver_map.get(best["driver"])
            return {"driver": serialize_driver(d), "value": best[field]} if d else None

        leaders = {
            "points":       leader_for("total_points"),
            "wins":         leader_for("wins"),
            "podiums":      leader_for("podiums"),
            "poles":        leader_for("poles"),
            "fastest_laps": leader_for("fastest_laps"),
        }

        # ── All drivers grid ──────────────────────────────────────────────
        all_career = list(
            DriverSeason.objects
            .values("driver")
            .annotate(base_pts=Coalesce(Sum(points_case()), 0))
            .annotate(fl_pts=Coalesce(Sum(fl_bonus_case()), 0))
            .annotate(total_points=F("base_pts") + F("fl_pts"))
            .annotate(wins=Count("results", filter=Q(results__finish_position=1)))
            .annotate(races=Count("results"))
        )
        all_driver_map = {d.id: d for d in Driver.objects.all()}

        # ── Track-specialty label per driver (one grouped query) ──────────
        from collections import defaultdict
        spec_by_driver: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
        spec_rows = (
            RaceResult.objects
            .filter(race__is_sprint=False, race__track__category__in=["STREET", "PERMANENT"])
            .values("driver_season__driver_id", "race__track__category")
            .annotate(races=Count("id"), avg_finish=Avg("finish_position"))
        )
        for row in spec_rows:
            avg = row["avg_finish"]
            spec_by_driver[row["driver_season__driver_id"]].append({
                "category": row["race__track__category"],
                "races": row["races"],
                "avg_finish": round(avg, 1) if avg is not None else None,
            })

        all_drivers = sorted(
            [
                {
                    "driver": serialize_driver(all_driver_map[r["driver"]]),
                    "is_human": all_driver_map[r["driver"]].human,
                    "career_points": r["total_points"] or 0,
                    "career_wins": r["wins"] or 0,
                    "career_races": r["races"] or 0,
                    "specialist_label": specialist_label_from_rows(spec_by_driver.get(r["driver"], [])),
                }
                for r in all_career
                if r["driver"] in all_driver_map
            ],
            key=lambda x: (-x["career_points"], x["driver"]["last_name"]),
        )

        return Response({
            "latest_season_id": latest_season_id,
            "last_race": {"round": last_race.round, "track_name": last_race.track.name} if last_race else None,
            "human_spotlight": human_spotlight,
            "leaders": leaders,
            "all_drivers": all_drivers,
        })


class DriverSpecializationView(APIView):
    """
    GET /api/drivers/<driver_id>/specialization/
    Returns per-track-category career stats (avg finish, wins, podiums, points).
    Only includes categories the driver has raced on.
    """
    permission_classes = [AllowAny]

    def get(self, request, driver_id: int, *args, **kwargs):
        ck = key_driver_specialization(driver_id)
        cached = cache.get(ck)
        if cached is not None:
            return Response(cached)

        get_object_or_404(Driver, pk=driver_id)

        results_qs = (
            RaceResult.objects
            .filter(
                driver_season__driver_id=driver_id,
                race__is_sprint=False,
                race__track__category__in=["STREET", "PERMANENT"],
            )
            .select_related("race__track")
        )

        from collections import defaultdict
        from results.scoring import points_for_result

        agg: Dict[str, Dict[str, Any]] = {}
        finishes: Dict[str, list] = defaultdict(list)

        for rr in results_qs:
            cat = rr.race.track.category
            if cat not in agg:
                agg[cat] = {
                    "category": cat,
                    "label": dict(Track._meta.get_field("category").choices).get(cat, cat),
                    "races": 0,
                    "points": 0,
                    "wins": 0,
                    "podiums": 0,
                    "fastest_laps": 0,
                    "poles": 0,
                    "dnfs": 0,
                }

            agg[cat]["races"] += 1
            agg[cat]["points"] += int(points_for_result(rr))

            fp = rr.finish_position
            if fp is not None:
                finishes[cat].append(fp)
                if fp == 1:
                    agg[cat]["wins"] += 1
                if fp <= 3:
                    agg[cat]["podiums"] += 1

            if rr.fastest_lap:
                agg[cat]["fastest_laps"] += 1
            if rr.pole_position:
                agg[cat]["poles"] += 1
            if rr.status != "FIN":
                agg[cat]["dnfs"] += 1

        rows = []
        for cat, row in agg.items():
            fs = finishes[cat]
            row["avg_finish"] = round(sum(fs) / len(fs), 1) if fs else None
            races = row["races"]
            row["ppr"] = round(row["points"] / races, 2) if races > 0 else None
            row["win_rate"] = round(row["wins"] / races * 100, 1) if races > 0 else None
            row["podium_rate"] = round(row["podiums"] / races * 100, 1) if races > 0 else None
            rows.append(row)

        # Sort by points desc
        rows.sort(key=lambda r: -r["points"])

        # Determine best category
        best = None
        qualified = [r for r in rows if r["races"] >= 3 and r["avg_finish"] is not None]
        if len(rows) >= 2 and qualified:
            # Best = lowest avg finish with at least 3 races
            best = min(qualified, key=lambda r: r["avg_finish"])["category"]

        payload = {
            "categories": rows,
            "best_category": best,
            "specialist_label": specialist_label_from_rows(rows),
        }
        cache.set(ck, payload, timeout=CACHE_TTL)
        return Response(payload)