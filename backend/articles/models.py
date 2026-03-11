from django.db import models


class Article(models.Model):
    RECAP = "RECAP"
    PREVIEW = "PREVIEW"
    TYPE_CHOICES = [
        (RECAP, "Race Recap"),
        (PREVIEW, "Race Preview"),
    ]

    race = models.ForeignKey(
        "results.Race",
        on_delete=models.CASCADE,
        related_name="articles",
    )
    type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    title = models.CharField(max_length=300)
    teaser = models.TextField()
    content = models.TextField()
    rivalry_callout = models.TextField(blank=True, default="")
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-generated_at"]

    def __str__(self):
        return f"[{self.type}] {self.title}"
