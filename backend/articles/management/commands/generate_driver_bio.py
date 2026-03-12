from django.core.management.base import BaseCommand, CommandError
from articles.generator import generate_driver_bio


class Command(BaseCommand):
    help = "Generate a career biography blurb for a driver."

    def add_arguments(self, parser):
        parser.add_argument("driver_id", type=int, help="ID of the driver")

    def handle(self, *args, **options):
        driver_id = options["driver_id"]
        self.stdout.write(f"Generating bio for driver {driver_id}...")
        try:
            driver = generate_driver_bio(driver_id)
        except Exception as e:
            raise CommandError(str(e)) from e

        self.stdout.write(self.style.SUCCESS(f'Bio saved for "{driver}" (id={driver.id})'))
        self.stdout.write(driver.bio)
