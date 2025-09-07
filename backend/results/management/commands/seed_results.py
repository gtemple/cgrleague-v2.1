from importlib import import_module

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q

from seasons.models import Season
from tracks.models import Track
from entries.models import DriverSeason
from results.models import Race, RaceResult


class Command(BaseCommand):
    help = "Seed results for a season into results.Race and results.RaceResult."

    def add_arguments(self, parser):
        parser.add_argument("--season", type=int, required=True, help="Season ID (e.g. 1)")
        parser.add_argument(
            "--from-legacy",
            action="store_true",
            help="Load rows from the legacy 'race_results' table instead of seed files.",
        )

    def handle(self, *args, **opts):
        season_id = opts["season"]
        from_legacy = opts["from_legacy"]

        try:
            season = Season.objects.get(id=season_id)
        except Season.DoesNotExist:
            raise CommandError(f"Season {season_id} not found. Create seasons first.")

        if from_legacy:
            rows = self._load_from_legacy(season_id)
        else:
            rows = self._load_from_seed_file(season_id)

        if not rows:
            raise CommandError(f"No rows found for season {season_id}.")

        created_races = 0
        created_results = 0
        updated_results = 0
        demotions = []  # when we must demote duplicate FL/DOTD/PP flags

        with transaction.atomic():
            # Ensure all Race objects first (so we can safely enforce FL/DOTD/PP uniqueness per race)
            race_cache = {}
            for r in rows:
                key = (r["race_order"], r["sprint"])
                if key in race_cache:
                    continue
                track = Track.objects.filter(id=r["track_id"]).first()
                if not track:
                    raise CommandError(f"Track id {r['track_id']} not found (round {r['race_order']}).")

                race, was_created = Race.objects.get_or_create(
                    season=season,
                    round=r["race_order"],
                    is_sprint=r["sprint"],
                    defaults={"track": track, "laps": r.get("race_distance")},
                )
                # If it already exists but track/laps differ, keep DB as source of truth unless missing.
                if not was_created:
                    if race.track_id != track.id and race.track_id is None:
                        race.track = track
                        race.save(update_fields=["track"])
                else:
                    created_races += 1

                race_cache[key] = race

            # Insert/Upsert results
            for r in rows:
                race = race_cache[(r["race_order"], r["sprint"])]

                try:
                    ds = DriverSeason.objects.get(season=season, driver_id=r["driver_id"])
                except DriverSeason.DoesNotExist:
                    raise CommandError(
                        f"DriverSeason missing for driver_id={r['driver_id']} season={season_id}. "
                        "Run your Team/Driver season seeder first."
                    )

                status = "DNF" if r["dnf"] else "FIN"
                finish_position = None if r["dnf"] else r["position"]

                # Enforce unique flags per race (fastest_lap/dotd/pole_position)
                fl = bool(r.get("fastest_lap", False))
                dotd = bool(r.get("dotd", False))
                pole = bool(r.get("pole_position", False))  # most S1 data won't have this

                def safe_flag(flag_name: str, desired: bool) -> bool:
                    if not desired:
                        return False
                    exists = RaceResult.objects.filter(race=race).filter(**{flag_name: True}).exists()
                    if exists:
                        demotions.append(f"{flag_name.upper()} duplicate in R{race.round}: demoted driver_id={r['driver_id']}")
                        return False
                    return True

                fl = safe_flag("fastest_lap", fl)
                dotd = safe_flag("dotd", dotd)
                pole = safe_flag("pole_position", pole)

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
                    created_results += 1
                else:
                    updated_results += 1

        # Summary
        self.stdout.write(self.style.SUCCESS(
            f"Season {season_id}: Races created {created_races}; "
            f"Results created {created_results}, updated {updated_results}."
        ))
        for d in demotions:
            self.stdout.write(self.style.WARNING(d))

    # ---------- loaders ----------
    def _load_from_legacy(self, season_id: int):
        """
        Read from your *old* table schema:
        (id, user_id, track_id, team_id, position, dnf, fastest_lap, dotd, season_id, sprint, race_distance, race_order, pole_position?)
        Only the columns we need are used.
        """
        from django.db import connection

        sql = """
            SELECT user_id AS driver_id,
                   track_id,
                   position,
                   dnf,
                   fastest_lap,
                   dotd,
                   sprint,
                   race_distance,
                   race_order
            FROM race_results
            WHERE season_id = %s
            ORDER BY race_order, driver_id
        """
        with connection.cursor() as cur:
            cur.execute(sql, [season_id])
            cols = [c[0] for c in cur.description]
            rows = [dict(zip(cols, row)) for row in cur.fetchall()]
        return rows

    def _load_from_seed_file(self, season_id: int):
        """
        Import from results.seed_data.season_<N> which must expose LEGACY_ROWS:
        a list of dicts:
          {
            "driver_id": int,
            "track_id": int,
            "position": int,
            "dnf": bool,
            "fastest_lap": bool,
            "dotd": bool,
            "sprint": bool,
            "race_distance": int | None,
            "race_order": int,
            # optional:
            "pole_position": bool
          }
        """
        try:
            mod = import_module(f"results.seed_data.season_{season_id}")
        except ModuleNotFoundError:
            raise CommandError(
                f"results/seed_data/season_{season_id}.py not found. "
                f"Create it or use --from-legacy."
            )
        rows = getattr(mod, "LEGACY_ROWS", None)
        if not rows:
            raise CommandError(f"LEGACY_ROWS not defined or empty in season_{season_id}.py")
        return rows
