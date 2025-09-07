from django.db import models

class Track(models.Model):
    name = models.CharField(max_length=120, unique=True)
    city = models.CharField(max_length=80)
    country = models.CharField(max_length=80)
    distance = models.PositiveIntegerField(help_text="Track length in meters")
    layout = models.CharField(max_length=64, blank=True)
    img = models.CharField(max_length=64, blank=True)

    class Meta:
        db_table = "tracks"
        ordering = ["name"]
        indexes = [
            models.Index(fields=["country", "name"]),
        ]

    def __str__(self):
        return self.name