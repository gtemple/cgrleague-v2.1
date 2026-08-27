import uuid

from django.db import models
from django.db.models import Q
from django.utils import timezone


class SubscriberQuerySet(models.QuerySet):
    def active(self):
        """Confirmed and not unsubscribed — the only people an issue is ever sent to."""
        return self.filter(confirmed_at__isnull=False, unsubscribed_at__isnull=True)


class Subscriber(models.Model):
    email = models.EmailField(unique=True)
    # Used for both the confirm and the unsubscribe link; rotating it invalidates
    # any link already sitting in someone's inbox.
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    unsubscribed_at = models.DateTimeField(null=True, blank=True)
    source = models.CharField(max_length=50, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    objects = SubscriberQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.email

    @property
    def is_active(self) -> bool:
        return self.confirmed_at is not None and self.unsubscribed_at is None

    def confirm(self):
        self.unsubscribed_at = None
        if self.confirmed_at is None:
            self.confirmed_at = timezone.now()
        self.save(update_fields=["confirmed_at", "unsubscribed_at"])

    def unsubscribe(self):
        if self.unsubscribed_at is None:
            self.unsubscribed_at = timezone.now()
            self.save(update_fields=["unsubscribed_at"])


class Issue(models.Model):
    """One rendered newsletter send. Doubles as the archive and the idempotency record."""

    RECAP = "RECAP"
    PREVIEW = "PREVIEW"
    KIND_CHOICES = [(RECAP, "Race recap"), (PREVIEW, "Race preview")]

    # A recap goes out after a race; a preview goes out ahead of one. Both hang
    # off the race they are about, so a round can have one of each.
    kind = models.CharField(max_length=10, choices=KIND_CHOICES, default=RECAP)
    race = models.ForeignKey(
        "results.Race",
        on_delete=models.CASCADE,
        related_name="newsletter_issues",
        null=True,
        blank=True,
    )
    subject = models.CharField(max_length=300)
    html = models.TextField()
    text = models.TextField(blank=True, default="")
    recipient_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            # A race can have a draft issue rebuilt any number of times, but only
            # ever one of each kind that actually went out.
            models.UniqueConstraint(
                fields=["race", "kind"],
                condition=Q(sent_at__isnull=False),
                name="uniq_sent_issue_per_race_kind",
            ),
        ]

    def __str__(self):
        state = "sent" if self.sent_at else "draft"
        return f"[{state} {self.kind.lower()}] {self.subject}"
