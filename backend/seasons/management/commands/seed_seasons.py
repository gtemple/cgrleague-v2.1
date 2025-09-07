from django.core.management.base import BaseCommand
from seasons.models import Season

SEED = [
    (1, "F121"),
    (2, "F121"),
    (3, "F121"),
    (4, "F121"),
    (5, "F122"),
    (6, "F122"),
]

class Command(BaseCommand):
    help = "Seed the seasons table (safe to re-run)."

    def handle(self, *args, **opts):
        created, updated = 0, 0
        for pk, game in SEED:
            # set explicit PKs for idempotency
            obj, was_created = Season.objects.update_or_create(
                id=pk, defaults={"game": game}
            )
            created += 1 if was_created else 0
            updated += 0 if was_created else 1
        self.stdout.write(self.style.SUCCESS(
            f"Seasons seeded. Created: {created}, Updated: {updated}."
        ))