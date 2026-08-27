"""Builds the context for a race newsletter from data the site already has."""

from typing import Any, Dict, Optional

from django.db.models import Q, Sum
from django.db.models.functions import Coalesce

from articles.models import Article
from entries.models import DriverSeason
from results.api.views.utils import fl_bonus_case, points_case
from results.models import Race, RaceResult

STANDINGS_ROWS = 5


def latest_completed_race() -> Optional[Race]:
    """Most recent race with results recorded."""
    return (
        Race.objects
        .filter(results__isnull=False)
        .select_related("season", "track")
        .order_by("-season_id", "-round", "-is_sprint")
        .first()
    )


def _team_name(seat) -> str:
    ts = seat.team_season
    return ts.display_name or ts.team.team_name


def _driver_name(driver) -> str:
    return f"{driver.first_name} {driver.last_name}".strip()


def _podium(race: Race):
    results = (
        RaceResult.objects
        .filter(race=race, finish_position__lte=3, finish_position__isnull=False)
        .select_related("driver_season__driver", "driver_season__team_season__team")
        .order_by("finish_position")
    )
    return [
        {
            "position": r.finish_position,
            "driver": _driver_name(r.driver_season.driver),
            "team": _team_name(r.driver_season),
            "color": r.driver_season.team_season.color or "",
            "points": r.points,
        }
        for r in results
    ]


def _award(race: Race, field: str) -> Optional[str]:
    result = (
        RaceResult.objects
        .filter(race=race, **{field: True})
        .select_related("driver_season__driver")
        .first()
    )
    return _driver_name(result.driver_season.driver) if result else None


def _standings(season_id: int, through_round: int):
    """Top of the drivers' championship counting every round up to and including one."""
    # Nothing has been raced yet — an all-zero table is noise, not a standing.
    if through_round < 1:
        return []

    seats = (
        DriverSeason.objects
        .filter(season_id=season_id)
        .annotate(
            base_pts=Coalesce(
                Sum(points_case(), filter=Q(results__race__round__lte=through_round)), 0
            ),
            fl_pts=Coalesce(
                Sum(fl_bonus_case(), filter=Q(results__race__round__lte=through_round)), 0
            ),
        )
        .select_related("driver", "team_season__team")
    )

    # A driver can hold more than one seat in a season (substitutes keep their own
    # drive), and their championship total is the sum across all of them.
    by_driver: Dict[int, Dict[str, Any]] = {}
    for seat in seats:
        points = int(seat.base_pts) + int(seat.fl_pts)
        row = by_driver.get(seat.driver_id)
        if row is None:
            by_driver[seat.driver_id] = {
                "driver": _driver_name(seat.driver),
                "team": _team_name(seat),
                "color": seat.team_season.color or "",
                "points": points,
                "_best": points,
            }
        else:
            row["points"] += points
            if points > row["_best"]:
                row["_best"] = points
                row["team"] = _team_name(seat)
                row["color"] = seat.team_season.color or ""

    rows = sorted(by_driver.values(), key=lambda r: (-r["points"], r["driver"]))
    leader = rows[0]["points"] if rows else 0
    for i, row in enumerate(rows, start=1):
        row["position"] = i
        row["gap"] = row["points"] - leader
        row.pop("_best")
    return rows[:STANDINGS_ROWS]


def _previous_race(race: Race) -> Optional[Race]:
    """Most recent round before this one that has results — what a preview looks back on."""
    return (
        Race.objects
        .filter(season_id=race.season_id, round__lt=race.round, results__isnull=False)
        .select_related("track")
        .order_by("-round", "-is_sprint")
        .distinct()
        .first()
    )


def _next_race(race: Race) -> Optional[Race]:
    return (
        Race.objects
        .filter(season_id=race.season_id, round__gt=race.round)
        .select_related("track")
        .order_by("round", "is_sprint")
        .first()
    )


def build_recap_issue(race: Race) -> Dict[str, Any]:
    """Everything the recap template needs: what happened, and a nod to what's next."""
    recap = Article.objects.filter(race=race, type=Article.RECAP).order_by("-generated_at").first()
    next_race = _next_race(race)
    preview = (
        Article.objects.filter(race=next_race, type=Article.PREVIEW).order_by("-generated_at").first()
        if next_race
        else None
    )

    return {
        "race": race,
        "season": race.season,
        "track": race.track,
        "recap": recap,
        "podium": _podium(race),
        "fastest_lap": _award(race, "fastest_lap"),
        "dotd": _award(race, "dotd"),
        "standings": _standings(race.season_id, race.round),
        "next_race": next_race,
        "preview": preview,
        "subject": recap.title if recap else f"{race.track.name} — Round {race.round}",
    }


def build_preview_issue(race: Race) -> Dict[str, Any]:
    """Everything the preview template needs for an upcoming race.

    Standings are the table going *into* the race, so the round itself is
    excluded even if results have already been entered.
    """
    preview = Article.objects.filter(race=race, type=Article.PREVIEW).order_by("-generated_at").first()
    sidebar = preview.preview_sidebar if preview else None
    last_race = _previous_race(race)

    return {
        "race": race,
        "season": race.season,
        "track": race.track,
        "preview": preview,
        "head_to_head": (sidebar or {}).get("head_to_head"),
        "drivers_to_watch": (sidebar or {}).get("drivers_to_watch") or [],
        "standings": _standings(race.season_id, race.round - 1),
        "last_race": last_race,
        "last_podium": _podium(last_race) if last_race else [],
        "subject": preview.title if preview else f"{race.track.name} — Round {race.round} preview",
    }
