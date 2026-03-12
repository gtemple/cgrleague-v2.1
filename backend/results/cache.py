"""
Cache key helpers and invalidation for CGR League API views.

All cached data lives in Django's default cache (LocMemCache).
Invalidation is triggered by post_save / post_delete signals on RaceResult
(wired up in results/apps.py).
"""
from django.core.cache import cache

CACHE_TTL = 86400  # 24 hours


# ── key builders ──────────────────────────────────────────────────────────────

def key_season_standings(season_id):
    return f"s:{season_id}:standings"

def key_constructor_standings(season_id):
    return f"s:{season_id}:constructors"

def key_matrix(season_id, include_sprints: bool):
    return f"s:{season_id}:matrix:{int(include_sprints)}"

def key_last_race(season_id, include_sprints: bool):
    return f"s:{season_id}:last_race:{int(include_sprints)}"

def key_timeline(season_id):
    return f"s:{season_id}:timeline"

def key_race_detail(race_id):
    return f"race:{race_id}:detail"

def key_next_race_teaser(include_sprints: bool):
    return f"teaser:{int(include_sprints)}"

def key_hof(only_human: bool, include_ai: bool):
    return f"hof:{int(only_human)}:{int(include_ai)}"

def key_driver_detail(driver_id):
    return f"driver:{driver_id}:detail"

def key_driver_history(driver_id):
    return f"driver:{driver_id}:history"

def key_track_stats(track_id, include_sprints: bool):
    return f"track:{track_id}:stats:{int(include_sprints)}"

def key_team_detail(team_id):
    return f"team:{team_id}:detail"

def key_h2h():
    return "hof:h2h"


# ── invalidation ──────────────────────────────────────────────────────────────

def invalidate_for_result(instance):
    """
    Delete every cached response that could be stale after a RaceResult
    is saved or deleted. Called by the post_save / post_delete signals.
    """
    from results.models import Race
    from entries.models import DriverSeason

    race = Race.objects.only("season_id", "track_id").get(pk=instance.race_id)
    season_id = race.season_id
    race_id = instance.race_id
    track_id = race.track_id
    driver_id = DriverSeason.objects.only("driver_id").get(pk=instance.driver_season_id).driver_id
    team_id = DriverSeason.objects.select_related("team_season").only("team_season__team_id").get(pk=instance.driver_season_id).team_season.team_id

    keys = [
        key_season_standings(season_id),
        key_constructor_standings(season_id),
        key_matrix(season_id, False),
        key_matrix(season_id, True),
        key_last_race(season_id, False),
        key_last_race(season_id, True),
        key_timeline(season_id),
        key_race_detail(race_id),
        key_next_race_teaser(False),
        key_next_race_teaser(True),
        key_driver_detail(driver_id),
        key_driver_history(driver_id),
        key_track_stats(track_id, False),
        key_track_stats(track_id, True),
        key_team_detail(team_id),
        # all HOF variants
        key_hof(False, True),
        key_hof(True, True),
        key_hof(False, False),
        key_hof(True, False),
        key_h2h(),
    ]
    cache.delete_many(keys)
