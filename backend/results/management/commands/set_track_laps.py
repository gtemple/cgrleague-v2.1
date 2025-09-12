# results/management/commands/set_track_laps.py
from django.core.management.base import BaseCommand, CommandError
from results.services.track_laps import set_track_laps

class Command(BaseCommand):
    help = (
        "Populate laps_completed for all RaceResult rows at a track. "
        "Non-sprint races use the provided laps; sprint races use a flat value (default 5)."
    )

    def add_arguments(self, parser):
        parser.add_argument("track_id", type=int, help="Track ID")
        parser.add_argument("laps", type=int, help="Lap count for non-sprint races")
        parser.add_argument("--season", type=int, default=None, help="Limit to a specific season_id")
        parser.add_argument("--sprint-laps", type=int, default=5, help="Lap count for sprint races (default 5)")
        parser.add_argument("--only-empty", action="store_true", help="Only fill rows where laps_completed is NULL or 0")
        parser.add_argument("--dry-run", action="store_true", help="Show how many rows would be updated, without writing")

    def handle(self, *args, **options):
        track_id    = options["track_id"]
        laps        = options["laps"]
        season_id   = options.get("season")
        sprint_laps = options["sprint_laps"]
        only_empty  = options["only_empty"]
        dry_run     = options["dry_run"]

        if laps <= 0:
            raise CommandError("laps must be a positive integer")

        result = set_track_laps(
            track_id=track_id,
            laps=laps,
            season_id=season_id,
            sprint_laps=sprint_laps,
            only_empty=only_empty,
            dry_run=dry_run,
        )

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"[DRY RUN] Non-sprint to update: {result['non_sprint_to_update']}, "
                    f"Sprint to update: {result['sprint_to_update']}"
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Updated {result['updated']} rows "
                    f"(non-sprint: {result['non_sprint_updated']}, sprint: {result['sprint_updated']})."
                )
            )
