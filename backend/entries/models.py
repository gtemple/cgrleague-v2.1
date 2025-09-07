from django.db import models

class TeamSeason(models.Model):
    """A team’s entry in a specific season (names/branding can change per season)."""
    season = models.ForeignKey("seasons.Season", on_delete=models.CASCADE, related_name="team_entries")
    team   = models.ForeignKey("teams.Team",     on_delete=models.CASCADE, related_name="season_entries")
    # Optional per-season overrides (display name, livery, sponsor, etc.)
    display_name = models.CharField(max_length=255, blank=True)  # e.g. "Sauber Kick" in 2024

    class Meta:
        db_table = "team_seasons"
        unique_together = [("season", "team")]  # a team appears once per season
        ordering = ["season_id", "team_id"]

    def __str__(self):
        return self.display_name or f"{self.team.team_name} ({self.season_id})"


class DriverSeason(models.Model):
    """A driver’s seat for a specific season (one team per driver per season)."""
    season = models.ForeignKey("seasons.Season", on_delete=models.CASCADE, related_name="driver_entries")
    driver = models.ForeignKey("drivers.Driver", on_delete=models.CASCADE, related_name="season_entries")
    team_season = models.ForeignKey(TeamSeason,  on_delete=models.PROTECT, related_name="driver_seats")
    car_number = models.PositiveSmallIntegerField(null=True, blank=True)
    is_reserve = models.BooleanField(default=False)

    class Meta:
        db_table = "driver_seasons"
        unique_together = [("season", "driver")]  # at most one team per season (Level 1)
        ordering = ["season_id", "driver_id"]

    def __str__(self):
        return f"{self.driver} — {self.team_season}"