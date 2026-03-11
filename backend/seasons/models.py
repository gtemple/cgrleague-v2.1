from django.db import models

class Season(models.Model):

    game = models.CharField(max_length=255)
    season_notes = models.TextField(
        blank=True,
        default="",
        help_text=(
            "Optional notes injected into season article prompts — e.g. major storylines, "
            "rule changes, driver transfers, or anything the AI should know about this season."
        ),
    )

    class Meta:
        db_table = "seasons"
        ordering = ["id"]

    def __str__(self):
        return f"Season {self.id} — {self.game}"