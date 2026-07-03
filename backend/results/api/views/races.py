import os
import random
from datetime import date
from typing import Any, Dict, List, Optional
import anthropic
from django.core.cache import cache
from django.db.models import Count, Q
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from seasons.models import Season
from entries.models import DriverSeason
from results.models import Race, RaceResult
from results.scoring import points_for_result
from results.cache import (
    CACHE_TTL, key_race_detail, key_last_race, key_next_race_teaser, key_hof,
    key_history_teaser,
)
from .utils import (
    serialize_race_basic, serialize_track, serialize_driver, serialize_team, initials_for
)


class RaceDetailView(APIView):
    """
    GET /api/seasons/<season_id>/races/<round>/
    Optional: ?is_sprint=1  (default 0)

    Returns the full classified grid for a single race.
    """
    permission_classes = [AllowAny]

    def get(self, request, season_id: int, round: int, *args, **kwargs):
        is_sprint = str(request.GET.get("is_sprint", "")).lower() in ("1", "true", "yes")

        try:
            race = Race.objects.select_related("track", "season").get(
                season_id=season_id, round=round, is_sprint=is_sprint
            )
        except Race.DoesNotExist:
            return Response({"detail": "Race not found."}, status=404)

        ck = key_race_detail(race.id)
        cached = cache.get(ck)
        if cached is not None:
            return Response(cached)

        results = (
            RaceResult.objects
            .filter(race=race)
            .select_related(
                "driver_season__driver",
                "driver_season__team_season__team",
            )
            .order_by("finish_position", "driver_season_id")
        )

        data = {
            "race": {
                "id": race.id,
                "round": race.round,
                "is_sprint": race.is_sprint,
                "laps": race.laps,
                "started_at": race.started_at,
                "track": serialize_track(race.track),
            },
            "results": [
                {
                    "driver_season_id": rr.driver_season_id,
                    "finish_position": rr.finish_position,
                    "grid_position": rr.grid_position,
                    "status": rr.status,
                    "laps_completed": rr.laps_completed,
                    "fastest_lap": rr.fastest_lap,
                    "pole_position": rr.pole_position,
                    "dotd": rr.dotd,
                    "cleanest_driver": rr.cleanest_driver,
                    "most_overtakes": rr.most_overtakes,
                    "points": points_for_result(rr),
                    "driver": serialize_driver(rr.driver_season.driver),
                    "team": serialize_team(
                        getattr(getattr(rr.driver_season, "team_season", None), "team", None)
                    ),
                }
                for rr in results
            ],
        }
        cache.set(ck, data, timeout=CACHE_TTL)
        return Response(data)

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

        ck = key_last_race(season_id, include_sprints)
        cached = cache.get(ck)
        if cached is not None:
            return Response(cached)

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

        data = {
            "season_id": int(season_id),
            "include_sprints": include_sprints,
            "last_race": last_race_payload,
            "next_race": next_race_payload,
        }
        cache.set(ck, data, timeout=CACHE_TTL)
        return Response(data)


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

        ck = key_next_race_teaser(include_sprints)
        cached = cache.get(ck)
        if cached is not None:
            return Response(cached)

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
                    "laps": upcoming.laps,
                    "started_at": upcoming.started_at,
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

        main_races = Race.objects.filter(season=latest_season, is_sprint=False)
        total_rounds = main_races.count()
        completed_rounds = main_races.filter(results__isnull=False).distinct().count()

        data = {
            "season_id": latest_season.id if latest_season else None,
            "upcoming_race": upcoming_payload,
            "recent_winners": recent_winners,
            "following_two": following_two,
            "total_rounds": total_rounds,
            "completed_rounds": completed_rounds,
        }
        cache.set(ck, data, timeout=CACHE_TTL)
        return Response(data)


def _generate_history_blurb(
    season_id: int, round_num: int, track_name: str, results: list, race_notes: str = ""
) -> Optional[Dict[str, str]]:
    """Call Claude Haiku to produce a blurb + winner quote. Returns {"blurb": ..., "quote": ...} or None."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return None

    winner = results[0] if results else None
    if not winner:
        return None

    podium_lines = []
    for r in results:
        notes = []
        if r.get("pole_position"):
            notes.append("pole position")
        if r.get("fastest_lap"):
            notes.append("fastest lap")
        note_str = f" ({', '.join(notes)})" if notes else ""
        podium_lines.append(f"P{r['finish_position']}: {r['driver']['display_name']} ({r['team']['name']}){note_str}")

    podium_text = "\n".join(podium_lines)
    notes_section = f"\nRace notes: {race_notes.strip()}" if race_notes.strip() else ""

    prompt = (
        f"You are writing content for a CGR League flashback card — a private Formula-style racing league archive.\n\n"
        f"Race: Season {season_id}, Round {round_num} at {track_name}\n"
        f"Podium:\n{podium_text}{notes_section}\n\n"
        f"Return a JSON object with exactly two keys:\n"
        f"- \"blurb\": 1-2 sentences (max 45 words total) in past tense. "
        f"Write like a line from a season review documentary — reflective and archival, not a live broadcast. "
        f"Lead with the most interesting angle (a sweep, an upset, a dominant run, a tight battle) rather than just restating the podium order. "
        f"Avoid clichés like 'dominated', 'claimed victory', 'secured the win', 'stormed to'. "
        f"The winner's name should not be the very first word. No time-specific references.\n"
        f"- \"quote\": A fabricated first-person quote (max 35 words) from the race winner, written as if recalled in a season retrospective — "
        f"reflective, specific, one clear thought. Reference something concrete: a moment in the race, a battle, a decision, a particular lap. "
        f"Do not use generic celebration language ('I'm so happy', 'the team was amazing'). "
        f"The winner's name should not appear in the quote itself — it will be attributed separately.\n\n"
        f"Output only valid JSON, no code fences."
    )

    try:
        import json as _json
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=220,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip().strip("`").removeprefix("json").strip()
        return _json.loads(raw)
    except Exception:
        return None


def choose_flashback_race() -> Optional["Race"]:
    """
    Pick the history-teaser ("flashback") race: a completed non-sprint race from
    a PRIOR season at the same track as the upcoming race ("last time we raced
    here"). Prefers a race a human won. Deterministic per calendar day.

    Shared by HistoryTeaserView and the admin "generate today's blurb" action so
    the featured race and the blurb it generates can't drift apart. Returns None
    when there's no suitable candidate.
    """
    latest_season = Season.objects.order_by("-id").first()
    if not latest_season:
        return None

    # Target track = the upcoming race's track (next non-sprint race with no
    # results). If the season is complete, fall back to the most recently
    # completed race's track.
    upcoming = (
        Race.objects
        .filter(season=latest_season, is_sprint=False)
        .annotate(result_count=Count("results"))
        .filter(result_count=0)
        .order_by("round")
        .first()
    )
    if upcoming:
        target_track_id = upcoming.track_id
    else:
        last_completed = (
            Race.objects
            .filter(season=latest_season, is_sprint=False, results__isnull=False)
            .order_by("-round")
            .first()
        )
        target_track_id = last_completed.track_id if last_completed else None

    if target_track_id is None:
        return None

    # Completed non-sprint races at that track in prior seasons
    candidates = list(
        Race.objects
        .filter(track_id=target_track_id, is_sprint=False, season_id__lt=latest_season.id)
        .annotate(result_count=Count("results"))
        .filter(result_count__gt=0)
        .select_related("track", "season")
        .order_by("season_id")
    )
    if not candidates:
        return None

    # Prefer a race where a human driver won; fall back to any
    human_wins = [
        r for r in candidates
        if RaceResult.objects.filter(
            race=r, finish_position=1,
            driver_season__driver__human=True,
        ).exists()
    ]
    pool = human_wins if human_wins else candidates

    rng = random.Random(date.today().toordinal())
    return rng.choice(pool)


def get_or_create_flashback_blurb(race, results_payload):
    """
    Return the stored HistoryTeaserBlurb for `race`, generating and persisting it
    once on first access. The row is kept forever, so a given race's blurb is
    generated at most one time no matter how many times the site is viewed
    (manual re-generation via the admin still overwrites it). Returns None if no
    ANTHROPIC_API_KEY is configured or generation fails — the teaser then renders
    without editorial text.
    """
    from results.models import HistoryTeaserBlurb

    existing = HistoryTeaserBlurb.objects.filter(race=race).first()
    if existing is not None:
        return existing

    result = _generate_history_blurb(
        race.season_id, race.round, race.track.name,
        results_payload, race_notes=race.race_notes or "",
    )
    if not result or not result.get("blurb"):
        return None

    obj, _ = HistoryTeaserBlurb.objects.update_or_create(
        race=race,
        defaults={"blurb": result["blurb"], "quote": result.get("quote", "")},
    )
    return obj


class HistoryTeaserView(APIView):
    """
    GET /api/teasers/history/

    Returns a notable result from a PRIOR season at the same track as the
    upcoming race — i.e. "last time we raced here." Picks deterministically
    per calendar day (date-seeded random) so it changes daily but is stable
    within a day.
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        ck = key_history_teaser()
        cached = cache.get(ck)
        if cached is not None:
            return Response(cached)

        chosen = choose_flashback_race()
        if chosen is None:
            cache.set(ck, None, timeout=CACHE_TTL)
            return Response(None)

        top3 = list(
            RaceResult.objects
            .filter(race=chosen, finish_position__isnull=False)
            .select_related(
                "driver_season__driver",
                "driver_season__team_season__team",
            )
            .order_by("finish_position")[:3]
        )

        results_payload = [
            {
                "finish_position": rr.finish_position,
                "fastest_lap": rr.fastest_lap,
                "pole_position": rr.pole_position,
                "points": points_for_result(rr),
                "driver": serialize_driver(rr.driver_season.driver),
                "team": serialize_team(
                    getattr(getattr(rr.driver_season, "team_season", None), "team", None)
                ),
            }
            for rr in top3
        ]

        blurb_obj = get_or_create_flashback_blurb(chosen, results_payload)
        blurb = blurb_obj.blurb if blurb_obj else None
        quote = blurb_obj.quote if blurb_obj else None

        data = {
            "season_id": chosen.season_id,
            "race": {
                "id": chosen.id,
                "round": chosen.round,
                "track": serialize_track(chosen.track),
            },
            "results": results_payload,
            "blurb": blurb,
            "quote": quote,
        }
        cache.set(ck, data, timeout=CACHE_TTL)
        return Response(data)
