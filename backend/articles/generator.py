"""
Article generation logic for CGR League.

Entry point: generate_articles_for_race(race_id)
  - Generates a RECAP for the given completed race
  - Generates a PREVIEW for the next race in the season (if one exists)
  - Both require ANTHROPIC_API_KEY in the environment
"""

import json
import logging
import os

import anthropic
from django.db.models import Sum, F, Q, FloatField
from django.db.models.functions import Coalesce

from entries.models import DriverSeason
from results.models import Race, RaceResult
from results.api.views.utils import points_case, fl_bonus_case
from .models import Article

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are a sports journalist covering CGR League, a private Formula 1-style racing league "
    "played on a video game simulator. Write in an engaging, analytical style — punchy sentences, "
    "specific references to names and numbers, no generic filler. "
    "Always respond with valid JSON in exactly this shape (no markdown fences):\n"
    '{"title": "<headline, max 100 chars>", '
    '"teaser": "<one or two sentence hook, max 200 chars>", '
    '"content": "<full article body, paragraphs separated by \\n\\n>"}'
)


# ─── helpers ────────────────────────────────────────────────────────────────

def _name(driver):
    return f"{driver.first_name} {driver.last_name}".strip()


def _get_standings(season, up_to_round):
    qs = (
        DriverSeason.objects
        .filter(season=season)
        .select_related("driver", "team_season__team")
        .annotate(
            base_points=Coalesce(
                Sum(points_case(), filter=Q(results__race__round__lte=up_to_round)), 0
            ),
            fl_bonus=Coalesce(
                Sum(fl_bonus_case(), filter=Q(results__race__round__lte=up_to_round)), 0
            ),
        )
        .annotate(points=F("base_points") + F("fl_bonus"))
        .order_by("-points", "driver__last_name")
    )
    rows = []
    for i, ds in enumerate(qs, 1):
        team_name = (
            ds.team_season.team.team_name
            if ds.team_season and ds.team_season.team else "—"
        )
        rows.append({
            "pos": i,
            "name": _name(ds.driver),
            "team": team_name,
            "points": int(ds.points),
            "is_human": ds.driver.human,
        })
    return rows


def _get_track_winners(track, exclude_race):
    """Up to 5 previous race winners at this track."""
    winners = (
        RaceResult.objects
        .filter(race__track=track, finish_position=1)
        .exclude(race=exclude_race)
        .select_related("race__season", "driver_season__driver")
        .order_by("-race__season_id", "-race__round")
        [:5]
    )
    return [
        {
            "season": r.race.season_id,
            "round": r.race.round,
            "winner": _name(r.driver_season.driver),
        }
        for r in winners
    ]


def _get_driver_track_history(season, track):
    """
    Returns a dict of {driver_name: [result, ...]} for every human driver
    in `season`, using their results at `track` from any season.
    Drivers with no prior results at the track are included with an empty list.
    """
    season_drivers = list(
        DriverSeason.objects
        .filter(season=season, driver__human=True)
        .select_related("driver")
    )
    driver_ids = [ds.driver_id for ds in season_drivers]

    results = (
        RaceResult.objects
        .filter(race__track=track, driver_season__driver_id__in=driver_ids)
        .select_related("driver_season__driver", "race__season")
        .order_by("driver_season__driver__last_name", "-race__season_id", "-race__round")
    )

    by_driver = {_name(ds.driver): [] for ds in season_drivers}
    for r in results:
        name = _name(r.driver_season.driver)
        by_driver[name].append({
            "season": r.race.season_id,
            "finish": r.finish_position,
            "status": r.status,
        })
    return by_driver


def _get_human_driver_names(season):
    ds_list = (
        DriverSeason.objects
        .filter(season=season, driver__human=True)
        .select_related("driver")
    )
    return [_name(ds.driver) for ds in ds_list]


# ─── text formatters ─────────────────────────────────────────────────────────

def _fmt_results(race):
    results = (
        RaceResult.objects
        .filter(race=race)
        .select_related("driver_season__driver", "driver_season__team_season__team")
        .order_by("finish_position", "driver_season__driver__last_name")
    )
    lines = []
    for r in results:
        driver = r.driver_season.driver
        team = r.driver_season.team_season.team
        pos = r.finish_position or "DNF"
        grid = r.grid_position or "?"
        flags = []
        if r.pole_position:    flags.append("Pole")
        if r.fastest_lap:     flags.append("Fastest Lap")
        if r.dotd:            flags.append("DOTD")
        if r.cleanest_driver: flags.append("Cleanest Driver")
        if r.most_overtakes:  flags.append("Most Overtakes")
        flag_str = f" [{', '.join(flags)}]" if flags else ""
        human_tag = "" if driver.human else " [AI]"
        lines.append(
            f"  P{pos} (Grid {grid}): {_name(driver)}{human_tag} ({team.team_name})"
            f" — {r.points} pts, {r.status}{flag_str}"
        )
    return "\n".join(lines)


def _fmt_standings(rows):
    lines = []
    for s in rows:
        human_tag = "" if s["is_human"] else " [AI]"
        lines.append(f"  P{s['pos']}: {s['name']}{human_tag} ({s['team']}) — {s['points']} pts")
    return "\n".join(lines)


def _fmt_track_winners(winners):
    if not winners:
        return "  No previous races at this track."
    return "\n".join(
        f"  Season {w['season']} R{w['round']}: {w['winner']}" for w in winners
    )


def _fmt_driver_track_history(by_driver):
    if not by_driver:
        return "  No prior results at this track."
    lines = []
    for name, results in sorted(by_driver.items()):
        if not results:
            lines.append(f"  {name}: No prior results")
        else:
            detail = ", ".join(
                f"S{r['season']} P{r['finish'] or r['status']}" for r in results
            )
            lines.append(f"  {name}: {detail}")
    return "\n".join(lines)


# ─── Claude call ─────────────────────────────────────────────────────────────

def _call_claude(user_prompt):
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY environment variable is not set")

    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=1800,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )
    raw = message.content[0].text.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Strip accidental markdown fences and retry
        cleaned = raw.strip("`").removeprefix("json").strip()
        return json.loads(cleaned)


# ─── article generators ───────────────────────────────────────────────────────

def generate_recap(race):
    """Generate and save a RECAP Article for a completed race."""
    season = race.season
    track = race.track
    kind = "Sprint" if race.is_sprint else "Grand Prix"

    standings = _get_standings(season, race.round)
    track_winners = _get_track_winners(track, exclude_race=race)
    human_names = _get_human_driver_names(season)

    prompt = f"""Write a race recap article for the following CGR League race.

RACE: Season {season.id} — Round {race.round} {kind} at {track.name} ({track.city}, {track.country})
Track length: {track.distance}m

RACE RESULTS:
{_fmt_results(race)}

SEASON STANDINGS AFTER THIS RACE:
{_fmt_standings(standings)}

PREVIOUS RACE WINNERS AT {track.name.upper()}:
{_fmt_track_winners(track_winners)}

IMPORTANT RULES:
- You MUST write at least one meaningful, specific paragraph about EACH of these human drivers \
(tagged without [AI]): {', '.join(human_names)}
- Reference their actual finishing position, points scored, and anything notable about their race
- Discuss championship implications using the standings above
- Highlight key moments: pole, fastest lap, DOTD, Cleanest Driver, Most Overtakes
- Ignore [AI]-tagged drivers entirely
- Length: 450–650 words, paragraphs separated by \\n\\n
- Return valid JSON only, no markdown fences"""

    data = _call_claude(prompt)
    article = Article.objects.create(
        race=race,
        type=Article.RECAP,
        title=data["title"],
        teaser=data["teaser"],
        content=data["content"],
    )
    logger.info("Created RECAP article %d for %s", article.id, race)
    return article


def generate_preview(next_race, after_race):
    """Generate and save a PREVIEW Article for an upcoming race."""
    season = next_race.season
    track = next_race.track
    kind = "Sprint" if next_race.is_sprint else "Grand Prix"

    standings = _get_standings(season, after_race.round)
    track_winners = _get_track_winners(track, exclude_race=next_race)
    driver_track_history = _get_driver_track_history(season, track)
    human_names = _get_human_driver_names(season)

    prompt = f"""Write a race preview article for the following upcoming CGR League race.

UPCOMING RACE: Season {season.id} — Round {next_race.round} {kind} at {track.name} \
({track.city}, {track.country})
Track length: {track.distance}m

CURRENT CHAMPIONSHIP STANDINGS (after Round {after_race.round}):
{_fmt_standings(standings)}

PREVIOUS RACE WINNERS AT {track.name.upper()}:
{_fmt_track_winners(track_winners)}

DRIVER HISTORY AT THIS TRACK (human drivers only):
{_fmt_driver_track_history(driver_track_history)}

IMPORTANT RULES:
- You MUST write at least one meaningful, specific paragraph about EACH of these human drivers: \
{', '.join(human_names)}
- Reference their championship position, points, and any relevant track history
- Discuss the championship stakes — who needs points, who's leading, who's within striking distance
- Use track history to suggest who might have an edge
- Length: 450–650 words, paragraphs separated by \\n\\n
- Return valid JSON only, no markdown fences"""

    data = _call_claude(prompt)
    article = Article.objects.create(
        race=next_race,
        type=Article.PREVIEW,
        title=data["title"],
        teaser=data["teaser"],
        content=data["content"],
    )
    logger.info("Created PREVIEW article %d for %s", article.id, next_race)
    return article


# ─── public entry point ───────────────────────────────────────────────────────

def generate_articles_for_race(race_id):
    """
    Given a completed race_id, generate:
      - A RECAP article for that race
      - A PREVIEW article for the next race in the season (if one exists)

    Returns (recap_article, preview_article_or_None).
    """
    race = Race.objects.select_related("season", "track").get(pk=race_id)
    recap = generate_recap(race)

    next_race = (
        Race.objects
        .filter(season=race.season, round__gt=race.round)
        .select_related("season", "track")
        .order_by("round")
        .first()
    )
    preview = generate_preview(next_race, after_race=race) if next_race else None
    return recap, preview
