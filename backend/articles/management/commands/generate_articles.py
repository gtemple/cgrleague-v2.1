from django.core.management.base import BaseCommand, CommandError

from articles import llm
from articles.generator import generate_articles_for_race


class Command(BaseCommand):
    help = "Generate RECAP and PREVIEW articles for a completed race."

    def add_arguments(self, parser):
        parser.add_argument("race_id", type=int, help="ID of the completed race")

        parser.add_argument(
            "--provider",
            choices=["anthropic", "deepseek"],
            help="Override ARTICLE_LLM_PROVIDER for this run",
        )

    def handle(self, *args, **options):
        llm.set_provider(options.get("provider"))
        race_id = options["race_id"]
        self.stdout.write(f"Generating articles for race {race_id}...")
        try:
            recap, preview = generate_articles_for_race(race_id)
        except Exception as e:
            raise CommandError(str(e)) from e

        self.stdout.write(self.style.SUCCESS(f'RECAP created: "{recap.title}" (id={recap.id})'))
        if preview:
            self.stdout.write(self.style.SUCCESS(f'PREVIEW created: "{preview.title}" (id={preview.id})'))
        else:
            self.stdout.write("No next race found — PREVIEW skipped.")
