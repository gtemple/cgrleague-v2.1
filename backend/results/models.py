from django.db import models
from django.db.models import Q
from .scoring import points_for_result

class Race(models.Model):
    season = models.ForeignKey(
        "seasons.Season",
        on_delete=models.CASCADE,
        related_name="races",
    )
    track = models.ForeignKey(
        "tracks.Track",
        on_delete=models.CASCADE,
        related_name="races",
    )
    round = models.PositiveIntegerField(help_text="Round number in the season")
    is_sprint = models.BooleanField(default=False)
    laps = models.PositiveIntegerField(null=True, blank=True, help_text="Planned race distance (laps)")
    started_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["season_id", "round", "is_sprint"]
        constraints = [
            models.UniqueConstraint(
                fields=["season", "round", "is_sprint"],
                name="uniq_race_per_round",
            )
        ]

    def __str__(self):
        kind = "Sprint" if self.is_sprint else "Grand Prix"
        return f"{self.season} • R{self.round} • {self.track} ({kind})"


STATUS_CHOICES = (
    ("FIN", "Finished"),
    ("DNF", "Did Not Finish"),
    ("DNS", "Did Not Start"),
    ("DSQ", "Disqualified"),
    ("DNQ", "Did Not Qualify"),
)

class RaceResult(models.Model):
    race = models.ForeignKey(
        "results.Race",
        on_delete=models.CASCADE,
        related_name="results",
    )
    # Locks driver→team for that season via entries.DriverSeason
    driver_season = models.ForeignKey(
        "entries.DriverSeason",
        on_delete=models.CASCADE,
        related_name="results",
    )

    # Optional because you don't always have this data yet
    cleanest_driver = models.BooleanField("Cleanest Driver", default=False)
    most_overtakes = models.BooleanField("Most Overtakes", default=False)
    grid_position = models.PositiveIntegerField(null=True, blank=True)
    finish_position = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(max_length=4, choices=STATUS_CHOICES, default="FIN")
    laps_completed = models.PositiveIntegerField(null=True, blank=True)

    time_ms = models.BigIntegerField(null=True, blank=True, help_text="Total classified time in ms")
    gap_ms = models.BigIntegerField(null=True, blank=True, help_text="Gap to winner in ms (if classified)")

    fastest_lap = models.BooleanField(default=False)
    dotd = models.BooleanField("Driver of the Day", default=False)
    pole_position = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["race_id", "finish_position", "driver_season_id"]
        constraints = [
            # one result per driver per race
            models.UniqueConstraint(
                fields=["race", "driver_season"],
                name="uniq_result_per_driver_race",
            ),
            # allow NULL, otherwise must be >= 1
            models.CheckConstraint(
                check=Q(finish_position__gte=1) | Q(finish_position__isnull=True),
                name="finish_pos_ge_1_or_null",
            ),
            models.CheckConstraint(
                check=Q(grid_position__gte=1) | Q(grid_position__isnull=True),
                name="grid_pos_ge_1_or_null",
            ),
            # exactly one of each flag per race (PostgreSQL partial unique indexes)
            models.UniqueConstraint(
                fields=["race"],
                condition=Q(fastest_lap=True),
                name="uniq_fastest_lap_per_race",
            ),
            models.UniqueConstraint(
                fields=["race"],
                condition=Q(dotd=True),
                name="uniq_dotd_per_race",
            ),
            models.UniqueConstraint(
                fields=["race"],
                condition=Q(pole_position=True),
                name="uniq_pole_per_race",
            ),
        ]
    @property
    def points(self) -> int:
      return points_for_result(self)

    def __str__(self):
        drv = getattr(self.driver_season.driver, "last_name", "Driver")
        return f"{self.race} • {drv}"
