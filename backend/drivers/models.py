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
    bio = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "drivers"
        indexes = [
            models.Index(fields=["last_name", "first_name"]),
        ]

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

class DriverRivalry(models.Model):
    """
    AI-written summary of one pairing, shown at the top of the rivalry page.

    One row per pair: driver_a is always the lower id, matching how the rivalry
    endpoint and its cache key sort a pair, so viewing the pairing from either
    direction finds the same row.
    """
    driver_a = models.ForeignKey(
        Driver, on_delete=models.CASCADE, related_name="rivalries_as_a"
    )
    driver_b = models.ForeignKey(
        Driver, on_delete=models.CASCADE, related_name="rivalries_as_b"
    )
    # The one line shown while the panel is collapsed.
    summary = models.TextField()
    content = models.TextField()
    # What the text was written against, so a summary can be spotted as stale
    # once the pair has raced again.
    shared_races = models.PositiveIntegerField()
    generated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "driver_rivalries"
        verbose_name_plural = "driver rivalries"
        constraints = [
            models.UniqueConstraint(
                fields=["driver_a", "driver_b"], name="unique_driver_rivalry"
            ),
            models.CheckConstraint(
                condition=models.Q(driver_a__lt=models.F("driver_b")),
                name="driver_rivalry_canonical_order",
            ),
        ]

    def __str__(self):
        return f"{self.driver_a} v {self.driver_b}"
