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
from seasons.models import Season
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


def _get_track_winners(track, exclude_race, cutoff_race=None):
    """Up to 5 previous race winners at this track, capped to before cutoff_race if given."""
    from django.db.models import Q as _Q
    qs = (
        RaceResult.objects
        .filter(race__track=track, finish_position=1)
        .exclude(race=exclude_race)
        .select_related("race__season", "driver_season__driver")
    )
    if cutoff_race is not None:
        qs = qs.filter(
            _Q(race__season_id__lt=cutoff_race.season_id) |
            _Q(race__season_id=cutoff_race.season_id, race__round__lt=cutoff_race.round)
        )
    winners = qs.order_by("-race__season_id", "-race__round")[:5]
    return [
        {
            "season": r.race.season_id,
            "round": r.race.round,
            "winner": _name(r.driver_season.driver),
        }
        for r in winners
    ]


def _get_driver_track_history(season, track, cutoff_race=None):
    """
    Returns a dict of {driver_name: [result, ...]} for every human driver
    in `season`, using their results at `track` from any season.
    Drivers with no prior results at the track are included with an empty list.
    If cutoff_race is given, only results before that race are included.
    """
    from django.db.models import Q as _Q
    season_drivers = list(
        DriverSeason.objects
        .filter(season=season, driver__human=True)
        .select_related("driver")
    )
    driver_ids = [ds.driver_id for ds in season_drivers]

    results = RaceResult.objects.filter(
        race__track=track, driver_season__driver_id__in=driver_ids
    )
    if cutoff_race is not None:
        results = results.filter(
            _Q(race__season_id__lt=cutoff_race.season_id) |
            _Q(race__season_id=cutoff_race.season_id, race__round__lt=cutoff_race.round)
        )
    results = (
        results
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


def _get_name_collision_note(season):
    """
    Returns a prompt instruction block if any drivers in the season share a last name,
    e.g. "J. Smith and T. Smith share the last name 'Smith'".
    Returns "" if no collisions exist.
    """
    from collections import defaultdict
    ds_list = (
        DriverSeason.objects
        .filter(season=season)
        .select_related("driver")
    )
    by_last = defaultdict(list)
    for ds in ds_list:
        by_last[ds.driver.last_name].append(ds.driver)

    pairs = []
    for last_name, drivers in by_last.items():
        if len(drivers) > 1:
            names = " and ".join(
                f"{d.first_name[0]}. {d.last_name}" if d.first_name else d.last_name
                for d in sorted(drivers, key=lambda d: d.first_name or "")
            )
            pairs.append(f"  - {names} share the surname '{last_name}' — always write them as {names}")

    if not pairs:
        return ""
    return (
        "NAME COLLISIONS — these drivers share a surname; always use first initial + last name:\n"
        + "\n".join(pairs)
    )


# ─── text formatters ─────────────────────────────────────────────────────────

def _fmt_results(race):
    from django.db.models import F as _F
    results = (
        RaceResult.objects
        .filter(race=race)
        .select_related("driver_season__driver", "driver_season__team_season__team")
        .order_by(_F("finish_position").asc(nulls_last=True), "driver_season__driver__last_name")
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
        human_tag = " (Human)" if driver.human else ""
        lines.append(
            f"  P{pos} (Grid {grid}): {_name(driver)}{human_tag} ({team.team_name})"
            f" — {r.points} pts, {r.status}{flag_str}"
        )
    return "\n".join(lines)


def _fmt_standings(rows):
    lines = []
    for s in rows:
        human_tag = " (Human)" if s["is_human"] else ""
        lines.append(f"  P{s['pos']}: {s['name']}{human_tag} ({s['team']}) — {s['points']} pts")
    return "\n".join(lines)


def _get_constructor_standings(season, up_to_round):
    from django.db.models import Sum
    base_pts = points_case(prefix="")
    fl_bonus = fl_bonus_case(prefix="")
    qs = (
        RaceResult.objects
        .filter(race__season=season, race__round__lte=up_to_round)
        .select_related("driver_season__team_season__team")
        .annotate(pts_row=base_pts + fl_bonus)
        .values(
            "driver_season__team_season__team__team_name",
            "driver_season__team_season__display_name",
        )
        .annotate(points=Sum("pts_row"))
        .order_by("-points")
    )
    rows = []
    for i, row in enumerate(qs, 1):
        team_name = row["driver_season__team_season__team__team_name"] or "—"
        display_name = row["driver_season__team_season__display_name"] or team_name
        rows.append({"pos": i, "team": display_name, "points": int(row["points"] or 0)})
    return rows


def _fmt_constructor_standings(rows):
    if not rows:
        return "  No constructor data available."
    return "\n".join(f"  P{r['pos']}: {r['team']} — {r['points']} pts" for r in rows)


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

def _call_claude(user_prompt, max_tokens=2000):
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY environment variable is not set")

    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=max_tokens,
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


# ─── rivalry callout ─────────────────────────────────────────────────────────

def _generate_rivalry_callout(race):
    """
    Second-pass prompt: extract the single best on-track battle from the race.
    Returns a plain-text description string, or "" on failure.
    """
    prompt = f"""Based on these race results from a CGR League race at {race.track.name} \
(Season {race.season_id}, Round {race.round}), identify the single most compelling \
on-track battle or storyline between two specific drivers.

RACE RESULTS:
{_fmt_results(race)}

Write exactly 2–3 punchy sentences describing the key battle — the positions at stake, \
the tension, and the outcome. Use the drivers' real names. Be vivid and specific.

Return JSON only: {{"driver_a": "Full Name", "driver_b": "Full Name", "description": "2-3 sentences"}}"""
    try:
        data = _call_claude(prompt)
        return data.get("description", "")
    except Exception:
        logger.warning("Rivalry callout generation failed for race %s", race)
        return ""


# ─── article generators ───────────────────────────────────────────────────────

def generate_recap(race):
    """Generate and save a RECAP Article for a completed race."""
    season = race.season
    track = race.track
    kind = "Sprint" if race.is_sprint else "Grand Prix"

    standings = _get_standings(season, race.round)
    constructor_standings = _get_constructor_standings(season, race.round)
    track_winners = _get_track_winners(track, exclude_race=race, cutoff_race=race)
    human_names = _get_human_driver_names(season)
    collision_note = _get_name_collision_note(season)

    notes_block = f"\nRACE NOTES (from the league admin — treat as factual context):\n{race.race_notes.strip()}\n" if race.race_notes.strip() else ""
    collision_block = f"\n{collision_note}" if collision_note else ""

    prompt = f"""Write a race recap article for the following CGR League race.

RACE: Season {season.id} — Round {race.round} {kind} at {track.name} ({track.city}, {track.country})
Track length: {track.distance}m
{notes_block}
RACE RESULTS:
{_fmt_results(race)}

DRIVER CHAMPIONSHIP STANDINGS AFTER THIS RACE:
{_fmt_standings(standings)}

CONSTRUCTOR CHAMPIONSHIP STANDINGS AFTER THIS RACE:
{_fmt_constructor_standings(constructor_standings)}

PREVIOUS RACE WINNERS AT {track.name.upper()}:
{_fmt_track_winners(track_winners)}

IMPORTANT RULES:
- You MUST write at least one dedicated, specific paragraph about EACH of these human drivers: \
{', '.join(human_names)}
- Reference their EXACT finishing position and points from the results above — do not invent or \
approximate results
- AI drivers may be mentioned naturally by name when relevant (battles, notable moments, etc.)
- Discuss championship implications using BOTH the driver and constructor standings above — \
include at least one sentence on the constructor battle
- Highlight key moments: pole, fastest lap, DOTD, Cleanest Driver, Most Overtakes{collision_block}
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

    rivalry = _generate_rivalry_callout(race)
    if rivalry:
        article.rivalry_callout = rivalry
        article.save(update_fields=["rivalry_callout"])

    return article


def generate_preview(next_race, after_race):
    """Generate and save a PREVIEW Article for an upcoming race."""
    season = next_race.season
    track = next_race.track
    kind = "Sprint" if next_race.is_sprint else "Grand Prix"

    standings = _get_standings(season, after_race.round)
    constructor_standings = _get_constructor_standings(season, after_race.round)
    track_winners = _get_track_winners(track, exclude_race=next_race, cutoff_race=next_race)
    driver_track_history = _get_driver_track_history(season, track, cutoff_race=next_race)
    human_names = _get_human_driver_names(season)
    collision_note = _get_name_collision_note(season)

    notes_block = f"\nRACE NOTES (from the league admin — treat as factual context):\n{next_race.race_notes.strip()}\n" if next_race.race_notes.strip() else ""
    collision_block = f"\n{collision_note}" if collision_note else ""

    prompt = f"""Write a race preview article for the following upcoming CGR League race.

UPCOMING RACE: Season {season.id} — Round {next_race.round} {kind} at {track.name} \
({track.city}, {track.country})
Track length: {track.distance}m
{notes_block}
CURRENT DRIVER CHAMPIONSHIP STANDINGS (after Round {after_race.round}):
{_fmt_standings(standings)}

CURRENT CONSTRUCTOR CHAMPIONSHIP STANDINGS (after Round {after_race.round}):
{_fmt_constructor_standings(constructor_standings)}

PREVIOUS RACE WINNERS AT {track.name.upper()}:
{_fmt_track_winners(track_winners)}

DRIVER HISTORY AT THIS TRACK (human drivers only):
{_fmt_driver_track_history(driver_track_history)}

IMPORTANT RULES:
- You MUST write at least one dedicated, specific paragraph about EACH of these human drivers: \
{', '.join(human_names)}
- Reference their EXACT championship position and points from the standings above — do not invent \
or approximate
- AI drivers may be mentioned naturally by name when relevant
- Discuss the championship stakes for BOTH drivers and constructors — who needs points, who's \
leading, which teams are scrapping for position
- Use track history to suggest who might have an edge{collision_block}
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

    sidebar = _generate_preview_sidebar(next_race, standings, driver_track_history)
    if sidebar:
        article.preview_sidebar = sidebar
        article.save(update_fields=["preview_sidebar"])

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


# ─── preview sidebar ─────────────────────────────────────────────────────────

def _generate_preview_sidebar(next_race, standings, driver_track_history):
    """
    Third-pass prompt for race preview articles.
    Returns a dict with 'head_to_head' and 'drivers_to_watch', or None on failure.

    Expected shape:
    {
        "head_to_head": {
            "driver_a": "Full Name",
            "driver_b": "Full Name",
            "context": "2-3 punchy sentences about this matchup"
        },
        "drivers_to_watch": [
            {"name": "Full Name", "reason": "Why to watch", "stat": "One key stat"},
            ...  // 3 drivers
        ]
    }
    """
    track = next_race.track

    standings_block = _fmt_standings(standings)
    history_block = _fmt_driver_track_history(driver_track_history)

    prompt = f"""You are picking the highlights for a race preview sidebar for the upcoming \
CGR League race at {track.name} (Season {next_race.season_id}, Round {next_race.round}).

CHAMPIONSHIP STANDINGS:
{standings_block}

DRIVER HISTORY AT {track.name.upper()} (human drivers):
{history_block}

Your job:
1. Pick the single best HEAD-TO-HEAD matchup — ideally two drivers close in the standings or \
with a rivalry at this track. At least one should be a Human driver. Write 2–3 punchy sentences \
about why this battle matters.

2. Pick exactly 3 DRIVERS TO WATCH (mix of human and AI is fine). For each, write a short reason \
(1 sentence) and a single key stat (e.g. "P1 here last season", "3 wins in last 4 races", \
"yet to score at this track").

Return JSON only — no markdown, no extra keys:
{{
  "head_to_head": {{
    "driver_a": "Full Name",
    "driver_b": "Full Name",
    "context": "2-3 sentences"
  }},
  "drivers_to_watch": [
    {{"name": "Full Name", "reason": "One sentence", "stat": "Key stat"}},
    {{"name": "Full Name", "reason": "One sentence", "stat": "Key stat"}},
    {{"name": "Full Name", "reason": "One sentence", "stat": "Key stat"}}
  ]
}}"""

    try:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            return None
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=900,
            system=(
                "You are a sports journalist. Always respond with valid JSON only — "
                "no markdown fences, no extra text."
            ),
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip().strip("`").removeprefix("json").strip()
        data = json.loads(raw)
        # Basic validation
        if "head_to_head" in data and "drivers_to_watch" in data:
            return data
        return None
    except Exception:
        logger.warning("Preview sidebar generation failed for race %s", next_race)
        return None


# ─── season helpers ───────────────────────────────────────────────────────────

def _get_all_season_results(season):
    """All race results for a season, ordered by round then finish position."""
    from django.db.models import F as _F
    return (
        RaceResult.objects
        .filter(race__season=season)
        .select_related(
            "race__track",
            "driver_season__driver",
            "driver_season__team_season__team",
        )
        .order_by("race__round", _F("finish_position").asc(nulls_last=True))
    )


def _fmt_season_results(season):
    """Compact per-race summary for each round."""
    results = _get_all_season_results(season)

    by_round = {}
    for r in results:
        rnd = r.race.round
        if rnd not in by_round:
            by_round[rnd] = {"race": r.race, "lines": []}
        driver = r.driver_season.driver
        pos = r.finish_position or "DNF"
        human_tag = " (Human)" if driver.human else ""
        by_round[rnd]["lines"].append(
            f"    P{pos}: {_name(driver)}{human_tag} — {r.points} pts"
        )

    sections = []
    for rnd in sorted(by_round):
        race = by_round[rnd]["race"]
        kind = "Sprint" if race.is_sprint else "GP"
        sections.append(f"  Round {rnd} {kind} — {race.track.name}:")
        sections.extend(by_round[rnd]["lines"])
    return "\n".join(sections)


def _get_season_highlights(season):
    """Pole sitters, fastest laps, DOTD, wins per driver."""
    results = _get_all_season_results(season)
    wins, poles, fls, dotds = {}, {}, {}, {}
    for r in results:
        name = _name(r.driver_season.driver)
        if r.finish_position == 1:
            wins[name] = wins.get(name, 0) + 1
        if r.pole_position:
            poles[name] = poles.get(name, 0) + 1
        if r.fastest_lap:
            fls[name] = fls.get(name, 0) + 1
        if r.dotd:
            dotds[name] = dotds.get(name, 0) + 1

    lines = []
    if wins:
        lines.append("  Wins: " + ", ".join(f"{n} ({c})" for n, c in sorted(wins.items(), key=lambda x: -x[1])))
    if poles:
        lines.append("  Poles: " + ", ".join(f"{n} ({c})" for n, c in sorted(poles.items(), key=lambda x: -x[1])))
    if fls:
        lines.append("  Fastest Laps: " + ", ".join(f"{n} ({c})" for n, c in sorted(fls.items(), key=lambda x: -x[1])))
    if dotds:
        lines.append("  Driver of the Day: " + ", ".join(f"{n} ({c})" for n, c in sorted(dotds.items(), key=lambda x: -x[1])))
    return "\n".join(lines) if lines else "  No highlights available."


# ─── season article generators ────────────────────────────────────────────────

def generate_season_recap(season):
    """Generate and save a SEASON_RECAP Article for a completed season."""
    final_standings = _get_standings(season, up_to_round=9999)
    human_names = _get_human_driver_names(season)
    race_count = Race.objects.filter(season=season).count()
    collision_note = _get_name_collision_note(season)

    notes_block = f"\nSEASON NOTES (from the league admin — treat as factual context):\n{season.season_notes.strip()}\n" if season.season_notes.strip() else ""
    collision_block = f"\n{collision_note}" if collision_note else ""

    prompt = f"""Write a season review article for CGR League Season {season.id} ({season.game}).

SEASON OVERVIEW:
  Total rounds: {race_count}
  Game: {season.game}
{notes_block}

FINAL CHAMPIONSHIP STANDINGS:
{_fmt_standings(final_standings)}

SEASON HIGHLIGHTS (wins, poles, fastest laps, DOTD):
{_get_season_highlights(season)}

ROUND-BY-ROUND RESULTS:
{_fmt_season_results(season)}

IMPORTANT RULES:
- You MUST write at least one dedicated, specific paragraph about EACH of these human drivers: \
{', '.join(human_names)}
- Reference their EXACT final championship position and points — do not invent or approximate
- AI drivers may be mentioned naturally by name when relevant
- Cover the season arc: early leader, title battles, who faded, who improved
- Highlight standout moments: dominant performances, comeback wins, controversies{collision_block}
- Length: 800–1100 words, paragraphs separated by \\n\\n
- Return valid JSON only, no markdown fences"""

    data = _call_claude(prompt, max_tokens=3200)
    article = Article.objects.create(
        season=season,
        type=Article.SEASON_RECAP,
        title=data["title"],
        teaser=data["teaser"],
        content=data["content"],
    )
    logger.info("Created SEASON_RECAP article %d for Season %s", article.id, season.id)
    return article


def generate_season_preview(season):
    """Generate and save a SEASON_PREVIEW Article for an upcoming season."""
    human_names = _get_human_driver_names(season)
    final_standings = _get_standings(season, up_to_round=9999)
    collision_note = _get_name_collision_note(season)
    races = (
        Race.objects
        .filter(season=season)
        .select_related("track")
        .order_by("round")
    )
    race_count = races.count()
    calendar_lines = [
        f"  Round {r.round}{'(Sprint)' if r.is_sprint else ''}: {r.track.name} ({r.track.city}, {r.track.country})"
        for r in races
    ]

    notes_block = f"\nSEASON NOTES (from the league admin — treat as factual context):\n{season.season_notes.strip()}\n" if season.season_notes.strip() else ""
    collision_block = f"\n{collision_note}" if collision_note else ""

    prompt = f"""Write a season preview article for the upcoming CGR League Season {season.id} ({season.game}).

SEASON INFO:
  Total rounds: {race_count}
  Game: {season.game}
{notes_block}

SEASON CALENDAR:
{chr(10).join(calendar_lines) if calendar_lines else '  Calendar not yet set.'}

DRIVER ROSTER AND CURRENT STANDINGS/HISTORY:
{_fmt_standings(final_standings)}

IMPORTANT RULES:
- You MUST write at least one dedicated, specific paragraph about EACH of these human drivers: \
{', '.join(human_names)}
- Reference their championship standing and team from the roster above
- AI drivers may be mentioned naturally by name when relevant
- Build anticipation: rivalries to watch, title contenders, tracks to circle on the calendar
- Discuss the format (sprint rounds, total rounds) and what it means for strategy{collision_block}
- Length: 750–1000 words, paragraphs separated by \\n\\n
- Return valid JSON only, no markdown fences"""

    data = _call_claude(prompt, max_tokens=3200)
    article = Article.objects.create(
        season=season,
        type=Article.SEASON_PREVIEW,
        title=data["title"],
        teaser=data["teaser"],
        content=data["content"],
    )
    logger.info("Created SEASON_PREVIEW article %d for Season %s", article.id, season.id)
    return article


# ─── power rankings ───────────────────────────────────────────────────────────

RECENCY_WEIGHTS = [0.35, 0.25, 0.20, 0.12, 0.08]


def _pos_score(pos, n_drivers):
    if pos is None:
        return 0.0
    pct = (pos - 1) / max(n_drivers - 1, 1)
    return max(0.0, (1.0 - pct) ** 2)


def _compute_rankings(race, driver_seasons, completed_races):
    """
    Compute power ranking scores for all drivers up to the given race.
    Returns a list of dicts sorted by score descending.
    """
    from collections import defaultdict

    n_drivers = max(len(driver_seasons), 1)

    results_qs = (
        RaceResult.objects
        .filter(race__in=completed_races)
        .values("driver_season_id", "race_id", "finish_position", "grid_position", "fastest_lap")
    )
    by_driver_race = defaultdict(dict)
    for row in results_qs:
        by_driver_race[row["driver_season_id"]][row["race_id"]] = {
            "finish": row["finish_position"],
            "grid": row["grid_position"],
            "fl": row["fastest_lap"],
        }

    season = race.season
    standings = _get_standings(season, race.round)
    champ_map = {row["name"]: (row["pos"], row["points"]) for row in standings}

    scored = []
    for ds in driver_seasons:
        dr = by_driver_race.get(ds.id, {})
        finishes, grids, fl_flags = [], [], []

        for r in completed_races:
            res = dr.get(r.id)
            if res:
                finishes.append(res["finish"])
                if res["grid"] and res["finish"]:
                    grids.append((res["grid"], res["finish"]))
                fl_flags.append(bool(res["fl"]))
            else:
                finishes.append(None)
                fl_flags.append(False)

        # Recent form: last ≤5 races, most-recent first
        recent_pairs = list(zip(finishes[-5:], fl_flags[-5:]))[::-1]
        r_score, w_sum = 0.0, 0.0
        for i, (pos, _) in enumerate(recent_pairs):
            if i >= len(RECENCY_WEIGHTS):
                break
            w = RECENCY_WEIGHTS[i]
            r_score += w * _pos_score(pos, n_drivers)
            w_sum += w
        recent_score = r_score / w_sum if w_sum else 0.0

        valid = [p for p in finishes if p is not None]
        if len(valid) >= 3:
            valid_for_avg = sorted(valid, key=lambda p: _pos_score(p, n_drivers))[1:]
        else:
            valid_for_avg = valid
        season_avg = (
            sum(_pos_score(p, n_drivers) for p in valid_for_avg) / len(valid_for_avg)
            if valid_for_avg else 0.0
        )

        gains = [(g - f) / max(n_drivers - 1, 1) for g, f in grids]
        gain_score = max(0.0, min(1.0, 0.5 + (sum(gains) / len(gains) if gains else 0.0)))

        fl_count = sum(fl for _, fl in recent_pairs)
        fl_bonus = min(fl_count * 0.03, 0.09)

        raw = (0.55 * recent_score + 0.30 * season_avg + 0.15 * gain_score) * (1 + fl_bonus)
        score = round(min(raw, 1.0) * 100, 1)

        name = _name(ds.driver)
        team_name = (
            ds.team_season.team.team_name
            if ds.team_season and ds.team_season.team else "—"
        )
        team_color = (
            ds.team_season.color
            if ds.team_season and ds.team_season.color else ""
        )
        champ_pos, champ_pts = champ_map.get(name, (None, 0))
        scored.append({
            "driver_id": ds.driver_id,
            "name": name,
            "team": team_name,
            "team_color": team_color,
            "profile_image": ds.driver.profile_image or "",
            "is_human": ds.driver.human,
            "score": score,
            "recent_finishes": finishes[-5:],
            "championship_pos": champ_pos,
            "championship_points": champ_pts,
        })

    scored.sort(key=lambda x: -x["score"])
    for i, d in enumerate(scored):
        d["rank"] = i + 1
    return scored


def _generate_rankings_blurbs(race, ranked_drivers, completed_races):
    """
    Generate 1-2 sentence blurbs for every driver. Returns {name: blurb}.
    When it's the first race of the season, includes previous season final standings as context.
    """
    season = race.season
    collision_note = _get_name_collision_note(season)
    collision_block = f"\n{collision_note}" if collision_note else ""

    is_first_race = len(completed_races) == 1

    lines = []
    for d in ranked_drivers:
        recent_str = ", ".join(f"P{p}" if p else "DNS" for p in d["recent_finishes"])
        human_tag = " (Human)" if d["is_human"] else " (AI)"
        lines.append(
            f"  #{d['rank']} {d['name']}{human_tag} ({d['team']}) — "
            f"Recent results: {recent_str} | "
            f"Championship: P{d['championship_pos'] or '?'} ({d['championship_points']} pts)"
        )

    prev_season_block = ""
    if is_first_race:
        try:
            prev_season = Season.objects.get(pk=season.id - 1)
            prev_standings = _get_standings(prev_season, up_to_round=9999)
            current_names = {d["name"] for d in ranked_drivers}
            returning = [r for r in prev_standings if r["name"] in current_names]
            if returning:
                prev_lines = "\n".join(
                    f"  P{r['pos']} {r['name']} ({r['team']}) — {r['points']} pts"
                    for r in returning
                )
                prev_season_block = (
                    f"\n\nPREVIOUS SEASON (Season {prev_season.id}) FINAL STANDINGS "
                    f"(returning drivers only):\n{prev_lines}\n"
                    f"Use this as background context — mention prior season performance "
                    f"where relevant since this is the very first race of a new season."
                )
        except Season.DoesNotExist:
            pass

    first_race_note = (
        " This is the first race of the season, so lean on pre-season expectations "
        "and prior season form rather than a large results sample."
        if is_first_race else ""
    )

    prompt = (
        f"You are writing power ranking blurbs for CGR League Season {season.id} "
        f"after Round {race.round} at {race.track.name}.\n\n"
        f"POWER RANKINGS (ordered by current form):\n"
        + "\n".join(lines)
        + prev_season_block
        + f"\n\nFor EACH driver listed, write exactly 1–2 punchy sentences capturing their "
        f"current form and story, as if you are a sports writer ranking them yourself. "
        f"Be specific — reference their recent results, championship position, and trajectory."
        f"{first_race_note} "
        f"Never mention scores, algorithms, or numerical ratings — write like it is your editorial opinion. "
        f"Human drivers get slightly more narrative; AI drivers can be more analytical."
        f"{collision_block}\n\n"
        f"Return JSON only — one object, driver names as keys, blurb strings as values:\n"
        f'{{\"Driver Full Name\": \"1-2 sentence blurb.\", ...}}'
    )

    try:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            return {}
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=3000,
            system=(
                "You are a sports journalist. Always respond with valid JSON only — "
                "no markdown fences, no extra text. Keys are exact driver names as given."
            ),
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip().strip("`").removeprefix("json").strip()
        return json.loads(raw)
    except Exception:
        logger.warning("Rankings blurb generation failed for race %s", race)
        return {}


def generate_power_rankings(race):
    """
    Generate and save a POWER_RANKINGS Article for a completed race.
    Computes form-based rankings for all drivers up to this race, generates AI blurbs,
    and stores everything in rankings_data. Replaces any existing article for this race.
    """
    season = race.season

    all_races = list(Race.objects.filter(season=season).order_by("round", "is_sprint"))
    target_idx = next((i for i, r in enumerate(all_races) if r.id == race.id), -1)
    if target_idx < 0:
        raise ValueError(f"Race {race.id} not found in season")

    completed_race_ids = set(
        RaceResult.objects.filter(race__season=season)
        .values_list("race_id", flat=True).distinct()
    )
    completed_races = [
        r for r in all_races[:target_idx + 1] if r.id in completed_race_ids
    ]
    if not completed_races:
        raise ValueError("No completed races found up to this point")

    driver_seasons = list(
        DriverSeason.objects.filter(season=season)
        .select_related("driver", "team_season__team")
    )

    ranked = _compute_rankings(race, driver_seasons, completed_races)

    # Rank delta vs previous power rankings article for this season
    prev_article = (
        Article.objects
        .filter(race__season=season, type=Article.POWER_RANKINGS)
        .exclude(race=race)
        .order_by("-race__round", "-race__is_sprint")
        .first()
    )
    prev_rank_map = {}
    if prev_article and prev_article.rankings_data:
        for entry in prev_article.rankings_data.get("rankings", []):
            prev_rank_map[entry["name"]] = entry["rank"]

    for d in ranked:
        d["prev_rank"] = prev_rank_map.get(d["name"])

    blurbs = _generate_rankings_blurbs(race, ranked, completed_races)

    # Biggest movers (top 3 by absolute rank change, filtered to those with a prev_rank)
    movers = sorted(
        [d for d in ranked if d["prev_rank"] is not None],
        key=lambda x: -abs(x["prev_rank"] - x["rank"]),
    )[:3]
    biggest_movers = [
        {
            "name": d["name"],
            "rank": d["rank"],
            "prev_rank": d["prev_rank"],
            "delta": d["prev_rank"] - d["rank"],
        }
        for d in movers
    ]

    rankings_payload = [
        {
            "rank": d["rank"],
            "prev_rank": d["prev_rank"],
            "driver_id": d["driver_id"],
            "name": d["name"],
            "team": d["team"],
            "team_color": d["team_color"],
            "profile_image": d["profile_image"],
            "is_human": d["is_human"],
            "score": d["score"],
            "blurb": blurbs.get(d["name"], ""),
            "recent_finishes": d["recent_finishes"],
            "championship_pos": d["championship_pos"],
            "championship_points": d["championship_points"],
        }
        for d in ranked
    ]

    rankings_data = {
        "race_round": race.round,
        "is_sprint": race.is_sprint,
        "track_name": race.track.name,
        "rankings": rankings_payload,
        "biggest_movers": biggest_movers,
    }

    leader = ranked[0]["name"] if ranked else "Unknown"
    kind = " (Sprint)" if race.is_sprint else ""
    title = f"Power Rankings — After Round {race.round}{kind}: {race.track.name}"
    teaser = (
        f"{leader} leads the power standings after {race.track.name}. "
        f"See how every driver ranks on current form."
    )

    # Replace any existing power rankings article for this exact race
    Article.objects.filter(race=race, type=Article.POWER_RANKINGS).delete()

    article = Article.objects.create(
        race=race,
        type=Article.POWER_RANKINGS,
        title=title,
        teaser=teaser,
        rankings_data=rankings_data,
    )
    logger.info("Created POWER_RANKINGS article %d for %s", article.id, race)
    return article


def generate_articles_for_season(season_id, recap=True, preview=True):
    """
    Generate season-level articles for the given season_id.
    recap=True  → SEASON_RECAP  (use after season ends)
    preview=True → SEASON_PREVIEW (use before season starts)
    Returns (recap_article_or_None, preview_article_or_None).
    """
    season = Season.objects.get(pk=season_id)
    recap_article = generate_season_recap(season) if recap else None
    preview_article = generate_season_preview(season) if preview else None
    return recap_article, preview_article


def generate_driver_bio(driver_id):
    """
    Generate and save a short career biography for a driver.
    Writes the result directly to Driver.bio and returns the Driver.
    """
    from collections import defaultdict
    from drivers.models import Driver
    from results.scoring import points_for_result

    driver = Driver.objects.get(pk=driver_id)
    driver_name = _name(driver)

    # ── Career stats across all results ─────────────────────────────────────
    results_qs = (
        RaceResult.objects
        .filter(driver_season__driver=driver, race__is_sprint=False)
        .select_related("race__track", "race__season", "driver_season__team_season__team")
        .order_by("race__season_id", "race__round")
    )

    total_points = 0
    wins = 0
    podiums = 0
    poles = 0
    fastest_laps = 0
    dotds = 0
    dnfs = 0
    races = 0
    finishes = []

    track_pts: dict = defaultdict(int)
    track_wins: dict = defaultdict(int)
    track_names: dict = {}

    seasons_set = set()
    team_by_season: dict = defaultdict(set)

    for rr in results_qs:
        races += 1
        total_points += int(points_for_result(rr))
        seasons_set.add(rr.race.season_id)

        team_name = (
            rr.driver_season.team_season.team.team_name
            if rr.driver_season.team_season and rr.driver_season.team_season.team
            else None
        )
        if team_name:
            team_by_season[rr.race.season_id].add(team_name)

        tid = rr.race.track_id
        track_pts[tid] += int(points_for_result(rr))
        track_names[tid] = rr.race.track.name

        fp = rr.finish_position
        status = (rr.status or "").upper()
        if fp == 1:
            wins += 1
            track_wins[tid] += 1
        if fp is not None and fp <= 3:
            podiums += 1
        if fp is not None:
            finishes.append(fp)
        if status and status != "FIN":
            dnfs += 1
        if getattr(rr, "pole_position", False):
            poles += 1
        if getattr(rr, "fastest_lap", False):
            fastest_laps += 1
        if getattr(rr, "dotd", False):
            dotds += 1

    avg_finish = round(sum(finishes) / len(finishes), 1) if finishes else None
    num_seasons = len(seasons_set)

    # Best 3 tracks by points
    best_tracks = sorted(track_pts.items(), key=lambda x: -x[1])[:3]
    best_track_lines = [
        f"  {track_names[tid]}: {pts} pts, {track_wins[tid]} wins"
        for tid, pts in best_tracks
    ]

    # Season history
    season_lines = []
    for sid in sorted(seasons_set):
        teams = ", ".join(sorted(team_by_season[sid])) or "unknown team"
        season_lines.append(f"  Season {sid}: {teams}")

    prompt = f"""Write a short career biography for {driver_name}, a driver in CGR League \
(a private Formula 1-style racing league played on a video game simulator).

CAREER OVERVIEW:
  Seasons competed: {num_seasons}
  Total races: {races}
  Total points: {total_points}
  Wins: {wins}
  Podiums: {podiums}
  Poles: {poles}
  Fastest laps: {fastest_laps}
  Driver of the Day awards: {dotds}
  DNFs: {dnfs}
  Average finish position: {avg_finish if avg_finish is not None else "N/A"}

SEASON HISTORY:
{chr(10).join(season_lines) or "  No seasons recorded"}

BEST TRACKS (by points scored):
{chr(10).join(best_track_lines) or "  No track data"}

Write 2–4 punchy sentences. Focus on what makes this driver distinctive — their strengths, \
consistency or volatility, standout achievements, and trajectory across seasons. \
Do not just list the stats back; interpret them into a character description.

Return JSON only: {{"bio": "<the biography text>"}}"""

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY environment variable is not set")

    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=400,
        system=(
            "You are a sports journalist covering CGR League. Write in an engaging, analytical "
            "style — punchy sentences, specific references to achievements. "
            "Always respond with valid JSON only (no markdown fences)."
        ),
        messages=[{"role": "user", "content": prompt}],
    )
    raw = message.content[0].text.strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        cleaned = raw.strip("`").removeprefix("json").strip()
        data = json.loads(cleaned)

    bio_text = data.get("bio", "").strip()
    driver.bio = bio_text
    driver.save(update_fields=["bio"])
    logger.info("Generated bio for driver %d (%s)", driver.id, driver_name)
    return driver
