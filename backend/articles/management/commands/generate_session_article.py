from django.core.management.base import BaseCommand, CommandError

from articles import llm
from articles.generator import generate_session_article


class Command(BaseCommand):
    help = "Generate a SESSION article covering 2-5 consecutive races run in one sitting."

    def add_arguments(self, parser):
        parser.add_argument(
            "race_ids",
            type=int,
            nargs="+",
            help="IDs of the races in the session (2-5, consecutive rounds)",
        )
        parser.add_argument(
            "--provider",
            choices=["anthropic", "deepseek"],
            help="Override ARTICLE_LLM_PROVIDER for this run",
        )

    def handle(self, *args, **options):
        llm.set_provider(options.get("provider"))
        race_ids = options["race_ids"]
        self.stdout.write(f"Generating session article for races {race_ids}...")
        try:
            article = generate_session_article(race_ids)
        except Exception as e:
            raise CommandError(str(e)) from e

        self.stdout.write(
            self.style.SUCCESS(f'SESSION created: "{article.title}" (id={article.id})')
        )
