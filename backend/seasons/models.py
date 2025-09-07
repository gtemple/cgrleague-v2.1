from django.db import models

class Season(models.Model):

    game = models.CharField(max_length=255)

    class Meta:
        db_table = "seasons"
        ordering = ["id"]

    def __str__(self):
        return f"Season {self.id} — {self.game}"