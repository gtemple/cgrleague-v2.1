from django.core.management.base import BaseCommand, CommandError

from articles import llm
from articles.generator import generate_rivalry_summary


class Command(BaseCommand):
    help = "Generate the AI head-to-head profile for a pair of drivers."

    def add_arguments(self, parser):
        parser.add_argument("driver_a", type=int, help="ID of the first driver")
        parser.add_argument("driver_b", type=int, help="ID of the second driver")

        parser.add_argument(
            "--provider",
            choices=["anthropic", "deepseek"],
            help="Override ARTICLE_LLM_PROVIDER for this run",
        )

    def handle(self, *args, **options):
        llm.set_provider(options.get("provider"))
        a, b = options["driver_a"], options["driver_b"]
        self.stdout.write(f"Generating rivalry summary for drivers {a} and {b}...")
        try:
            rivalry = generate_rivalry_summary(a, b)
        except Exception as e:
            raise CommandError(str(e)) from e

        self.stdout.write(self.style.SUCCESS(f"Saved: {rivalry}"))
        self.stdout.write("")
        self.stdout.write(rivalry.summary)
        self.stdout.write("")
        self.stdout.write(rivalry.content)
