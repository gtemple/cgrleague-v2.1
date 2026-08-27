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

from django.db.models import Count, Sum, F, Q, FloatField
from django.db.models.functions import Coalesce

from entries.models import DriverSeason
from results.models import Race, RaceResult
from results.api.views.utils import points_case, fl_bonus_case
from seasons.models import Season
from . import llm
from .models import Article

logger = logging.getLogger(__name__)

# ─── shared league context ──────────────────────────────────────────────────
# This block is injected into every system prompt so universal rules only need
# to be maintained in one place.

BANNED_VERBS = (
    "storms", "dominates", "cruises", "conquers", "roars", "seals", "eyes", "masterclass",
)

LEAGUE_CONTEXT = (
    "CGR League is a private Formula 1-style racing league played on a video game simulator. "
    "It contains both human players and AI-controlled drivers. "
    "\n\n"
    "DRIVER RELATIONSHIPS — important for accuracy:\n"
    "- The Reynolds drivers (any first name, last name Reynolds) are BROTHERS, not father and son "
    "or any other relation. Never imply a parent-child relationship between them.\n"
    "- The Temple drivers (any first name, last name Temple) are also BROTHERS if more than one "
    "appears on the grid. Apply the same rule.\n"
    "- Never guess which sibling is older or younger, and never call one 'the younger brother' "
    "or 'the elder', unless a NAME COLLISIONS block in the prompt states the order.\n"
    "\n"
    "BANNED WORDS — never use these in any output, in a title or a body:\n"
    "- 'journeyman', 'playground' (e.g. 'personal playground'), 'testament'\n"
    "- these worn motorsport-headline verbs: " + ", ".join(f"'{v}'" for v in BANNED_VERBS) + "\n"
    "\n"
    "DNF TRACKING — DNF recording is incomplete in the league's earlier seasons. A low DNF "
    "count may reflect missing data rather than a clean record, so never present one as "
    "evidence of reliability. Only comment on a driver's DNF tally when it is notably high.\n"
    "\n"
    "POLE TRACKING — pole positions were not recorded in the league's first seasons either. "
    "A low pole count may mean the data was never captured, so never read one as weak "
    "qualifying pace.\n"
)


SYSTEM_PROMPT = (
    "You are a sports journalist covering CGR League. "
    + LEAGUE_CONTEXT
    + "Write in an engaging, analytical style — punchy sentences, "
    "specific references to names and numbers, no generic filler. "
    "Titles should be at most ~100 characters and teasers a one or two sentence hook (~200 chars). "
    "Separate article-body paragraphs with \\n\\n."
)

# System prompt for the analytical sub-generators (callouts, sidebars, ranking
# blurbs) — same league rules and voice, without the article-body framing.
ANALYST_SYSTEM = (
    "You are a sports journalist covering CGR League. "
    + LEAGUE_CONTEXT
    + "Write in an engaging, analytical style with specific references to names and numbers."
)


# ─── shared prompt rules ──────────────────────────────────────────────────────
# Every generator pulls from these rather than restating them, so a change to
# what the model is allowed to claim lands in one place.

DATA_DISCIPLINE_RULE = (
    "- STICK TO THE DATA ABOVE. You are given finishing positions, grid slots, points, status, "
    "awards and standings — nothing else. You do NOT know lap numbers, lap times, gaps, corner "
    "names, tyre strategies, pit stops, overtake counts, or why any driver gained or lost places. "
    "Never write a sentence containing a fact of that kind: no \"on lap 41\", no \"at Turn 4\", no "
    "\"14 overtakes\", no \"a bold move around the outside\", no \"a strategy error\". Describe what "
    "the results show (grid slot, finish, points, awards, standings movement) and let the notes "
    "supply anything else. If you do not know why something happened, say what happened and move on"
)

NO_PAST_WIN_INFERENCE_RULE = (
    "- Only claim a driver won a past race if a winner list above says so. Do not infer earlier "
    "results from the standings"
)

STANDINGS_MOVEMENT_RULE = (
    "- Describe a standings change only when it actually changed. If a gap is the same before and "
    "after, say it held rather than writing it as movement"
)

TITLE_VARIETY_RULE = (
    "- Vary your title — no repeating template, no \"[Driver] [Verb]s at [Track]\". Use narrative, "
    "tension-led, or question-based angles, and none of the BANNED WORDS from your instructions"
)

HEADLINE_ECHO_RULE = (
    " — and do not echo the wording, verb, or angle of any headline in the "
    "HEADLINES ALREADY PUBLISHED list above"
)

# Rules every article-shaped prompt wants. Joined with newlines at the call site.
CORE_RULES = "\n".join((DATA_DISCIPLINE_RULE, NO_PAST_WIN_INFERENCE_RULE, STANDINGS_MOVEMENT_RULE))

# ─── structured-output schemas ────────────────────────────────────────────────
# Response shape is enforced by output_config, so no JSON parsing fallbacks are
# needed. All objects require additionalProperties:false + every key in required.

ARTICLE_SCHEMA = {
    "type": "object",
    "properties": {
        # Caps are deliberately looser than the prompt asks for (~100 / ~200):
        # they exist to catch runaway output, not to fail a good article that
        # overshot by a few characters, since a rejection costs a whole retry.
        "title": {"type": "string", "maxLength": 140},
        "teaser": {"type": "string", "maxLength": 320},
        "content": {"type": "string"},
    },
    "required": ["title", "teaser", "content"],
    "additionalProperties": False,
}

BIO_SCHEMA = {
    "type": "object",
    "properties": {"bio": {"type": "string"}},
    "required": ["bio"],
    "additionalProperties": False,
}

RIVALRY_SCHEMA = {
    "type": "object",
    "properties": {
        "driver_a": {"type": "string"},
        "driver_b": {"type": "string"},
        "description": {"type": "string"},
    },
    "required": ["driver_a", "driver_b", "description"],
    "additionalProperties": False,
}

SIDEBAR_SCHEMA = {
    "type": "object",
    "properties": {
        "head_to_head": {
            "type": "object",
            "properties": {
                "driver_a": {"type": "string"},
                "driver_b": {"type": "string"},
                "context": {"type": "string"},
            },
            "required": ["driver_a", "driver_b", "context"],
            "additionalProperties": False,
        },
        "drivers_to_watch": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "reason": {"type": "string"},
                    "stat": {"type": "string"},
                },
                "required": ["name", "reason", "stat"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["head_to_head", "drivers_to_watch"],
    "additionalProperties": False,
}

# A one-sentence line shown while the rivalry panel is collapsed, plus the body
# behind it. Split rather than one blob so the collapsed state has a real field
# to show instead of prose truncated at a character count.
RIVALRY_SUMMARY_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string", "maxLength": 260},
        "content": {"type": "string"},
    },
    "required": ["summary", "content"],
    "additionalProperties": False,
}

# Blurbs keyed by rank (stable, unique within one rankings article) rather than
# by driver name — avoids dropping a blurb when the model formats a name slightly
# differently than we store it.
RANKINGS_BLURBS_SCHEMA = {
    "type": "object",
    "properties": {
        "blurbs": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "rank": {"type": "integer"},
                    "blurb": {"type": "string"},
                },
                "required": ["rank", "blurb"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["blurbs"],
    "additionalProperties": False,
}


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
    """All previous race winners at this track (most recent first), capped to before
    cutoff_race if given. Returns every edition so win tallies stay accurate — a hard
    cap here would silently drop the oldest winners and cause miscounts in prompts."""
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
    winners = qs.order_by("-race__season_id", "-race__round")
    return [
        {
            "season": r.race.season_id,
            "round": r.race.round,
            "winner": _name(r.driver_season.driver),
            "is_human": r.driver_season.driver.human,
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
    Prompt block for drivers sharing a surname: how to write them, and which is
    the elder. Birth order comes from date_of_birth rather than being stated in
    LEAGUE_CONTEXT, so it stays right for any sibling pair on any season's grid.
    Without it the model guesses, and it guessed wrong (calling Ryan Reynolds,
    born 1992, the younger brother of Cole, born 1996).
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
    for last_name, drivers in sorted(by_last.items()):
        if len(drivers) < 2:
            continue
        unique = {d.id: d for d in drivers}.values()
        if len(unique) < 2:
            continue
        names = " and ".join(
            f"{d.first_name[0]}. {d.last_name}" if d.first_name else d.last_name
            for d in sorted(unique, key=lambda d: d.first_name or "")
        )
        line = f"  - {names} share the surname '{last_name}' — always write them as {names}"

        dobs = [d.date_of_birth for d in unique]
        if all(dobs) and len(set(dobs)) == len(dobs):
            eldest = sorted(unique, key=lambda d: d.date_of_birth)
            label = lambda d: f"{d.first_name[0]}. {d.last_name}" if d.first_name else d.last_name
            if len(eldest) == 2:
                line += f". {label(eldest[0])} is the OLDER of the two"
            else:
                line += ". Oldest to youngest: " + ", ".join(label(d) for d in eldest)
        pairs.append(line)

    if not pairs:
        return ""
    return (
        "NAME COLLISIONS — these drivers share a surname; always use first initial + last name:\n"
        + "\n".join(pairs)
    )


# ─── text formatters ─────────────────────────────────────────────────────────

def _fmt_results(race):
    from django.db.models import F as _F
    results = list(
        RaceResult.objects
        .filter(race=race)
        .select_related("driver_season__driver", "driver_season__team_season__team")
        .order_by(_F("finish_position").asc(nulls_last=True), "driver_season__driver__last_name")
    )
    # grid_position is only recorded from S7 on. Printing "(Grid ?)" on every
    # row of an older race is noise, and invites grid commentary there is no
    # data for, so the column only appears when the race actually has one.
    has_grid = any(r.grid_position is not None for r in results)

    lines = []
    for r in results:
        driver = r.driver_season.driver
        team = r.driver_season.team_season.team
        flags = []
        if r.pole_position:    flags.append("Pole")
        if r.fastest_lap:     flags.append("Fastest Lap")
        if r.dotd:            flags.append("DOTD")
        if r.cleanest_driver: flags.append("Cleanest Driver")
        if r.most_overtakes:  flags.append("Most Overtakes")
        flag_str = f" [{', '.join(flags)}]" if flags else ""
        human_tag = " (Human)" if driver.human else ""
        grid_str = f" (Grid {r.grid_position or '?'})" if has_grid else ""

        # An unclassified row is not necessarily a DNF - it may be DNS/DSQ/DNQ -
        # so the status fills the position slot rather than being assumed.
        if r.finish_position is not None:
            slot, status_str = f"P{r.finish_position}", f", {r.status}"
        else:
            slot, status_str = r.status, ""

        lines.append(
            f"  {slot}{grid_str}: {_name(driver)}{human_tag} ({team.team_name})"
            f" — {r.points} pts{status_str}{flag_str}"
        )
    return "\n".join(lines)


def _fmt_lineups(season):
    """
    Explicit team line-ups. The results block carries each driver's team, but
    inferring "teammate" from it means a cross-reference the model gets wrong;
    stating the pairs removes that whole error class.
    """
    from collections import defaultdict
    by_team = defaultdict(list)
    for ds in (
        DriverSeason.objects
        .filter(season=season)
        .select_related("driver", "team_season__team")
        .order_by("driver__last_name")
    ):
        by_team[ds.team_season.display_name or ds.team_season.team.team_name].append(_name(ds.driver))
    lines = "\n".join(f"  - {team}: {' & '.join(names)}" for team, names in sorted(by_team.items()))
    return f"\nTEAM LINE-UPS THIS SEASON (use this for any 'teammate' reference):\n{lines}\n"


def _tracked_flags(race):
    """
    Which award flags actually occur in this race. Poles are S3+, Cleanest
    Driver and Most Overtakes are S7+, so naming all five unconditionally asks
    the model to highlight awards that were never recorded.
    """
    checks = [
        ("pole", "pole_position"),
        ("fastest lap", "fastest_lap"),
        ("DOTD", "dotd"),
        ("Cleanest Driver", "cleanest_driver"),
        ("Most Overtakes", "most_overtakes"),
    ]
    fields = [f for _, f in checks]
    present = set()
    for row in RaceResult.objects.filter(race=race).values(*fields):
        present.update(f for f in fields if row[f])
    return [label for label, field in checks if field in present]


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
        f"  Season {w['season']} R{w['round']}: {w['winner']}"
        f" ({'human' if w['is_human'] else 'AI'})"
        for w in winners
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


def _get_recent_form(season, up_to_round, last_n=5):
    """{driver_name: ["P3", "P1", "DNF", ...]} last N GP finishes (oldest→newest)
    for the human drivers, through up_to_round. Momentum going into the next race."""
    from django.db.models import F as _F
    ds_list = (
        DriverSeason.objects
        .filter(season=season, driver__human=True)
        .select_related("driver")
    )
    out = {}
    for ds in ds_list:
        rows = (
            RaceResult.objects
            .filter(driver_season=ds, race__round__lte=up_to_round, race__is_sprint=False)
            .order_by("-race__round")[:last_n]
        )
        form = [
            (f"P{r.finish_position}" if r.finish_position else (r.status or "DNF"))
            for r in rows
        ]
        out[_name(ds.driver)] = list(reversed(form))
    return out


def _fmt_recent_form(by_driver):
    lines = [
        f"  {name}: {', '.join(form) if form else 'no races yet'}"
        for name, form in sorted(by_driver.items())
    ]
    return "\n".join(lines) if lines else "  No recent form available."


def _round_count(season):
    """Number of GP rounds in a season (used for 'Round X of Y' context)."""
    return Race.objects.filter(season=season, is_sprint=False).count()


def _get_prior_titles(season, before_round=None, include_same_round_preview=False, limit=40):
    """
    Titles of articles already published in this season, fed into each prompt so
    a new headline can be steered away from ones already out — the only
    cross-article signal the model gets, since each article is its own API call.

    `before_round` is not optional in spirit: headlines state results ("Leclerc
    Steals Imola"), so an unbounded list hands a Round 2 preview the outcome of
    Rounds 3-6. Callers pass the round being written about, and only articles
    published before that point come back. A recap may additionally see its own
    round's preview, which really was published first.
    """
    qs = Article.objects.filter(Q(season=season) | Q(race__season=season)).exclude(title="")

    if before_round is not None:
        # A season preview goes out before round 1, so it is prior to everything.
        prior = Q(race__round__lt=before_round) | Q(race__isnull=True, type=Article.SEASON_PREVIEW)
        if include_same_round_preview:
            prior |= Q(race__round=before_round, type=Article.PREVIEW)
        qs = qs.filter(prior)

    return list(qs.order_by("-id").values_list("title", flat=True)[:limit])


def _fmt_prior_titles(titles):
    if not titles:
        return ""
    lines = "\n".join(f'  - "{t}"' for t in titles)
    return (
        "\nHEADLINES ALREADY PUBLISHED THIS SEASON — your title MUST read as clearly "
        "distinct from every one below. Do not reuse their lead verb, their central "
        "noun/phrase, or their sentence structure:\n" + lines + "\n"
    )


# ─── model call ──────────────────────────────────────────────────────────────

def _call_model(user_prompt, schema=ARTICLE_SCHEMA, *, system=SYSTEM_PROMPT, max_tokens=4000):
    """
    Single entry point for every model call in this module. The provider
    (Anthropic or DeepSeek) is chosen in articles.llm; either way the return
    value is a dict conforming to `schema`.
    """
    return llm.generate_json(user_prompt, schema, system=system, max_tokens=max_tokens)


# ─── rivalry callout ─────────────────────────────────────────────────────────

def _generate_rivalry_callout(race):
    """
    Second-pass prompt: extract the single best on-track battle from the race.
    Returns a plain-text description string, or "" on failure.
    """
    prompt = f"""Based on these race results from a CGR League race at {race.track.name} \
(Season {race.season_id}, Round {race.round}), identify the single most compelling \
storyline between two specific drivers.

RACE RESULTS:
{_fmt_results(race)}
{_fmt_lineups(race.season)}
Write exactly 2–3 punchy sentences on what the results show about these two: where they \
started, where they finished, what separated them, and what it means. Use the drivers' \
real names.

{CORE_RULES}
- You are describing a RESULT, not a wheel-to-wheel duel. You have no lap-by-lap record, so \
do not narrate passes, defences, or contact. "Finished two places and four points apart after \
starting alongside each other" is the level of detail available to you

Identify the two drivers and write the description."""
    try:
        data = _call_model(prompt, RIVALRY_SCHEMA, system=ANALYST_SYSTEM, max_tokens=2500)
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

    total_rounds = _round_count(season)
    standings = _get_standings(season, race.round)
    standings_before = _get_standings(season, race.round - 1) if race.round > 1 else []
    constructor_standings = _get_constructor_standings(season, race.round)
    track_winners = _get_track_winners(track, exclude_race=race, cutoff_race=race)
    human_names = _get_human_driver_names(season)
    collision_note = _get_name_collision_note(season)

    notes_block = f"\nRACE NOTES (from the league admin — treat as factual context):\n{race.race_notes.strip()}\n" if race.race_notes.strip() else ""
    collision_block = f"\n{collision_note}" if collision_note else ""
    before_block = (
        f"\nDRIVER STANDINGS BEFORE THIS RACE (use to describe how the title picture shifted):\n{_fmt_standings(standings_before)}\n"
        if standings_before else ""
    )
    prior_titles_block = _fmt_prior_titles(
        _get_prior_titles(season, before_round=race.round, include_same_round_preview=True)
    )
    flags = _tracked_flags(race)
    lineups_block = _fmt_lineups(season)
    flags_block = f"\n- Highlight key moments: {', '.join(flags)}" if flags else ""
    headline_rule = HEADLINE_ECHO_RULE if prior_titles_block else ""

    prompt = f"""Write a race recap article for the following CGR League race.

RACE: Season {season.id} — Round {race.round} of {total_rounds} {kind} at {track.name} ({track.city}, {track.country})
Track length: {track.distance}m
{notes_block}
RACE RESULTS:
{_fmt_results(race)}
{before_block}
DRIVER CHAMPIONSHIP STANDINGS AFTER THIS RACE:
{_fmt_standings(standings)}

CONSTRUCTOR CHAMPIONSHIP STANDINGS AFTER THIS RACE:
{_fmt_constructor_standings(constructor_standings)}

PREVIOUS RACE WINNERS AT {track.name.upper()}:
{_fmt_track_winners(track_winners)}
{lineups_block}{prior_titles_block}
IMPORTANT RULES:
- You MUST write at least one dedicated, specific paragraph about EACH of these human drivers: \
{', '.join(human_names)}
- Reference their EXACT finishing position and points from the results above — do not invent or \
approximate results
- AI drivers may be mentioned naturally by name when relevant (battles, notable moments, etc.)
- Discuss championship implications using BOTH the driver and constructor standings above — \
include at least one sentence on the constructor battle. Where the before/after standings show \
a lead growing, shrinking, or a position swap, describe that shift concretely (e.g. the exact \
points gap and how it moved) rather than in vague terms
- Frame the stakes against the season length ({total_rounds} rounds total) where it matters{flags_block}
{CORE_RULES}
- Any RACE NOTES provided above take priority over anything you might infer from the results — \
treat them as ground truth from the league admin{collision_block}
- Vary your opening — do not lead with the winner's name or "Round X" every time; sometimes \
open with the championship stakes, a specific battle, or the drama of the moment
{TITLE_VARIETY_RULE}{headline_rule}
- Length: 450–650 words, paragraphs separated by \\n\\n"""

    data = _call_model(prompt, ARTICLE_SCHEMA, max_tokens=5000)
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


def _opener_state_block(season, roster):
    """Pre-season 'state of play' for a Round 1 preview: the roster plus returning
    drivers' prior-season final standings. No current-season results exist yet."""
    prev_block = ""
    try:
        prev_season = Season.objects.get(pk=season.id - 1)
        prev_standings = _get_standings(prev_season, up_to_round=9999)
        roster_names = {r["name"] for r in roster}
        returning = [r for r in prev_standings if r["name"] in roster_names]
        if returning:
            prev_block = (
                f"\nPREVIOUS SEASON (Season {prev_season.id}) FINAL STANDINGS "
                f"(returning drivers only — pre-season form context):\n"
                + _fmt_standings(returning) + "\n"
            )
    except Season.DoesNotExist:
        pass
    return (
        f"SEASON OPENER — no rounds have been run yet in Season {season.id}; there are no "
        f"championship standings or current-season form to cite.\n\n"
        f"DRIVER ROSTER (pre-season, teams locked — no points yet):\n{_fmt_standings(roster)}\n"
        + prev_block
    )


def generate_preview(next_race, after_race=None):
    """Generate and save a PREVIEW Article for an upcoming race.

    `after_race` is the most recently completed race, used for standings/form.
    Pass `after_race=None` for a season opener (Round 1): there are no prior
    standings, so the preview is built from the roster, prior-season form, and
    track history instead.
    """
    season = next_race.season
    track = next_race.track
    kind = "Sprint" if next_race.is_sprint else "Grand Prix"
    is_opener = after_race is None

    total_rounds = _round_count(season)
    track_winners = _get_track_winners(track, exclude_race=next_race, cutoff_race=next_race)
    driver_track_history = _get_driver_track_history(season, track, cutoff_race=next_race)
    human_names = _get_human_driver_names(season)
    collision_note = _get_name_collision_note(season)

    if is_opener:
        standings = _get_standings(season, up_to_round=0)  # roster, no points yet
        state_block = _opener_state_block(season, standings)
        stakes_rules = (
            "- This is the SEASON OPENER — no standings, points, or current-season form exist yet. "
            "Do NOT invent or cite championship positions, points, or recent results. Build the preview "
            "from pre-season expectations, the roster and teams above, prior-season form where provided, "
            "and this track's history\n"
            "- Reference each human driver's team from the roster above"
        )
    else:
        standings = _get_standings(season, after_race.round)
        constructor_standings = _get_constructor_standings(season, after_race.round)
        recent_form = _get_recent_form(season, after_race.round)
        state_block = (
            f"CURRENT DRIVER CHAMPIONSHIP STANDINGS (after Round {after_race.round}):\n"
            f"{_fmt_standings(standings)}\n\n"
            f"CURRENT CONSTRUCTOR CHAMPIONSHIP STANDINGS (after Round {after_race.round}):\n"
            f"{_fmt_constructor_standings(constructor_standings)}\n\n"
            f"RECENT FORM — last 5 GP finishes, oldest→newest (human drivers, who's hot going in):\n"
            f"{_fmt_recent_form(recent_form)}"
        )
        stakes_rules = (
            "- Reference their EXACT championship position and points from the standings above — "
            "do not invent or approximate\n"
            "- Discuss the championship stakes for BOTH drivers and constructors — who needs points, "
            f"who's leading, which teams are scrapping for position, framed against the {total_rounds}-round season\n"
            "- Use track history AND recent form to suggest who's carrying momentum or has an edge here"
        )

    notes_block = f"\nRACE NOTES (from the league admin — treat as factual context):\n{next_race.race_notes.strip()}\n" if next_race.race_notes.strip() else ""
    collision_block = f"\n{collision_note}" if collision_note else ""
    prior_titles_block = _fmt_prior_titles(_get_prior_titles(season, before_round=next_race.round))
    headline_rule = HEADLINE_ECHO_RULE if prior_titles_block else ""
    lineups_block = _fmt_lineups(season)

    prompt = f"""Write a race preview article for the following upcoming CGR League race.

UPCOMING RACE: Season {season.id} — Round {next_race.round} of {total_rounds} {kind} at {track.name} \
({track.city}, {track.country})
Track length: {track.distance}m
{notes_block}
{state_block}

PREVIOUS RACE WINNERS AT {track.name.upper()}:
{_fmt_track_winners(track_winners)}

DRIVER HISTORY AT THIS TRACK (human drivers only):
{_fmt_driver_track_history(driver_track_history)}
{lineups_block}{prior_titles_block}
IMPORTANT RULES:
- You MUST write at least one dedicated, specific paragraph about EACH of these human drivers: \
{', '.join(human_names)}
{stakes_rules}
- AI drivers may be mentioned naturally by name when relevant
{CORE_RULES}
- Any RACE NOTES provided above take priority over anything you might infer from the data — \
treat them as ground truth from the league admin{collision_block}
- Vary your opening — do not lead with "Round X" or the track name every time; sometimes open \
with the championship battle, a driver's storyline, or what's at stake
{TITLE_VARIETY_RULE}{headline_rule}
- Length: 450–650 words, paragraphs separated by \\n\\n"""

    data = _call_model(prompt, ARTICLE_SCHEMA, max_tokens=5000)
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
with a rivalry at this track. Strongly prefer a Human vs Human matchup if possible; only use an \
AI driver if there are fewer than two humans in the standings. Write 2–3 punchy sentences about \
why this battle matters.

2. Pick exactly 3 DRIVERS TO WATCH (mix of human and AI is fine). For each, write a short reason \
(1 sentence) and a single key stat (e.g. "P1 here last season", "3 wins in last 4 races", \
"yet to score at this track").
{_fmt_lineups(next_race.season)}
{CORE_RULES}
- Every stat you cite must be readable off the blocks above. Do not invent qualifying pace, \
form streaks, or track records that are not shown

Use the drivers' real full names."""

    try:
        data = _call_model(prompt, SIDEBAR_SCHEMA, system=ANALYST_SYSTEM, max_tokens=3000)
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
    final_constructors = _get_constructor_standings(season, up_to_round=9999)
    human_names = _get_human_driver_names(season)
    race_count = Race.objects.filter(season=season).count()
    collision_note = _get_name_collision_note(season)

    notes_block = f"\nSEASON NOTES (from the league admin — treat as factual context):\n{season.season_notes.strip()}\n" if season.season_notes.strip() else ""
    collision_block = f"\n{collision_note}" if collision_note else ""
    lineups_block = _fmt_lineups(season)
    prior_titles_block = _fmt_prior_titles(_get_prior_titles(season))
    headline_rule = HEADLINE_ECHO_RULE if prior_titles_block else ""

    prompt = f"""Write a season review article for CGR League Season {season.id} ({season.game}).

SEASON OVERVIEW:
  Total rounds: {race_count}
  Game: {season.game}
{notes_block}

FINAL DRIVER CHAMPIONSHIP STANDINGS:
{_fmt_standings(final_standings)}

FINAL CONSTRUCTOR CHAMPIONSHIP STANDINGS:
{_fmt_constructor_standings(final_constructors)}

SEASON HIGHLIGHTS (wins, poles, fastest laps, DOTD):
{_get_season_highlights(season)}
{lineups_block}{prior_titles_block}

ROUND-BY-ROUND RESULTS:
{_fmt_season_results(season)}

IMPORTANT RULES:
- You MUST write at least one dedicated, specific paragraph about EACH of these human drivers: \
{', '.join(human_names)}
- Reference their EXACT final championship position and points — do not invent or approximate
- AI drivers may be mentioned naturally by name when relevant
- Cover the season arc: early leader, title battles, who faded, who improved
- Cover BOTH titles — reference the constructors' championship outcome, not just the drivers'
- Highlight standout moments the results actually show: title swings, a driver's best round, \
a team turning its season around
{CORE_RULES}
{TITLE_VARIETY_RULE}{headline_rule}
- Any SEASON NOTES provided above take priority over anything you might infer from the data — \
treat them as ground truth from the league admin{collision_block}
- Vary your opening — do not open with "Season X" or the champion's name; lead with a defining \
moment, a theme, or what made this season unique
- Length: 800–1100 words, paragraphs separated by \\n\\n"""

    data = _call_model(prompt, ARTICLE_SCHEMA, max_tokens=8000)
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
    # up_to_round=0 so no current-season race results bleed in — preview is always pre-race
    final_standings = _get_standings(season, up_to_round=0)
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

    # Previous season's final standings for returning drivers — grounds "defending
    # champion", "coming off a strong year", team-switch storylines, etc.
    prev_block = ""
    try:
        prev_season = Season.objects.get(pk=season.id - 1)
        prev_standings = _get_standings(prev_season, up_to_round=9999)
        roster_names = {r["name"] for r in final_standings}
        returning = [r for r in prev_standings if r["name"] in roster_names]
        if returning:
            prev_block = (
                f"\nPREVIOUS SEASON (Season {prev_season.id}) FINAL STANDINGS "
                f"(returning drivers only — use for defending-champion / form / team-switch context):\n"
                + _fmt_standings(returning) + "\n"
            )
    except Season.DoesNotExist:
        pass

    lineups_block = _fmt_lineups(season)
    prior_titles_block = _fmt_prior_titles(_get_prior_titles(season, before_round=1))
    headline_rule = HEADLINE_ECHO_RULE if prior_titles_block else ""

    prompt = f"""Write a season preview article for the upcoming CGR League Season {season.id} ({season.game}).

SEASON INFO:
  Total rounds: {race_count}
  Game: {season.game}
{notes_block}
SEASON CALENDAR:
{chr(10).join(calendar_lines) if calendar_lines else '  Calendar not yet set.'}

DRIVER ROSTER (pre-season, no in-season results included):
{_fmt_standings(final_standings)}
{lineups_block}{prev_block}{prior_titles_block}
IMPORTANT RULES:
- You MUST write at least one dedicated, specific paragraph about EACH of these human drivers: \
{', '.join(human_names)}
- Reference their team from the roster above; do NOT reference any in-season points or results
- Where a driver returns from the previous season, you may reference their prior-season finish \
(defending champion, coming off a strong/tough year, a new team) using the standings above
- AI drivers may be mentioned naturally by name when relevant
- Build anticipation: rivalries to watch, title contenders, tracks to circle on the calendar
{CORE_RULES}
{TITLE_VARIETY_RULE}{headline_rule}
- Discuss the format (sprint rounds, total rounds) and what it means for strategy
- Any SEASON NOTES provided above take priority over anything you might infer from the data — \
treat them as ground truth from the league admin{collision_block}
- Vary your opening — don't open with "Season X is here"; lead with a compelling question, \
a key rivalry, or the biggest storyline going in
- Length: 750–1000 words, paragraphs separated by \\n\\n"""

    data = _call_model(prompt, ARTICLE_SCHEMA, max_tokens=8000)
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
    Generate 1-2 sentence blurbs for every driver. Returns {rank: blurb} keyed by
    the driver's rank number (stable, unlike names). When it's the first race of
    the season, includes previous season final standings as context.
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
        f"Human drivers get slightly more narrative; AI drivers can be more analytical. "
        f"Vary how you open each blurb — do not start every entry with the driver's name, "
        f"and do not use the same sentence structure back to back."
        f"{collision_block}\n\n"
        f"Write one blurb for EVERY driver listed above. Identify each by their rank number "
        f"(the #N shown at the start of each line)."
    )

    try:
        data = _call_model(prompt, RANKINGS_BLURBS_SCHEMA, system=ANALYST_SYSTEM, max_tokens=8000)
        return {b["rank"]: b["blurb"] for b in data.get("blurbs", []) if b.get("blurb")}
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
            "blurb": blurbs.get(d["rank"], ""),
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

Write 2–4 punchy sentences as a profile of this specific driver. Ground the bio in what \
actually makes them stand out — their wins, their scoring rate, a track they dominate, \
their trajectory across seasons, or any other genuinely distinctive pattern in the data. \
Avoid generic labels like "veteran" or "solid points scorer" — every driver bio must feel \
individual and earned. Do not just list the stats back; interpret them into a character.

{CORE_RULES}"""

    bio_system = (
        "You are a sports journalist covering CGR League. "
        + LEAGUE_CONTEXT
        + "Write in an engaging, analytical style — punchy sentences, specific references to "
        "names and numbers. Every driver profile must feel distinct."
    )
    data = _call_model(prompt, BIO_SCHEMA, system=bio_system, max_tokens=1500)

    bio_text = data.get("bio", "").strip()
    driver.bio = bio_text
    driver.save(update_fields=["bio"])
    logger.info("Generated bio for driver %d (%s)", driver.id, driver_name)
    return driver


def generate_track_bio(track_id):
    """
    Generate and save a history overview for a track.
    Writes the result directly to Track.bio and returns the Track.
    Invalidates the track stats cache so the bio appears immediately.
    """
    from collections import defaultdict
    from tracks.models import Track
    from results.scoring import points_for_result
    from results.cache import key_track_stats

    track = Track.objects.get(pk=track_id)

    # All non-sprint races at this track, ordered chronologically
    races_qs = (
        Race.objects
        .filter(track=track, is_sprint=False)
        .select_related("season")
        .order_by("season_id", "round")
    )
    races = list(races_qs)

    if not races:
        raise ValueError(f"No races found at track {track.name}")

    race_ids = [r.id for r in races]

    # All results at this track
    results_qs = (
        RaceResult.objects
        .filter(race_id__in=race_ids)
        .select_related("race__season", "driver_season__driver")
        .order_by("race__season_id", "race__round", "finish_position")
    )

    # Build race history lines and per-driver aggregates
    race_history: list = []
    driver_agg: dict = defaultdict(lambda: {
        "name": "",
        "human": False,
        "races": 0,
        "points": 0,
        "wins": 0,
        "podiums": 0,
        "finishes": [],
    })

    results_by_race: dict = defaultdict(list)
    for rr in results_qs:
        results_by_race[rr.race_id].append(rr)

    for race in races:
        rrs = results_by_race.get(race.id, [])
        winner = next((rr for rr in rrs if rr.finish_position == 1), None)
        winner_name = _name(winner.driver_season.driver) if winner else "Unknown"
        race_history.append(
            f"  S{race.season_id} R{race.round}: Winner — {winner_name}"
        )

        for rr in rrs:
            drv = rr.driver_season.driver
            did = drv.id
            agg = driver_agg[did]
            agg["name"] = _name(drv)
            agg["human"] = drv.human
            agg["races"] += 1
            agg["points"] += int(points_for_result(rr))
            fp = rr.finish_position
            if fp == 1:
                agg["wins"] += 1
            if fp is not None and fp <= 3:
                agg["podiums"] += 1
            if fp is not None:
                agg["finishes"].append(fp)

    # Split human vs AI drivers
    human_drivers = [a for a in driver_agg.values() if a["human"]]
    human_drivers.sort(key=lambda x: -x["points"])

    human_lines = []
    for a in human_drivers:
        avg = round(sum(a["finishes"]) / len(a["finishes"]), 1) if a["finishes"] else None
        human_lines.append(
            f"  {a['name']}: {a['races']} races, {a['wins']} wins, "
            f"{a['podiums']} podiums, {a['points']} pts"
            + (f", avg finish P{avg}" if avg else "")
        )

    prompt = f"""Write a history overview for {track.name} ({track.city}, {track.country}) \
as a venue in CGR League (a private Formula 1-style racing league played on a video game simulator).

TRACK INFO:
  Name: {track.name}
  Location: {track.city}, {track.country}
  Length: {track.distance}m

RACE HISTORY ({len(races)} races held):
{chr(10).join(race_history)}

HUMAN DRIVER RECORDS AT THIS TRACK (sorted by points):
{chr(10).join(human_lines) or "  No human driver data"}

Write 4–6 punchy sentences covering the history of this track in CGR League. \
You must reference every human driver listed above by name at least once — weave them \
naturally into the narrative rather than listing them mechanically. \
Focus on patterns of dominance, rivalries, memorable results, and what makes this \
track distinctive within the league. \
Do not open with the track name as the very first word.

{CORE_RULES}
- You have results, not circuit knowledge. Do not describe corners, elevation, overtaking \
spots, or surface characteristics — nothing above tells you any of that"""

    track_system = (
        "You are a sports journalist covering CGR League. "
        + LEAGUE_CONTEXT
        + "Write in an engaging, analytical style — punchy sentences, specific references to "
        "names and results."
    )
    data = _call_model(prompt, BIO_SCHEMA, system=track_system, max_tokens=2000)

    bio_text = data.get("bio", "").strip()
    track.bio = bio_text
    track.save(update_fields=["bio"])

    # Invalidate cached track stats so the bio shows immediately
    cache.delete_many([key_track_stats(track_id, False), key_track_stats(track_id, True)])

    logger.info("Generated bio for track %d (%s)", track.id, track.name)
    return track


# ─── rivalry summaries ────────────────────────────────────────────────────────
# One AI-written profile per driver pairing, shown at the top of the rivalry
# page. Prompted from build_rivalry_payload — the same numbers the page renders
# — so the prose and the panel below it can never disagree.

# Only pairings involving a human are worth writing about: an AI-vs-AI matchup
# is two game-controlled cars with no story behind them.
def rivalry_is_eligible(driver_a, driver_b):
    return driver_a.human or driver_b.human


def _fmt_rivalry_totals(a_name, b_name, totals):
    """
    The stats recorded in every season. Poles, grid slots, cleanest driver and
    overtakes are deliberately absent — they start at S3 or S7 and would read
    as career figures across a rivalry that spans the whole league.
    """
    a, b = totals["a"], totals["b"]
    rows = [
        ("Races finished ahead", a["ahead"], b["ahead"]),
        ("Points", a["points"], b["points"]),
        ("Wins", a["wins"], b["wins"]),
        ("Podiums", a["podiums"], b["podiums"]),
        ("Fastest laps", a["fastest_laps"], b["fastest_laps"]),
        ("Driver of the day", a["dotd"], b["dotd"]),
        ("Average finish", a["avg_finish"], b["avg_finish"]),
        ("Best finish", a["best_finish"], b["best_finish"]),
    ]
    lines = [f"  {'':<26} {a_name:<22} {b_name}"]
    for label, av, bv in rows:
        lines.append(f"  {label:<26} {str(av):<22} {bv}")
    return "\n".join(lines)


def _season_progress():
    """Rounds run vs rounds scheduled, per season — so a season still under way
    is never written up as though it had finished."""
    return {
        row["season_id"]: (row["run"], row["scheduled"])
        for row in Race.objects.values("season_id").annotate(
            scheduled=Count("id", distinct=True),
            run=Count("id", distinct=True, filter=Q(results__isnull=False)),
        )
    }


def _fmt_rivalry_seasons(a_name, b_name, seasons, progress, timeline):
    """
    One line per season. Every split names both drivers rather than relying on a
    remembered A-then-B order — read as bare "8 - 11" pairs, the model kept
    handing the larger half to the wrong driver — and who took the season is
    stated outright rather than left to be read off the split.

    Deliberately kept to one line each: a denser block carrying per-season
    running totals made every other figure in the output less reliable, not
    more.
    """
    wins, won_at = {}, {}
    for t in timeline:
        row = wins.setdefault(t["season_id"], [0, 0])
        tracks = won_at.setdefault(t["season_id"], ([], []))
        if t["a_finish"] == 1:
            row[0] += 1
            tracks[0].append(t["track"])
        if t["b_finish"] == 1:
            row[1] += 1
            tracks[1].append(t["track"])

    lines = []
    for s in seasons:
        sid = s["season_id"]
        a_wins, b_wins = wins.get(sid, (0, 0))

        if s["a_ahead"] > s["b_ahead"]:
            verdict = f"{a_name} took the season head-to-head"
        elif s["b_ahead"] > s["a_ahead"]:
            verdict = f"{b_name} took the season head-to-head"
        else:
            verdict = "the season head-to-head was level"

        line = (
            f"  S{sid}: {s['races']} races together — {verdict}. "
            f"Finished ahead: {a_name} {s['a_ahead']}, {b_name} {s['b_ahead']}. "
            f"Points: {a_name} {s['a_points']}, {b_name} {s['b_points']}. "
            f"Race wins: {a_name} {a_wins}, {b_name} {b_wins}."
        )
        for name, won in ((a_name, won_at[sid][0]), (b_name, won_at[sid][1])):
            if won:
                line += f" {name} won at {', '.join(won)}."
        run, scheduled = progress.get(sid, (0, 0))
        if run < scheduled:
            line += f" SEASON STILL IN PROGRESS: only {run} of {scheduled} rounds run so far."
        lines.append(line)

    return "\n".join(lines)


def _teammate_spells(a_id, b_id):
    """
    Seasons the pair shared a team, with the name that team raced under. A seat
    is locked for a whole season, so a shared TeamSeason means a shared garage
    for every round of it.
    """
    from entries.models import DriverSeason

    seats = {}
    for ds in (
        DriverSeason.objects
        .filter(driver_id__in=(a_id, b_id))
        .select_related("team_season__team")
    ):
        seats.setdefault(ds.team_season_id, []).append(ds)

    spells = []
    for rows in seats.values():
        if len({r.driver_id for r in rows}) < 2:
            continue
        ts = rows[0].team_season
        spells.append({
            "season_id": ts.season_id,
            "team": ts.display_name or ts.team.team_name,
            "seats": ts.driver_seats.count(),
        })
    return sorted(spells, key=lambda s: s["season_id"])


def _fmt_teammate_spells(a_name, b_name, spells, seasons):
    if not spells:
        return "  They have never been teammates — every meeting has been in different cars."

    by_season = {s["season_id"]: s for s in seasons}
    lines = []
    for spell in spells:
        row = by_season.get(spell["season_id"])
        line = f"  S{spell['season_id']} at {spell['team']}"
        if spell["seats"] > 2:
            line += f" (a {spell['seats']}-car entry that season)"
        if row:
            line += (
                f": {row['races']} races together, "
                f"{a_name} ahead {row['a_ahead']} - {row['b_ahead']} {b_name}, "
                f"points {row['a_points']}-{row['b_points']}"
            )
        lines.append(line)
    return "\n".join(lines)


def _fmt_rivalry_tracks(a_name, b_name, tracks):
    return "\n".join(
        f"  {t['name']} ({t['country']}): {t['races']} "
        f"{'meeting' if t['races'] == 1 else 'meetings'}, "
        f"{a_name} {t['a_ahead']} - {t['b_ahead']} {b_name}"
        for t in tracks
    )


def _fmt_rivalry_timeline(a_name, b_name, timeline):
    lines = []
    for t in timeline:
        tag = " [sprint]" if t["is_sprint"] else ""
        winner = a_name if t["winner"] == "a" else b_name
        lines.append(
            f"  S{t['season_id']} R{t['round']} {t['track']}{tag}: "
            f"{a_name} P{t['a_finish']} ({t['a_points']} pts), "
            f"{b_name} P{t['b_finish']} ({t['b_points']} pts) — "
            f"{winner} ahead by {t['margin']}; running total {t['cum_a']}-{t['cum_b']}"
        )
    return "\n".join(lines)


def _fmt_rivalry_landmarks(a_name, b_name, data):
    """The individual races worth naming: firsts, extremes, and the streaks."""
    timeline = data["timeline"]
    seasons = data["seasons"]
    lines = []

    first = timeline[0]
    last = timeline[-1]
    lines.append(
        f"  First meeting: S{first['season_id']} {first['track']} — "
        f"{a_name} P{first['a_finish']}, {b_name} P{first['b_finish']}"
    )
    lines.append(
        f"  Most recent meeting: S{last['season_id']} {last['track']} — "
        f"{a_name} P{last['a_finish']}, {b_name} P{last['b_finish']}"
    )

    a_took = [f"S{s['season_id']}" for s in seasons if s["a_ahead"] > s["b_ahead"]]
    b_took = [f"S{s['season_id']}" for s in seasons if s["b_ahead"] > s["a_ahead"]]
    level = [f"S{s['season_id']}" for s in seasons if s["a_ahead"] == s["b_ahead"]]
    lines.append(
        f"  Season head-to-heads won: {a_name} {len(a_took)} "
        f"({', '.join(a_took) or 'none'}), {b_name} {len(b_took)} "
        f"({', '.join(b_took) or 'none'})"
        + (f", level in {', '.join(level)}" if level else "")
        + ". These are the only seasons either took; do not describe a run of seasons "
        "that is not in these lists"
    )

    one_place = [t for t in timeline if t["margin"] == 1]
    a_close = sum(1 for t in one_place if t["winner"] == "a")
    lines.append(
        f"  Races settled by a single place: {len(one_place)} in total, "
        f"of which {a_name} took {a_close} and {b_name} took {len(one_place) - a_close}"
    )

    if data["biggest_margin"]:
        widest = data["biggest_margin"]["margin"]
        at = [
            f"S{t['season_id']} {t['track']} ({a_name} P{t['a_finish']}, {b_name} P{t['b_finish']})"
            for t in timeline if t["margin"] == widest
        ]
        lines.append(f"  Widest gap, {widest} places, at: {'; '.join(at)}")

    swing = max(timeline, key=lambda t: abs(t["a_points"] - t["b_points"]))
    lines.append(
        f"  Biggest points swing in one race: {abs(swing['a_points'] - swing['b_points'])} "
        f"at S{swing['season_id']} {swing['track']}"
    )

    best = min(timeline, key=lambda t: t["a_finish"] + t["b_finish"])
    worst = max(timeline, key=lambda t: t["a_finish"] + t["b_finish"])
    lines.append(
        f"  Best shared race (lowest combined finish, {best['a_finish'] + best['b_finish']}): "
        f"S{best['season_id']} {best['track']} — P{best['a_finish']} and P{best['b_finish']}"
    )
    lines.append(
        f"  Worst shared race (highest combined finish, {worst['a_finish'] + worst['b_finish']}): "
        f"S{worst['season_id']} {worst['track']} — P{worst['a_finish']} and P{worst['b_finish']}"
    )

    streaks = data["streaks"]
    run = {"a": 0, "b": 0}
    peak = {"a": (0, None), "b": (0, None)}
    for t in timeline:
        w = t["winner"]
        other = "b" if w == "a" else "a"
        run[w] += 1
        run[other] = 0
        if run[w] > peak[w][0]:
            peak[w] = (run[w], t["season_id"])
    lines.append(
        f"  Longest run of finishing ahead, back to back: "
        f"{a_name} {peak['a'][0]} (ending in S{peak['a'][1]}), "
        f"{b_name} {peak['b'][0]} (ending in S{peak['b'][1]})"
    )
    cur = streaks["current"]
    if cur["driver"] and cur["length"] > 1:
        holder = a_name if cur["driver"] == "a" else b_name
        lines.append(f"  Current run: {holder} has come out ahead in the last {cur['length']}")

    shut_out = [
        t for t in data["tracks"]
        if t["races"] > 1 and (t["a_ahead"] == 0 or t["b_ahead"] == 0)
    ]
    for t in sorted(shut_out, key=lambda t: -t["races"]):
        loser, winner = (a_name, b_name) if t["a_ahead"] == 0 else (b_name, a_name)
        lines.append(
            f"  {loser}'s bogey track is {t['name']}: {t['races']} meetings there, and "
            f"{loser} has never once finished ahead of {winner} at it"
        )

    return "\n".join(lines)


def _fmt_rivalry_newer_stats(a_name, b_name, data):
    """
    Grid slots, cleanest driver and overtakes, labelled with the seasons that
    actually recorded them. Included because they are the only picture of HOW a
    result was arrived at, but they cover a fraction of most rivalries.
    """
    tracked = data["tracked"]
    a, b = data["totals"]["a"], data["totals"]["b"]
    lines = []

    if tracked["grid"] and a["avg_grid"] is not None:
        seasons = ", ".join(f"S{s}" for s in tracked["grid"])
        lines.append(
            f"  Grid slots were recorded in {seasons} only — {data['tracked']['grid_races']} "
            f"of their {data['shared_races']} meetings:"
        )
        lines.append(f"    Average grid slot: {a_name} {a['avg_grid']}, {b_name} {b['avg_grid']}")
        lines.append(
            f"    Average places gained from the grid: "
            f"{a_name} {a['avg_positions_gained']}, {b_name} {b['avg_positions_gained']}"
        )
    if tracked["cleanest"]:
        seasons = ", ".join(f"S{s}" for s in tracked["cleanest"])
        lines.append(
            f"  Cleanest driver awards ({seasons} only): "
            f"{a_name} {a['cleanest_driver']}, {b_name} {b['cleanest_driver']}"
        )
    if tracked["overtakes"]:
        seasons = ", ".join(f"S{s}" for s in tracked["overtakes"])
        lines.append(
            f"  Most-overtakes awards ({seasons} only): "
            f"{a_name} {a['most_overtakes']}, {b_name} {b['most_overtakes']}"
        )

    return "\n".join(lines)


def _fmt_rivalry_drivers(driver_a, driver_b, data):
    lines = []
    for driver, key in ((driver_a, "driver_a"), (driver_b, "driver_b")):
        kind = "a human player" if driver.human else "an AI-controlled driver"
        team = data[key]["team"]["name"]
        line = f"  {_name(driver)} — {kind}"
        if team:
            line += f", most recently racing for {team}"
        lines.append(line)
    return "\n".join(lines)


def generate_rivalry_summary(driver_a_id, driver_b_id):
    """
    Generate and save the AI profile for one driver pairing.

    Writes a DriverRivalry row (one per pair, canonically ordered) and drops the
    cached rivalry payload so the summary appears immediately. Returns the row.
    """
    from django.core.cache import cache
    from drivers.models import Driver, DriverRivalry
    from results.api.views.rivalry import build_rivalry_payload
    from results.cache import key_rivalry

    a_id, b_id = sorted((int(driver_a_id), int(driver_b_id)))
    if a_id == b_id:
        raise ValueError("A rivalry needs two different drivers.")

    driver_a = Driver.objects.get(pk=a_id)
    driver_b = Driver.objects.get(pk=b_id)

    if not rivalry_is_eligible(driver_a, driver_b):
        raise ValueError(
            f"{driver_a} v {driver_b}: neither driver is human, so there is no "
            "rivalry worth writing about."
        )

    data = build_rivalry_payload(a_id, b_id)
    if not data or not data["shared_races"]:
        raise ValueError(f"{driver_a} v {driver_b} have never been classified in the same race.")

    a_name, b_name = _name(driver_a), _name(driver_b)
    spells = _teammate_spells(a_id, b_id)
    seasons = data["seasons"]
    progress = _season_progress()
    span = (
        f"S{seasons[0]['season_id']}"
        if len(seasons) == 1
        else f"S{seasons[0]['season_id']}-S{seasons[-1]['season_id']}"
    )
    newer_stats = _fmt_rivalry_newer_stats(a_name, b_name, data)

    # Only one of the two can be an AI driver — an AI-vs-AI pair is rejected
    # above — so this fires on exactly the pairings that need the caveat.
    mixed = driver_a.human != driver_b.human
    ai_name = _name(driver_a if not driver_a.human else driver_b)

    prompt = f"""Write a profile of the head-to-head record between two CGR League drivers.

THE TWO DRIVERS:
{_fmt_rivalry_drivers(driver_a, driver_b, data)}

Throughout the data below, the two columns are always {a_name} first, then {b_name}.

OVERALL RECORD — every figure below counts ONLY the {data['shared_races']} races both \
drivers finished, across {span}. A win here means a race won while the other was also \
classified, not a career win total:
{_fmt_rivalry_totals(a_name, b_name, data['totals'])}

SEASON BY SEASON — points are this pair's private tally, counted only in races
they both finished, and are NOT championship standings:
{_fmt_rivalry_seasons(a_name, b_name, seasons, progress, data['timeline'])}

TEAMMATE HISTORY:
{_fmt_teammate_spells(a_name, b_name, spells, seasons)}

LANDMARK RACES:
{_fmt_rivalry_landmarks(a_name, b_name, data)}

CIRCUIT RECORD:
{_fmt_rivalry_tracks(a_name, b_name, data['tracks'])}
{f"{chr(10)}PARTIALLY-TRACKED STATS:{chr(10)}{newer_stats}{chr(10)}" if newer_stats else ""}
EVERY MEETING, IN ORDER:
{_fmt_rivalry_timeline(a_name, b_name, data['timeline'])}

Write four or five paragraphs, around 500-650 words, on what this record adds up to. \
Find the arc — who had the upper hand when, where it turned, what the numbers say about \
how the two drivers differ. Interpret; do not read the table back.

You have room, so use it on specifics rather than on restating the overall record in \
different words. Go season by season through the turning points, name individual races \
and what happened in them, and give the circuits where one holds a clear edge their own \
treatment. A paragraph that could have been written about any two drivers is a wasted \
paragraph — every one should contain figures and race names only this pairing has. Do \
not end on a paragraph that sums up the totals again.

Also write a single sentence that captures the rivalry, shown on its own above the \
full text while the panel is collapsed. Keep it under 30 words — one clean sentence, \
not several clauses stitched together. It must name both drivers, stand on its own, \
and use figures the paragraphs then do NOT repeat.

{DATA_DISCIPLINE_RULE}
- The TEAMMATE HISTORY block is the most valuable comparison you have, because \
teammates share a car. If they were teammates, give those seasons real weight and \
say what happened when the equipment was equal. If they were never teammates, say \
nothing about equipment being equal or unequal — you have no car performance data
- Rely on the reliably-tracked stats. Anything under PARTIALLY-TRACKED STATS covers \
only the seasons named beside it, so never present it as a career-long pattern, and \
never compare it against the full {data['shared_races']}-race record
- EVERY MEETING, IN ORDER is the complete list of results you have. Never state a win, \
podium, or placing you cannot point to a line for. A sprint is a race like any other in \
that list — its finishing position is already there, so do not invent sprint results
- The figures in OVERALL RECORD are the complete 105-race totals. Never attach one to a \
moment in the story — "by the end of S3 he led 12-6" is wrong when 12-6 is the career \
figure. Only ever describe a total as where it stands now
- Do not count across rows of the data. No "four wins in six races", no "three rounds \
later", no "the only season in which...", no runs or stretches you had to assemble from \
several lines. Either state a single fact you can read off one line, or use a figure \
that has already been totalled for you above
- Use the figures exactly as they are written above. Do not add, subtract, average or \
otherwise work out a number of your own — if a figure you want to state does not appear \
above, do not state it. Check any number you write against the line it came from
- Never explain WHY a result or a run happened. You have no data on car performance, \
reliability, development, upgrades, form or fitness, so no season turned because a car \
improved or broke, and no run started because anyone found something
- "Finished ahead" and "won" are different things. A win is first place in a race; \
finishing ahead of the other driver is not a win. Never write the head-to-head split \
as race wins, and never call a season's ahead-count a tally of victories
- You have no speed or pace data of any kind. Never call one driver quicker, faster or \
better in a car than the other, and never call either cleaner, safer, or more \
error-prone — say what the finishing positions show instead
- Do not characterise where in a season a race fell — an opener, a finale, a run-in, \
"bookended" — unless the round numbers and the season's round count actually support it
- Every points figure here is a private tally between these two, counted only in the \
races they both finished. It is not a championship standing, so never call it a title \
lead, a championship gap, or evidence of where either driver finished a season
- Do not speculate about anything outside the data: no rumoured feuds, no respect or \
animosity between them, no off-track relationship, no talk of what either driver was \
thinking or wanted, and nothing about confidence, momentum in the head, or a \
psychological edge"""

    if mixed:
        prompt += (
            f"\n- {ai_name} is controlled by the game, not a person. Write the record "
            f"factually and never suggest {ai_name} has intent, motivation, nerves, or "
            f"a career of their own — describe what the AI car did, not what it wanted"
        )

    rivalry_system = (
        "You are a sports journalist covering CGR League. "
        + LEAGUE_CONTEXT
        + "Write in an engaging, analytical style — punchy sentences, specific "
        "references to names and numbers. Every rivalry profile must feel distinct. "
        "Separate the paragraphs of `content` with \\n\\n."
    )
    result = _call_model(
        prompt, RIVALRY_SUMMARY_SCHEMA, system=rivalry_system, max_tokens=4000
    )

    rivalry, _ = DriverRivalry.objects.update_or_create(
        driver_a=driver_a,
        driver_b=driver_b,
        defaults={
            "summary": result["summary"].strip(),
            "content": result["content"].strip(),
            "shared_races": data["shared_races"],
        },
    )
    cache.delete(key_rivalry(a_id, b_id))
    logger.info("Generated rivalry summary for %s v %s", a_name, b_name)
    return rivalry
