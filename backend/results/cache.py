"""
Cache key helpers and invalidation for CGR League API views.

All cached data lives in Django's default cache (LocMemCache).
Invalidation is triggered by post_save / post_delete signals on RaceResult
(wired up in results/apps.py).
"""
from django.core.cache import cache
from django.db import models

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

def key_race_prediction(race_id):
    return f"race:{race_id}:prediction"

def key_next_race_teaser(include_sprints: bool):
    return f"teaser:{int(include_sprints)}"

def key_hof(only_human: bool, include_ai: bool):
    return f"hof:{int(only_human)}:{int(include_ai)}"

def key_driver_detail(driver_id):
    return f"driver:{driver_id}:detail"

def key_driver_history(driver_id):
    return f"driver:{driver_id}:history"

def key_driver_tracks(driver_id):
    return f"driver:{driver_id}:tracks"

def key_track_stats(track_id, include_sprints: bool):
    return f"track:{track_id}:stats:{int(include_sprints)}"

def key_track_bio(track_id):
    return f"track:{track_id}:bio"

def key_team_detail(team_id):
    return f"team:{team_id}:detail"

def key_h2h():
    return "hof:h2h"

def key_rivalry(a, b):
    lo, hi = sorted((int(a), int(b)))
    return f"rivalry:{lo}:{hi}"

def key_driver_rivals(driver_id):
    return f"driver:{driver_id}:rivals"

def key_driver_specialization(driver_id):
    return f"driver:{driver_id}:specialization"

def key_driver_dna():
    # Population-wide percentile map; a single result shifts everyone, so this
    # is one key invalidated wholesale on any RaceResult change.
    return "driver:dna_map"

def key_history_teaser():
    return "teaser:history"


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
        # A result changes this race, the form/standings preview attached to
        # later races in its season, and circuit history at this track.
        *[
            key_race_detail(other_race_id)
            for other_race_id in Race.objects.filter(
                models.Q(season_id=season_id) | models.Q(track_id=track_id)
            ).values_list("id", flat=True)
        ],
        *[
            key_race_prediction(future_race_id)
            for future_race_id in Race.objects.filter(
                models.Q(season_id__gt=season_id)
                | models.Q(season_id=season_id, round__gt=race.round)
            ).values_list("id", flat=True)
        ],
        key_next_race_teaser(False),
        key_next_race_teaser(True),
        key_history_teaser(),
        key_driver_detail(driver_id),
        key_driver_history(driver_id),
        key_driver_tracks(driver_id),
        key_driver_specialization(driver_id),
        key_driver_dna(),
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

    # Rivalry pages are per-pair, so drop every pair this driver appears in.
    # A result also shifts the rivals list of everyone else in that race,
    # and the grid is small enough to just drop them all.
    from drivers.models import Driver
    for other_id in Driver.objects.values_list("id", flat=True):
        keys.append(key_driver_rivals(other_id))
        if other_id != driver_id:
            keys.append(key_rivalry(driver_id, other_id))

    cache.delete_many(keys)


def invalidate_for_race(instance):
    """
    Delete cached responses that depend on Race fields (schedule, laps, notes)
    rather than on results. Called by the Race post_save / post_delete signals.
    """
    cache.delete_many([
        key_next_race_teaser(False),
        key_next_race_teaser(True),
        key_race_detail(instance.pk),
        key_race_prediction(instance.pk),
        key_last_race(instance.season_id, False),
        key_last_race(instance.season_id, True),
    ])


def invalidate_for_seat(instance):
    """
    Delete cached responses that depend on who holds a seat in a season, rather
    than on results. Fired by the DriverSeason signals.

    Adding a substitute changes the season's standings, chart and matrix, and
    puts a driver on the head-to-head grid before they have raced, so those
    would otherwise serve a stale response until the 24h TTL expired.
    """
    from results.models import Race

    season_id = instance.season_id
    cache.delete_many([
        key_season_standings(season_id),
        key_constructor_standings(season_id),
        key_matrix(season_id, True),
        key_matrix(season_id, False),
        key_timeline(season_id),
        key_h2h(),
        key_hof(False, True),
        key_hof(True, True),
        key_hof(False, False),
        key_hof(True, False),
        key_driver_detail(instance.driver_id),
        *[
            key_race_detail(race_id)
            for race_id in Race.objects.filter(season_id=season_id).values_list("id", flat=True)
        ],
        *[
            key_race_prediction(race_id)
            for race_id in Race.objects.filter(season_id=season_id).values_list("id", flat=True)
        ],
    ])
