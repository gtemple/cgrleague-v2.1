from django.db import models

class Team(models.Model):
    team_name = models.CharField(max_length=255, unique=True)
    country = models.CharField(max_length=255, null=True, blank=True)
    founded = models.IntegerField(null=True, blank=True)
    team_img = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "teams"
        ordering = ["team_name"]

    def __str__(self):
        return self.team_name