from django.core.management.base import BaseCommand, CommandError

from newsletter import sender
from newsletter.content import latest_completed_race
from newsletter.models import Issue, Subscriber
from results.models import Race


class Command(BaseCommand):
    help = "Build and send the race newsletter to confirmed subscribers."

    def add_arguments(self, parser):
        target = parser.add_mutually_exclusive_group(required=True)
        target.add_argument("--race", type=int, help="ID of the race to send an issue for")
        target.add_argument(
            "--latest",
            action="store_true",
            help="Use the most recently completed race (what the cron job runs)",
        )

        parser.add_argument(
            "--kind",
            choices=["recap", "preview"],
            default="recap",
            help="Which issue to build: the post-race recap or the pre-race preview",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Render and report without sending or recording anything",
        )
        parser.add_argument("--out", help="With --dry-run, write the rendered HTML to this path")
        parser.add_argument("--to", help="Send a one-off test copy to this address only")
        parser.add_argument(
            "--force",
            action="store_true",
            help="Send again even if this race already went out",
        )

    def handle(self, *args, **options):
        race = self._resolve_race(options)
        kind = options["kind"].upper()
        self.stdout.write(f"Race: {race} ({kind.lower()})")

        already_sent = Issue.objects.filter(race=race, kind=kind, sent_at__isnull=False).first()
        if already_sent and not (options["force"] or options["dry_run"] or options["to"]):
            self.stdout.write(
                self.style.WARNING(
                    f"Already sent on {already_sent.sent_at:%Y-%m-%d %H:%M} "
                    f"to {already_sent.recipient_count} subscriber(s). Use --force to resend."
                )
            )
            return

        if options["dry_run"]:
            self._dry_run(race, kind, options.get("out"))
            return

        if options["to"]:
            sender.send_test(race, options["to"], kind)
            self.stdout.write(self.style.SUCCESS(f"Test copy sent to {options['to']}."))
            return

        active = Subscriber.objects.active().count()
        if not active:
            self.stdout.write(self.style.WARNING("No confirmed subscribers — nothing to send."))
            return

        issue = sender.build_issue(race, kind, resend=options["force"])
        self.stdout.write(f'Sending "{issue.subject}" to {active} subscriber(s)...')
        sent, failed = sender.send_issue(issue)
        self.stdout.write(self.style.SUCCESS(f"Sent to {sent} subscriber(s)."))
        if failed:
            self.stdout.write(self.style.ERROR(f"{failed} delivery(s) failed — see the log."))

    def _resolve_race(self, options) -> Race:
        if options["race"]:
            race = Race.objects.select_related("season", "track").filter(pk=options["race"]).first()
            if race is None:
                raise CommandError(f"No race with id {options['race']}")
            return race

        race = latest_completed_race()
        if race is None:
            raise CommandError("No completed races found")
        return race

    def _dry_run(self, race, kind, out):
        subject, text, html = sender.render_issue(race, kind)
        self.stdout.write(f"Subject: {subject}")
        self.stdout.write(f"Recipients: {Subscriber.objects.active().count()} confirmed subscriber(s)")
        if out:
            with open(out, "w", encoding="utf-8") as fh:
                fh.write(html)
            self.stdout.write(self.style.SUCCESS(f"HTML written to {out}"))
        else:
            self.stdout.write("")
            self.stdout.write(text)
