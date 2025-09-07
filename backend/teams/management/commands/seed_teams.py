
from django.core.management.base import BaseCommand
from teams.models import Team

# "founded" reflects the modern team lineage in F1 (not the road-car brand year).
# Examples:
# - Aston Martin (modern F1 team) = 2021 (rebranded from Racing Point)
# - Alfa Romeo = Sauber lineage (1993)
# - Alpha Tauri = Toro Rosso lineage (2006)
# - Mercedes (modern team) = 2010 (Brawn GP acquisition)
# For Cadillac (no current F1 entry), we leave founded=None.
# For "Sauber Kick" (2024 Stake F1 Team Kick Sauber), we use Sauber lineage (1993).

DATA = [
    {"team_name": "Ferrari",       "country": "Italy",          "founded": 1929, "team_img": "ferrari"},
    {"team_name": "Mclaren",       "country": "United Kingdom", "founded": 1963, "team_img": "mclaren"},
    {"team_name": "Aston Martin",  "country": "United Kingdom", "founded": 2021, "team_img": "aston-martin"},
    {"team_name": "Red Bull",      "country": "Austria",        "founded": 2005, "team_img": "red-bull"},
    {"team_name": "Mercedes",      "country": "Germany",        "founded": 2010, "team_img": "mercedes"},
    {"team_name": "Haas",          "country": "United States",  "founded": 2014, "team_img": "haas"},
    {"team_name": "Alpha Tauri",   "country": "Italy",          "founded": 2006, "team_img": "alpha-tauri"},
    {"team_name": "Alfa Romeo",    "country": "Switzerland",    "founded": 1993, "team_img": "alfa-romeo"},
    {"team_name": "Williams",      "country": "United Kingdom", "founded": 1977, "team_img": "williams"},
    {"team_name": "Alpine",        "country": "France",         "founded": 2021, "team_img": "alpine"},
    # extras
    {"team_name": "Cadillac",      "country": "United States",  "founded": None, "team_img": "cadillac"},
    {"team_name": "Sauber Kick",   "country": "Switzerland",    "founded": 1993, "team_img": "sauber-kick"},
]

class Command(BaseCommand):
    help = "Seed the teams table (safe to re-run)."

    def handle(self, *args, **kwargs):
        created, updated = 0, 0
        for row in DATA:
            obj, was_created = Team.objects.update_or_create(
                team_name=row["team_name"],
                defaults=row,
            )
            created += int(was_created)
            updated += int(not was_created)
        self.stdout.write(self.style.SUCCESS(
            f"Teams seeded. Created: {created}, Updated: {updated}."
        ))
