from django.db import models

TRACK_CATEGORIES = [
    ("STREET", "Street Circuit"),
    ("PERMANENT", "Permanent Circuit"),
]

class Track(models.Model):
    name = models.CharField(max_length=120, unique=True)
    city = models.CharField(max_length=80)
    country = models.CharField(max_length=80)
    distance = models.PositiveIntegerField(help_text="Track length in meters")
    layout = models.CharField(max_length=64, blank=True)
    img = models.CharField(max_length=64, blank=True)
    bio = models.TextField(null=True, blank=True)
    category = models.CharField(
        max_length=16,
        choices=TRACK_CATEGORIES,
        blank=True,
        default="",
        help_text="Street or permanent circuit classification",
    )

    class Meta:
        db_table = "tracks"
        ordering = ["name"]
        indexes = [
            models.Index(fields=["country", "name"]),
        ]

    def __str__(self):
        return self.name