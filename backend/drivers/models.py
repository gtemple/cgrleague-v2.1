from django.db import models

class Driver(models.Model):
    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255)
    initials = models.CharField(max_length=255)
    city_of_birth = models.CharField(max_length=255)
    country_of_birth = models.CharField(max_length=255)
    country_of_representation = models.CharField(max_length=255, null=True, blank=True)
    date_of_birth = models.DateField()
    human = models.BooleanField(default=True)
    profile_image = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "drivers"
        indexes = [
            models.Index(fields=["last_name", "first_name"]),
        ]

    def __str__(self):
        return f"{self.first_name} {self.last_name}"