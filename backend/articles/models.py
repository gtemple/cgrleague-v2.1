from django.db import models


class Article(models.Model):
    RECAP = "RECAP"
    PREVIEW = "PREVIEW"
    SEASON_RECAP = "SEASON_RECAP"
    SEASON_PREVIEW = "SEASON_PREVIEW"
    POWER_RANKINGS = "POWER_RANKINGS"
    TYPE_CHOICES = [
        (RECAP, "Race Recap"),
        (PREVIEW, "Race Preview"),
        (SEASON_RECAP, "Season Recap"),
        (SEASON_PREVIEW, "Season Preview"),
        (POWER_RANKINGS, "Power Rankings"),
    ]

    race = models.ForeignKey(
        "results.Race",
        on_delete=models.CASCADE,
        related_name="articles",
        null=True,
        blank=True,
    )
    season = models.ForeignKey(
        "seasons.Season",
        on_delete=models.CASCADE,
        related_name="articles",
        null=True,
        blank=True,
    )
    type = models.CharField(max_length=15, choices=TYPE_CHOICES)
    title = models.CharField(max_length=300)
    teaser = models.TextField()
    content = models.TextField(blank=True, default="")
    rivalry_callout = models.TextField(blank=True, default="")
    preview_sidebar = models.JSONField(null=True, blank=True, default=None)
    rankings_data = models.JSONField(null=True, blank=True, default=None)
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-generated_at"]

    def __str__(self):
        return f"[{self.type}] {self.title}"
