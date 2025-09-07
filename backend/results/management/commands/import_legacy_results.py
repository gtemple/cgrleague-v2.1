from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Dict, List

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from results.models import Race, RaceResult
from drivers.models import Driver
from seasons.models import Season
from tracks.models import Track
from entries.models import DriverSeason


INSERT_RE = re.compile(
    r"INSERT\s+INTO\s+race_results\s*\((?P<cols>[^)]*?)\)\s*VALUES\s*(?P<values>.*?);",
    re.IGNORECASE | re.DOTALL,
)
# Captures each "(...)" group inside VALUES(...)
TUPLE_RE = re.compile(r"\((.*?)\)", re.DOTALL)


def _split_csv_respecting_strings(s: str) -> List[str]:
    """
    Split a single "(...)" tuple payload by commas, but respect quoted strings.
    Your payload is numbers/bools, but this keeps it robust.
    """
    parts: List[str] = []
    cur = []
    in_str = False
    esc = False
    quote_char = None

    for ch in s:
        if in_str:
            cur.append(ch)
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == quote_char:
                in_str = False
                quote_char = None
        else:
            if ch in ("'", '"'):
                in_str = True
                quote_char = ch
                cur.append(ch)
            elif ch == ",":
                parts.append("".join(cur).strip())
                cur = []
            else:
                cur.append(ch)
    if cur:
        parts.append("".join(cur).strip())
    return parts


def _coerce(token: str) -> Any:
    t = token.strip()
    tl = t.lower()
    if tl in ("true", "false"):
        return tl == "true"
    if tl in ("null", "none"):
        return None
    if (t.startswith("'") and t.endswith("'")) or (t.startswith('"') and t.endswith('"')):
        return t[1:-1]
    # int (allow bare negatives just in case)
    try:
        return int(t)
    except ValueError:
        # Last resort, return raw token
        return t


def parse_sql(sql_text: str) -> List[Dict[str, Any]]:
    """
    Returns a list of dict rows based on column headers per INSERT block.
    """
    rows: List[Dict[str, Any]] = []
    for m in INSERT_RE.finditer(sql_text):
        cols = [c.strip() for c in m.group("cols").split(",")]
        values_blob = m.group("values")
        for tup in TUPLE_RE.findall(values_blob):
            tokens = _split_csv_respecting_strings(tup)
            if len(tokens) != len(cols):
                # tolerate minor formatting like trailing comments after a tuple
                # but if it's wildly off, skip it
                continue
            data = {col: _coerce(tok) for col, tok in zip(cols, tokens)}
            rows.append(data)
    return rows


class Command(BaseCommand):
    help = "Import legacy raw SQL INSERTs for race_results into the new results.RaceResult model."

    def add_arguments(self, parser):
        parser.add_argument(
            "--path",
            required=True,
            help="Path to a .sql file (use '-' to read from stdin).",
        )
        parser.add_argument(
            "--season",
            type=int,
            help="If provided, only import rows with this season_id.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Parse and validate, but don't write to DB.",
        )

    @transaction.atomic
    def handle(self, *args, **opts):
        path = opts["path"]
        only_season = opts.get("season")
        dry = opts.get("dry_run", False)

        # 1) Load SQL text
        if path == "-":
            import sys
            sql_text = sys.stdin.read()
        else:
            p = Path(path)
            if not p.exists():
                raise CommandError(f"File not found: {path}")
            sql_text = p.read_text(encoding="utf-8")

        # 2) Parse
        raw_rows = parse_sql(sql_text)
        if not raw_rows:
            raise CommandError("No rows parsed. Check your SQL format (INSERT INTO race_results ... VALUES (...));")

        created, updated, skipped = 0, 0, 0
        errs: List[str] = []
        demotions: List[str] = []

        # ---- Pass 1: ensure all Race objects exist (cache by season/round/is_sprint) ----
        race_cache: dict[tuple[int, int, bool], Race] = {}

        for r in raw_rows:
            try:
                season_id = int(r["season_id"])
                if only_season and season_id != only_season:
                    continue
                rnd = int(r["race_order"])
                is_sprint = bool(r["sprint"])
                track_id = int(r["track_id"])
                key = (season_id, rnd, is_sprint)
                if key in race_cache:
                    continue

                season = Season.objects.filter(id=season_id).first()
                if not season:
                    skipped += 1
                    errs.append(f"Season {season_id} missing (round {rnd}).")
                    continue

                track = Track.objects.filter(id=track_id).first()
                if not track:
                    skipped += 1
                    errs.append(f"Track id {track_id} not found (season {season_id}, round {rnd}).")
                    continue

                race, _ = Race.objects.get_or_create(
                    season=season,
                    round=rnd,
                    is_sprint=is_sprint,
                    defaults={"track": track, "laps": r.get("race_distance")},
                )
                # If created without track, or track is empty, attach it.
                if race.track_id is None:
                    race.track = track
                    race.save(update_fields=["track"])
                race_cache[key] = race

            except Exception as e:
                skipped += 1
                errs.append(f"{type(e).__name__} creating Race for row {r}: {e}")

        # ---- Pass 2: upsert RaceResult rows ----
        for r in raw_rows:
            try:
                season_id = int(r["season_id"])
                if only_season and season_id != only_season:
                    continue

                driver_id = int(r["user_id"])
                rnd = int(r["race_order"])
                is_sprint = bool(r["sprint"])
                position = int(r["position"]) if r.get("position") is not None else None
                dnf = bool(r["dnf"])
                fl_in = bool(r.get("fastest_lap", False))
                dotd_in = bool(r.get("dotd", False))
                # Optional legacy (generally absent in S1)
                pole_in = bool(r.get("pole_position", False))

                race = race_cache.get((season_id, rnd, is_sprint))
                if not race:
                    skipped += 1
                    errs.append(f"Race missing for season={season_id} round={rnd} sprint={is_sprint}.")
                    continue

                ds = DriverSeason.objects.filter(season_id=season_id, driver_id=driver_id).first()
                if not ds:
                    skipped += 1
                    errs.append(f"DriverSeason missing for driver_id={driver_id} season={season_id}.")
                    continue

                if dry:
                    continue

                status = "DNF" if dnf else "FIN"
                finish_position = None if dnf else position

                # Enforce one FL / DOTD / PP per race (match your partial unique constraints)
                def safe_flag(flag: str, want: bool) -> bool:
                    if not want:
                        return False
                    if RaceResult.objects.filter(race=race, **{flag: True}).exists():
                        demotions.append(f"{flag.upper()} duplicate in R{race.round}: demoted driver_id={driver_id}")
                        return False
                    return True

                fl = safe_flag("fastest_lap", fl_in)
                dotd = safe_flag("dotd", dotd_in)
                pole = safe_flag("pole_position", pole_in)

                obj, was_created = RaceResult.objects.update_or_create(
                    race=race,
                    driver_season=ds,
                    defaults=dict(
                        grid_position=None,
                        finish_position=finish_position,
                        status=status,
                        laps_completed=None,
                        time_ms=None,
                        gap_ms=None,
                        fastest_lap=fl,
                        dotd=dotd,
                        pole_position=pole,
                    ),
                )
                if was_created:
                    created += 1
                else:
                    updated += 1

            except KeyError as e:
                skipped += 1
                errs.append(f"Missing column {e} in parsed row: {r}")
            except Exception as e:
                skipped += 1
                errs.append(f"{type(e).__name__}: {e} for row: {r}")

        if dry:
            self.stdout.write(self.style.SUCCESS(f"Dry run OK. Parsed {len(raw_rows)} rows."))
            if only_season:
                self.stdout.write(self.style.SUCCESS(f"Would import only season {only_season}."))
            if errs:
                self.stdout.write(self.style.WARNING(f"Notes/Warnings ({len(errs)}):"))
                for msg in errs[:25]:
                    self.stdout.write(f"- {msg}")
                if len(errs) > 25:
                    self.stdout.write(f"... plus {len(errs)-25} more")
            if demotions:
                for d in demotions:
                    self.stdout.write(self.style.WARNING(d))
            raise transaction.TransactionManagementError("Dry run — rolled back.")