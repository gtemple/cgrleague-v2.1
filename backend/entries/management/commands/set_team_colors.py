from django.core.management.base import BaseCommand
from entries.models import TeamSeason

# Real-world livery colors, applied to every TeamSeason row for that team
# (colors are per-season on the model, but a team's brand color is stable).
TEAM_COLORS = {
    "Ferrari": "#E8002D",
    "Mclaren": "#FF8000",
    "Mercedes": "#00D2BE",
    "Red Bull": "#3671C6",
    "Aston Martin": "#229971",
    "Alpine": "#2293D1",
    "Williams": "#64C4FF",
    "Haas": "#B6BABD",
    "Sauber Kick": "#00E701",
    "Alfa Romeo": "#B12039",
    "Visa Cash App Racing Bulls Formula One Team": "#6692FF",
    "Alpha Tauri": "#6692FF",
    "Cadillac": "#A9431E",
}


class Command(BaseCommand):
    help = "Backfill TeamSeason.color with each team's real livery color (safe to re-run)."

    def handle(self, *args, **kwargs):
        updated = 0
        for team_name, color in TEAM_COLORS.items():
            n = TeamSeason.objects.filter(team__team_name=team_name).update(color=color)
            updated += n
        self.stdout.write(self.style.SUCCESS(f"Team colors set on {updated} TeamSeason rows."))
