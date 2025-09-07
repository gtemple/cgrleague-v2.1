from django.core.management.base import BaseCommand, CommandError
from seasons.models import Season
from teams.models import Team
from drivers.models import Driver
from entries.models import TeamSeason, DriverSeason

# 🔑 Add/adjust mappings here. Keys are (first_name, last_name) as they exist in your drivers table.
ASSIGNMENTS = {
    1: {  # Season 1
        ("Giordano", "Temple"): "Ferrari",
        ("Ryan", "Reynolds"): "Mclaren",
        ("Cole", "Reynolds"): "Aston Martin",
        ("Lando", "Norris"): "Mclaren",
        ("Charles", "Leclerc"): "Ferrari",
        ("Sebastian", "Vettel"): "Aston Martin",
        ("Max", "Verstappen"): "Red Bull",
        ("Sergio", "Perez"): "Red Bull",
        ("Lewis", "Hamilton"): "Mercedes",
        ("Valtteri", "Bottas"): "Mercedes",
        ("Mick", "Schumacher"): "Haas",
        ("Nikita", "Mazepin"): "Haas",
        ("Pierre", "Gasly"): "Alpha Tauri",
        ("Yuki", "Tsunoda"): "Alpha Tauri",
        ("Antonio", "Giovinazzi"): "Alfa Romeo",
        ("Kimi", "Räikkönen"): "Alfa Romeo",
        ("George", "Russel"): "Williams",   # one 'l' as in your seed
        ("Nicholas", "Latifi"): "Williams",
        ("Esteban", "Ocon"): "Alpine",
        ("Fernando", "Alonso"): "Alpine",
    },
    2: {  # Season 2 (from your Season 2 result team_ids)
        ("Giordano", "Temple"): "Alpha Tauri",   # team_id 7
        ("Ryan", "Reynolds"): "Alpha Tauri",     # team_id 7
        ("Cole", "Reynolds"): "Alfa Romeo",      # team_id 8
        ("Kimi", "Räikkönen"): "Alfa Romeo",     # team_id 8
        ("Daniel", "Ricciardo"): "Mclaren",      # team_id 2
        ("Lando", "Norris"): "Mclaren",          # team_id 2
        ("Max", "Verstappen"): "Red Bull",       # team_id 4
        ("Sergio", "Perez"): "Red Bull",         # team_id 4
        ("Lewis", "Hamilton"): "Mercedes",       # team_id 5
        ("Valtteri", "Bottas"): "Mercedes",      # team_id 5
        ("Mick", "Schumacher"): "Haas",          # team_id 6
        ("Nikita", "Mazepin"): "Haas",           # team_id 6
        ("Carlos", "Sainz"): "Ferrari",          # team_id 1 (your SQL said "Sains"; we use Sainz)
        ("Charles", "Leclerc"): "Ferrari",       # team_id 1
        ("Sebastian", "Vettel"): "Aston Martin", # team_id 3
        ("Lance", "Stroll"): "Aston Martin",     # team_id 3
        ("George", "Russel"): "Williams",        # team_id 9
        ("Nicholas", "Latifi"): "Williams",      # team_id 9  ("Nic" in your notes)
        ("Esteban", "Ocon"): "Alpine",           # team_id 10
        ("Fernando", "Alonso"): "Alpine",        # team_id 10
    },
    3: {
    ("Giordano", "Temple"): "Mercedes",       # team_id 5
    ("Cole", "Reynolds"): "Mclaren",          # 2
    ("Ryan", "Reynolds"): "Red Bull",         # 4
    ("Pierre", "Gasly"): "Alpha Tauri",       # 7
    ("Yuki", "Tsunoda"): "Alpha Tauri",       # 7
    ("Antonio", "Giovinazzi"): "Alfa Romeo",  # 8
    ("Lando", "Norris"): "Mclaren",           # 2
    ("Max", "Verstappen"): "Red Bull",        # 4
    ("Lewis", "Hamilton"): "Red Bull",        # 4
    ("Mick", "Schumacher"): "Haas",           # 6
    ("Nikita", "Mazepin"): "Haas",            # 6
    ("Carlos", "Sainz"): "Ferrari",           # 1
    ("Charles", "Leclerc"): "Ferrari",        # 1
    ("Sebastian", "Vettel"): "Aston Martin",  # 3
    ("Lance", "Stroll"): "Aston Martin",      # 3
    ("George", "Russel"): "Williams",         # 9  (one “l” to match your seed)
    ("Nicholas", "Latifi"): "Williams",       # 9
    ("Esteban", "Ocon"): "Alpine",            # 10
    ("Fernando", "Alonso"): "Alpine",         # 10
    ("Kimi", "Räikkönen"): "Alfa Romeo",      # 8
  },
    4: {
      ("Giordano", "Temple"): "Mclaren",        # 2
      ("Ryan", "Reynolds"): "Ferrari",          # 1
      ("Cole", "Reynolds"): "Ferrari",          # 1
      ("Pierre", "Gasly"): "Alpha Tauri",       # 7
      ("Yuki", "Tsunoda"): "Alpha Tauri",       # 7
      ("Antonio", "Giovinazzi"): "Alfa Romeo",  # 8
      ("Kimi", "Räikkönen"): "Alfa Romeo",      # 8
      ("Lando", "Norris"): "Mclaren",           # 2
      ("Max", "Verstappen"): "Red Bull",        # 4
      ("Sergio", "Perez"): "Red Bull",          # 4
      ("Lewis", "Hamilton"): "Red Bull",        # 4
      ("Valtteri", "Bottas"): "Red Bull",       # 4
      ("Mick", "Schumacher"): "Haas",           # 6
      ("Nikita", "Mazepin"): "Haas",            # 6
      ("Sebastian", "Vettel"): "Aston Martin",  # 3
      ("George", "Russel"): "Williams",         # 9
      ("Nicholas", "Latifi"): "Williams",       # 9
      ("Esteban", "Ocon"): "Alpine",            # 10
      ("Fernando", "Alonso"): "Alpine",         # 10
      ("Lance", "Stroll"): "Aston Martin",      # 3
  },
  5: {
        ("Giordano", "Temple"): "Alfa Romeo",     # 8
      ("Cole", "Reynolds"): "Alpha Tauri",      # 7
      ("Ryan", "Reynolds"): "Mclaren",          # 2
      ("Lewis", "Hamilton"): "Mercedes",        # 5
      ("George", "Russel"): "Mercedes",         # 5
      ("Max", "Verstappen"): "Red Bull",        # 4
      ("Sergio", "Perez"): "Red Bull",          # 4
      ("Carlos", "Sainz"): "Ferrari",           # 1
      ("Charles", "Leclerc"): "Ferrari",        # 1
      ("Lando", "Norris"): "Mclaren",           # 2
      ("Esteban", "Ocon"): "Alpine",            # 10
      ("Fernando", "Alonso"): "Alpine",         # 10
      ("Yuki", "Tsunoda"): "Alpha Tauri",       # 7
      ("Sebastian", "Vettel"): "Aston Martin",  # 3
      ("Lance", "Stroll"): "Aston Martin",      # 3
      ("Nicholas", "Latifi"): "Williams",       # 9
      ("Valtteri", "Bottas"): "Alfa Romeo",     # 8
      ("Mick", "Schumacher"): "Haas",           # 6
      ("Kevin", "Magnussen"): "Haas",           # 6,  
  },
  6: {
          ("Giordano", "Temple"): "Mercedes",       # 5
      ("Ryan", "Reynolds"): "Mercedes",         # 5
      ("Cole", "Reynolds"): "Alpine",           # 10
      ("Max", "Verstappen"): "Red Bull",        # 4
      ("Sergio", "Perez"): "Red Bull",          # 4
      ("Carlos", "Sainz"): "Ferrari",           # 1
      ("Charles", "Leclerc"): "Ferrari",        # 1
      ("Lando", "Norris"): "Mclaren",           # 2
      ("Daniel", "Ricciardo"): "Mclaren",       # 2
      ("Fernando", "Alonso"): "Alpine",         # 10
      ("Pierre", "Gasly"): "Alpha Tauri",       # 7
      ("Yuki", "Tsunoda"): "Alpha Tauri",       # 7
      ("Sebastian", "Vettel"): "Aston Martin",  # 3
      ("Lance", "Stroll"): "Aston Martin",      # 3
      ("Nicholas", "Latifi"): "Williams",       # 9
      ("Alex", "Albon"): "Williams",            # 9
      ("Valtteri", "Bottas"): "Alfa Romeo",     # 8
      ("Mick", "Schumacher"): "Haas",           # 6
      ("Kevin", "Magnussen"): "Haas",           # 6
      ("Guanyu", "Zhou"): "Alfa Romeo",         # 8
  },
}

class Command(BaseCommand):
    help = "Link drivers to teams for a season (creates/updates TeamSeason & DriverSeason)."

    def add_arguments(self, parser):
        parser.add_argument("--season", type=int, required=True, help="Season ID to seed (e.g., 1 or 2)")

    def handle(self, *args, **opts):
        season_id = opts["season"]
        if season_id not in ASSIGNMENTS:
            raise CommandError(f"No ASSIGNMENTS mapping for season {season_id}")

        try:
            season = Season.objects.get(id=season_id)
        except Season.DoesNotExist:
            raise CommandError(f"Season {season_id} not found. Seed seasons first.")

        mapping = ASSIGNMENTS[season_id]

        # 1) Ensure TeamSeason entries
        team_seasons = {}
        for team_name in sorted(set(mapping.values())):
            team = Team.objects.filter(team_name=team_name).first()
            if not team:
                self.stdout.write(self.style.WARNING(f"Team '{team_name}' not found; skipping."))
                continue
            ts, _ = TeamSeason.objects.update_or_create(
                season=season, team=team,
                defaults={"display_name": team.team_name},
            )
            team_seasons[team_name] = ts

        # 2) Link drivers for the season
        created, updated, missing = 0, 0, []
        for (first, last), team_name in mapping.items():
            ts = team_seasons.get(team_name)
            if not ts:
                missing.append(f"{first} {last} (team '{team_name}' missing)")
                continue

            driver = Driver.objects.filter(first_name__iexact=first, last_name__iexact=last).first()
            if not driver:
                missing.append(f"{first} {last}")
                continue

            obj, was_created = DriverSeason.objects.update_or_create(
                season=season, driver=driver,
                defaults={"team_season": ts}
            )
            created += int(was_created)
            updated += int(not was_created)

        msg = f"Season {season_id}: TeamSeason ensured {len(team_seasons)}. DriverSeason created {created}, updated {updated}."
        if missing:
            msg += f" Missing: {', '.join(missing)}."
        self.stdout
