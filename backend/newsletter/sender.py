"""Rendering and delivery. Everything that actually puts mail on the wire lives here."""

from typing import Optional, Tuple

from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection
from django.template.loader import render_to_string
from django.utils import timezone

from results.models import Race

from .content import build_race_issue
from .models import Issue, Subscriber


def site_url() -> str:
    return settings.SITE_URL.rstrip("/")


def confirm_url(subscriber: Subscriber) -> str:
    return f"{site_url()}/newsletter/confirm/{subscriber.token}"


def unsubscribe_url(subscriber: Optional[Subscriber]) -> str:
    if subscriber is None:
        return f"{site_url()}/newsletter"
    return f"{site_url()}/newsletter/unsubscribe/{subscriber.token}"


def _message(subject, text, html, to, subscriber=None, connection=None) -> EmailMultiAlternatives:
    headers = {}
    if subscriber is not None:
        # One-click unsubscribe: mail clients surface this instead of users
        # reaching for the spam button, which is what wrecks a sending domain.
        headers["List-Unsubscribe"] = f"<{unsubscribe_url(subscriber)}>"
        headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"

    message = EmailMultiAlternatives(
        subject=subject,
        body=text,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[to],
        reply_to=[settings.NEWSLETTER_REPLY_TO] if settings.NEWSLETTER_REPLY_TO else None,
        headers=headers,
        connection=connection,
    )
    message.attach_alternative(html, "text/html")
    return message


def send_confirmation(subscriber: Subscriber) -> None:
    context = {"confirm_url": confirm_url(subscriber), "site_url": site_url()}
    _message(
        subject="Confirm your CGR League subscription",
        text=render_to_string("newsletter/confirm.txt", context),
        html=render_to_string("newsletter/confirm.html", context),
        to=subscriber.email,
    ).send()


def render_issue(race: Race, subscriber: Optional[Subscriber] = None) -> Tuple[str, str, str]:
    """(subject, text, html) for one race. Pass a subscriber to bake in their unsubscribe link."""
    context = build_race_issue(race)
    context["site_url"] = site_url()
    context["unsubscribe_url"] = unsubscribe_url(subscriber)
    subject = f"CGR League — {context['subject']}"
    return (
        subject,
        render_to_string("newsletter/issue.txt", context),
        render_to_string("newsletter/issue.html", context),
    )


def build_issue(race: Race, resend: bool = False) -> Issue:
    """Create or refresh the draft Issue for a race.

    Only one issue per race may carry a sent_at, so a deliberate resend reuses
    the row that already went out rather than creating a second one.
    """
    subject, text, html = render_issue(race)
    issue = Issue.objects.filter(race=race, sent_at__isnull=True).first()
    if issue is None and resend:
        issue = Issue.objects.filter(race=race, sent_at__isnull=False).order_by("-sent_at").first()
    if issue is None:
        return Issue.objects.create(race=race, subject=subject, text=text, html=html)
    issue.subject, issue.text, issue.html = subject, text, html
    issue.save(update_fields=["subject", "text", "html"])
    return issue


def send_issue(issue: Issue) -> int:
    """Send a draft issue to every active subscriber and mark it sent. Returns the count."""
    recipients = list(Subscriber.objects.active())
    if not recipients:
        return 0

    connection = get_connection()
    connection.open()
    try:
        sent = 0
        for subscriber in recipients:
            # Re-rendered per recipient so each unsubscribe link is their own.
            subject, text, html = render_issue(issue.race, subscriber)
            _message(subject, text, html, subscriber.email, subscriber, connection).send()
            sent += 1
    finally:
        connection.close()

    issue.sent_at = timezone.now()
    issue.recipient_count = sent
    issue.save(update_fields=["sent_at", "recipient_count"])
    return sent


def send_test(race: Race, to: str) -> None:
    subject, text, html = render_issue(race)
    _message(f"[TEST] {subject}", text, html, to).send()
