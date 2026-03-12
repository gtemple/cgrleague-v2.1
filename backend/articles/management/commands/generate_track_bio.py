from django.core.management.base import BaseCommand, CommandError
from articles.generator import generate_track_bio


class Command(BaseCommand):
    help = "Generate a history overview blurb for a track."

    def add_arguments(self, parser):
        parser.add_argument("track_id", type=int, help="ID of the track")

    def handle(self, *args, **options):
        track_id = options["track_id"]
        self.stdout.write(f"Generating bio for track {track_id}...")
        try:
            track = generate_track_bio(track_id)
        except Exception as e:
            raise CommandError(str(e)) from e

        self.stdout.write(self.style.SUCCESS(f'Bio saved for "{track}" (id={track.id})'))
        self.stdout.write(track.bio)
