from collections import defaultdict

from django.core.cache import cache
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from drivers.models import Driver, DriverRivalry
from results.cache import CACHE_TTL, key_driver_rivals, key_rivalry
from results.models import RaceResult
from results.scoring import points_for_position

from .utils import serialize_driver


def _blank_tally():
    return {
        "races": 0,
        "ahead": 0,
        "points": 0,
        "wins": 0,
        "podiums": 0,
        "poles": 0,
        "fastest_laps": 0,
        "dotd": 0,
        "dnfs": 0,
        "finish_sum": 0,
        "finish_count": 0,
        "best_finish": None,
        # Newer flags: only recorded from S7 on, so these carry their own
        # denominators rather than riding on the all-time race count.
        "grid_races": 0,
        "grid_sum": 0,
        "positions_gained": 0,
        "cleanest_driver": 0,
        "most_overtakes": 0,
    }


def _record(tally, row, ahead):
    pos = row["finish_position"]
    tally["races"] += 1
    tally["points"] += points_for_position(pos) + (
        1 if row["fastest_lap"] and pos is not None and pos <= 10 else 0
    )
    if ahead:
        tally["ahead"] += 1
    if pos is not None:
        tally["finish_sum"] += pos
        tally["finish_count"] += 1
        if pos == 1:
            tally["wins"] += 1
        if pos <= 3:
            tally["podiums"] += 1
        if tally["best_finish"] is None or pos < tally["best_finish"]:
            tally["best_finish"] = pos
    if row["pole_position"]:
        tally["poles"] += 1
    if row["fastest_lap"]:
        tally["fastest_laps"] += 1
    if row["dotd"]:
        tally["dotd"] += 1
    if row["status"] == "DNF":
        tally["dnfs"] += 1

    grid = row["grid_position"]
    if grid is not None:
        tally["grid_races"] += 1
        tally["grid_sum"] += grid
        if pos is not None:
            tally["positions_gained"] += grid - pos
    if row["cleanest_driver"]:
        tally["cleanest_driver"] += 1
    if row["most_overtakes"]:
        tally["most_overtakes"] += 1


def _finalise(tally):
    out = dict(tally)
    out["avg_finish"] = (
        round(tally["finish_sum"] / tally["finish_count"], 2)
        if tally["finish_count"] else None
    )
    out["avg_grid"] = (
        round(tally["grid_sum"] / tally["grid_races"], 2)
        if tally["grid_races"] else None
    )
    out["avg_positions_gained"] = (
        round(tally["positions_gained"] / tally["grid_races"], 2)
        if tally["grid_races"] else None
    )
    del out["finish_sum"], out["finish_count"], out["grid_sum"]
    return out


def _rivalry_summary(a_id, b_id, shared_races):
    """The AI profile for this pair, if one has been generated."""
    row = DriverRivalry.objects.filter(driver_a_id=a_id, driver_b_id=b_id).first()
    if row is None:
        return None
    return {
        "summary": row.summary,
        "content": row.content,
        "generated_at": row.generated_at.isoformat(),
        # Written before races they have since shared, so the prose may be
        # describing a record that has already moved on.
        "stale": row.shared_races != shared_races,
    }


def build_rivalry_payload(a_id, b_id):
    """
    Every head-to-head fact for one pair, in the shape the rivalry endpoint
    returns. `a_id` must be the lower driver id.

    Lives outside the view because the article generator prompts from exactly
    these numbers, so a generated summary and the page can never disagree.

    Returns None if either driver does not exist.
    """
    try:
        driver_a_obj = Driver.objects.get(pk=a_id)
        driver_b_obj = Driver.objects.get(pk=b_id)
    except Driver.DoesNotExist:
        return None

    rows = list(
        RaceResult.objects
        .filter(driver_season__driver_id__in=(a_id, b_id))
        .values(
            "race_id",
            "finish_position",
            "status",
            "pole_position",
            "fastest_lap",
            "dotd",
            "grid_position",
            "cleanest_driver",
            "most_overtakes",
            "driver_season__driver_id",
            "driver_season__team_season_id",
            "driver_season__team_season__team__team_name",
            "driver_season__team_season__display_name",
            "driver_season__team_season__color",
            "race__season_id",
            "race__round",
            "race__is_sprint",
            "race__track_id",
            "race__track__name",
            "race__track__country",
        )
        .order_by("race__season_id", "race__round", "race__is_sprint")
    )

    by_race = defaultdict(dict)
    race_meta = {}
    for row in rows:
        by_race[row["race_id"]][row["driver_season__driver_id"]] = row
        race_meta[row["race_id"]] = row

    # Preserve chronological order of the shared races.
    shared = [
        rid for rid in dict.fromkeys(r["race_id"] for r in rows)
        if len(by_race[rid]) == 2
        and by_race[rid][a_id]["finish_position"] is not None
        and by_race[rid][b_id]["finish_position"] is not None
    ]

    tally_a, tally_b = _blank_tally(), _blank_tally()
    # Which seasons actually carry the newer flags for THIS pair. Derived
    # from the data so it widens on its own as more seasons record them.
    tracked = {"grid": set(), "cleanest": set(), "overtakes": set()}
    by_season = {}
    by_track = {}
    timeline = []
    teammate_seasons = set()
    cum_a = cum_b = 0
    streak_holder, streak_len = None, 0
    best_streak = {a_id: 0, b_id: 0}
    biggest = None

    for rid in shared:
        ra, rb = by_race[rid][a_id], by_race[rid][b_id]
        pa, pb = ra["finish_position"], rb["finish_position"]
        a_ahead = pa < pb

        _record(tally_a, ra, a_ahead)
        _record(tally_b, rb, not a_ahead)

        pts_a = points_for_position(pa) + (1 if ra["fastest_lap"] and pa <= 10 else 0)
        pts_b = points_for_position(pb) + (1 if rb["fastest_lap"] and pb <= 10 else 0)
        cum_a += pts_a
        cum_b += pts_b

        if ra["driver_season__team_season_id"] == rb["driver_season__team_season_id"]:
            teammate_seasons.add(ra["race__season_id"])

        winner = a_id if a_ahead else b_id
        if winner == streak_holder:
            streak_len += 1
        else:
            streak_holder, streak_len = winner, 1
        best_streak[winner] = max(best_streak[winner], streak_len)

        season_no = ra["race__season_id"]
        if ra["grid_position"] is not None or rb["grid_position"] is not None:
            tracked["grid"].add(season_no)
        if ra["cleanest_driver"] or rb["cleanest_driver"]:
            tracked["cleanest"].add(season_no)
        if ra["most_overtakes"] or rb["most_overtakes"]:
            tracked["overtakes"].add(season_no)

        margin = abs(pa - pb)
        if biggest is None or margin > biggest["margin"]:
            biggest = {"race_id": rid, "margin": margin}

        s = ra["race__season_id"]
        season_row = by_season.setdefault(s, {
            "season_id": s, "races": 0, "a_ahead": 0, "b_ahead": 0,
            "a_points": 0, "b_points": 0,
        })
        season_row["races"] += 1
        season_row["a_ahead" if a_ahead else "b_ahead"] += 1
        season_row["a_points"] += pts_a
        season_row["b_points"] += pts_b

        t = ra["race__track_id"]
        track_row = by_track.setdefault(t, {
            "track_id": t, "name": ra["race__track__name"],
            "country": ra["race__track__country"],
            "races": 0, "a_ahead": 0, "b_ahead": 0,
        })
        track_row["races"] += 1
        track_row["a_ahead" if a_ahead else "b_ahead"] += 1

        timeline.append({
            "race_id": rid,
            "season_id": s,
            "round": ra["race__round"],
            "is_sprint": ra["race__is_sprint"],
            "track": ra["race__track__name"],
            "country": ra["race__track__country"],
            "a_finish": pa,
            "b_finish": pb,
            "a_points": pts_a,
            "b_points": pts_b,
            "winner": "a" if a_ahead else "b",
            "margin": margin,
            "cum_a": cum_a,
            "cum_b": cum_b,
        })

    # Current streak runs backwards from the most recent shared race.
    current = {"driver": None, "length": 0}
    if timeline:
        last = timeline[-1]["winner"]
        n = 0
        for entry in reversed(timeline):
            if entry["winner"] != last:
                break
            n += 1
        current = {"driver": last, "length": n}

    closest = [t for t in timeline if t["margin"] == 1]

    def team_of(did):
        for row in reversed(rows):
            if row["driver_season__driver_id"] == did:
                return {
                    "name": (row["driver_season__team_season__display_name"]
                             or row["driver_season__team_season__team__team_name"]),
                    "color": row["driver_season__team_season__color"] or "",
                }
        return {"name": "", "color": ""}

    payload = {
        "driver_a": {**serialize_driver(driver_a_obj), "team": team_of(a_id)},
        "driver_b": {**serialize_driver(driver_b_obj), "team": team_of(b_id)},
        "shared_races": len(shared),
        "summary": _rivalry_summary(a_id, b_id, len(shared)),
        "totals": {"a": _finalise(tally_a), "b": _finalise(tally_b)},
        "seasons": sorted(by_season.values(), key=lambda r: r["season_id"]),
        "tracks": sorted(by_track.values(), key=lambda r: (-r["races"], r["name"])),
        "timeline": timeline,
        "teammate_seasons": sorted(teammate_seasons),
        "streaks": {
            "current": current,
            "best_a": best_streak[a_id],
            "best_b": best_streak[b_id],
        },
        "closest_races": len(closest),
        "biggest_margin": biggest,
        "tracked": {
            "grid": sorted(tracked["grid"]),
            "cleanest": sorted(tracked["cleanest"]),
            "overtakes": sorted(tracked["overtakes"]),
            "grid_races": tally_a["grid_races"],
        },
    }
    return payload


class RivalryView(APIView):
    """
    GET /api/rivalry/<driver_a>/<driver_b>/

    Head-to-head profile for two drivers across every race both contested.
    Only races where BOTH drivers have a classified finish_position count
    toward the head-to-head record, so the comparison is always like-for-like.
    """
    permission_classes = [AllowAny]

    def get(self, request, driver_a: int, driver_b: int):
        # Canonical ordering keeps one cache entry per pair.
        a_id, b_id = sorted((driver_a, driver_b))
        if a_id == b_id:
            return Response({"detail": "Pick two different drivers."}, status=400)

        ck = key_rivalry(a_id, b_id)
        cached = cache.get(ck)
        if cached is not None:
            return Response(cached)

        payload = build_rivalry_payload(a_id, b_id)
        if payload is None:
            return Response({"detail": "Driver not found."}, status=404)

        cache.set(ck, payload, timeout=CACHE_TTL)
        return Response(payload)


class DriverRivalsView(APIView):
    """
    GET /api/drivers/<driver_id>/rivals/

    Every driver this one has shared a classified race with, human or AI,
    with the head-to-head record against each. Powers the rivals block on
    any driver page; unlike the Hall of Fame matrix this is not restricted
    to human drivers, and it scales with one driver's races rather than
    the square of the whole grid.
    """
    permission_classes = [AllowAny]

    def get(self, request, driver_id: int):
        ck = key_driver_rivals(driver_id)
        cached = cache.get(ck)
        if cached is not None:
            return Response(cached)

        if not Driver.objects.filter(pk=driver_id).exists():
            return Response({"detail": "Driver not found."}, status=404)

        race_ids = list(
            RaceResult.objects
            .filter(driver_season__driver_id=driver_id, finish_position__isnull=False)
            .values_list("race_id", flat=True)
        )
        if not race_ids:
            payload = {"driver_id": driver_id, "rivals": []}
            cache.set(ck, payload, timeout=CACHE_TTL)
            return Response(payload)

        rows = (
            RaceResult.objects
            .filter(race_id__in=race_ids, finish_position__isnull=False)
            .values(
                "race_id",
                "finish_position",
                "driver_season__driver_id",
                "driver_season__driver__first_name",
                "driver_season__driver__last_name",
                "driver_season__driver__profile_image",
                "driver_season__driver__human",
            )
        )

        mine = {}
        others = defaultdict(list)
        info = {}
        for row in rows:
            did = row["driver_season__driver_id"]
            if did == driver_id:
                mine[row["race_id"]] = row["finish_position"]
            else:
                others[did].append((row["race_id"], row["finish_position"]))
                info.setdefault(did, row)

        rivals = []
        for did, entries in others.items():
            wins = losses = 0
            for race_id, pos in entries:
                my_pos = mine.get(race_id)
                if my_pos is None:
                    continue
                if my_pos < pos:
                    wins += 1
                else:
                    losses += 1
            total = wins + losses
            if not total:
                continue
            row = info[did]
            rivals.append({
                "driver": {
                    "id": did,
                    "first_name": row["driver_season__driver__first_name"] or "",
                    "last_name": row["driver_season__driver__last_name"] or "",
                    "display_name": (
                        f"{row['driver_season__driver__first_name'] or ''} "
                        f"{row['driver_season__driver__last_name'] or ''}"
                    ).strip(),
                    "profile_image": row["driver_season__driver__profile_image"],
                    "human": row["driver_season__driver__human"],
                },
                "wins": wins,
                "losses": losses,
                "races": total,
            })

        # Closest first: smallest skew from an even split, most meetings breaks ties.
        rivals.sort(key=lambda r: (abs(r["wins"] / r["races"] - 0.5), -r["races"]))

        payload = {"driver_id": driver_id, "rivals": rivals}
        cache.set(ck, payload, timeout=CACHE_TTL)
        return Response(payload)
