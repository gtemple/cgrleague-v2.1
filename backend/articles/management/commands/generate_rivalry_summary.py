import time

from django.core.management.base import BaseCommand, CommandError

from articles import llm
from articles.generator import eligible_rivalry_pairs, generate_rivalry_summary


class Command(BaseCommand):
    help = "Generate the AI head-to-head profile for a pair of drivers, or for every eligible pair."

    def add_arguments(self, parser):
        parser.add_argument("driver_a", type=int, nargs="?", help="ID of the first driver")
        parser.add_argument("driver_b", type=int, nargs="?", help="ID of the second driver")

        parser.add_argument(
            "--all",
            action="store_true",
            help="Generate for every eligible pair (at least one human, at least one shared race)",
        )
        parser.add_argument(
            "--limit",
            type=int,
            help="With --all, stop after this many generations",
        )
        parser.add_argument(
            "--regenerate",
            action="store_true",
            help="With --all, include pairs that already have a summary (default is to skip them)",
        )
        parser.add_argument(
            "--provider",
            choices=["anthropic", "deepseek"],
            help="Override ARTICLE_LLM_PROVIDER for this run",
        )

    def handle(self, *args, **options):
        llm.set_provider(options.get("provider"))
        if options["all"]:
            return self._batch(options)

        a, b = options["driver_a"], options["driver_b"]
        if a is None or b is None:
            raise CommandError("Give two driver ids, or use --all.")

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

    def _batch(self, options):
        from drivers.models import DriverRivalry

        pairs = eligible_rivalry_pairs()
        if not options["regenerate"]:
            done = set(
                DriverRivalry.objects.values_list("driver_a_id", "driver_b_id")
            )
            pairs = [p for p in pairs if p[0] not in done]

        limit = options.get("limit")
        if limit is not None:
            pairs = pairs[:limit]

        self.stdout.write(f"{len(pairs)} pair(s) to generate.")
        ok, failed = 0, []
        started = time.time()

        for i, ((a, b), shared) in enumerate(pairs, 1):
            try:
                rivalry = generate_rivalry_summary(a, b)
            except Exception as e:
                failed.append(((a, b), str(e)))
                self.stdout.write(self.style.ERROR(f"[{i}/{len(pairs)}] {a} v {b} FAILED: {e}"))
                continue
            ok += 1
            self.stdout.write(
                self.style.SUCCESS(f"[{i}/{len(pairs)}] {rivalry} ({shared} shared races)")
            )
            self.stdout.write(f"    {rivalry.summary}")

        mins = (time.time() - started) / 60
        self.stdout.write("")
        self.stdout.write(f"Done: {ok} generated, {len(failed)} failed, {mins:.1f} min.")
        for (a, b), err in failed:
            self.stdout.write(self.style.ERROR(f"  {a} v {b}: {err}"))
