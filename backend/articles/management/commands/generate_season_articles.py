from django.core.management.base import BaseCommand, CommandError
from articles.generator import generate_articles_for_season


class Command(BaseCommand):
    help = "Generate season recap and/or preview articles for a given season ID."

    def add_arguments(self, parser):
        parser.add_argument("season_id", type=int, help="Season ID to generate articles for")
        parser.add_argument(
            "--recap-only",
            action="store_true",
            help="Only generate the season recap",
        )
        parser.add_argument(
            "--preview-only",
            action="store_true",
            help="Only generate the season preview",
        )

    def handle(self, *args, **options):
        season_id = options["season_id"]
        recap_only = options["recap_only"]
        preview_only = options["preview_only"]

        if recap_only and preview_only:
            raise CommandError("Cannot use --recap-only and --preview-only together.")

        do_recap = not preview_only
        do_preview = not recap_only

        self.stdout.write(f"Generating season articles for Season {season_id}...")

        try:
            recap, preview = generate_articles_for_season(
                season_id, recap=do_recap, preview=do_preview
            )
        except Exception as e:
            raise CommandError(f"Generation failed: {e}") from e

        if recap:
            self.stdout.write(self.style.SUCCESS(f"  Season Recap: [{recap.id}] {recap.title}"))
        if preview:
            self.stdout.write(self.style.SUCCESS(f"  Season Preview: [{preview.id}] {preview.title}"))
