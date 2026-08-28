"""Rendering and delivery. Everything that actually puts mail on the wire lives here."""

import logging
from typing import Optional, Tuple

from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection
from django.template.loader import render_to_string
from django.utils import timezone

from results.models import Race

from .content import build_preview_issue, build_recap_issue, build_session_issue
from .models import Issue, Subscriber

logger = logging.getLogger(__name__)

# Stands in for the unsubscribe link while an issue is rendered once for the
# whole list, then is swapped for each recipient's own link.
UNSUB_PLACEHOLDER = "__CGR_UNSUBSCRIBE_URL__"

# Everything that differs between the kinds of issue, in one place.
KINDS = {
    Issue.RECAP: {"build": build_recap_issue, "template": "issue"},
    Issue.PREVIEW: {"build": build_preview_issue, "template": "preview"},
    Issue.SESSION: {"build": build_session_issue, "template": "session"},
}


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


def _render(race: Race, kind: str, unsub: str) -> Tuple[str, str, str]:
    spec = KINDS[kind]
    context = spec["build"](race)
    context["site_url"] = site_url()
    context["unsubscribe_url"] = unsub
    template = spec["template"]
    return (
        f"CGR League — {context['subject']}",
        render_to_string(f"newsletter/{template}.txt", context),
        render_to_string(f"newsletter/{template}.html", context),
    )


def render_issue(
    race: Race, kind: str = Issue.RECAP, subscriber: Optional[Subscriber] = None
) -> Tuple[str, str, str]:
    """(subject, text, html) for one race. Pass a subscriber to bake in their unsubscribe link."""
    return _render(race, kind, unsubscribe_url(subscriber))


def build_issue(race: Race, kind: str = Issue.RECAP, resend: bool = False) -> Issue:
    """Create or refresh the draft Issue of one kind for a race.

    Only one issue per race and kind may carry a sent_at, so a deliberate resend
    reuses the row that already went out rather than creating a second one.
    """
    subject, text, html = render_issue(race, kind)
    issue = Issue.objects.filter(race=race, kind=kind, sent_at__isnull=True).first()
    if issue is None and resend:
        issue = (
            Issue.objects
            .filter(race=race, kind=kind, sent_at__isnull=False)
            .order_by("-sent_at")
            .first()
        )
    if issue is None:
        return Issue.objects.create(race=race, kind=kind, subject=subject, text=text, html=html)
    issue.subject, issue.text, issue.html = subject, text, html
    issue.save(update_fields=["subject", "text", "html"])
    return issue


def send_issue(issue: Issue) -> Tuple[int, int]:
    """Send a draft issue to every active subscriber and mark it sent.

    Returns (delivered, failed).
    """
    recipients = list(Subscriber.objects.active())
    if not recipients:
        return 0, 0

    # Every copy is identical bar the unsubscribe link, so the templates — and
    # the standings and podium queries behind them — run once, not per recipient.
    subject, text, html = _render(issue.race, issue.kind, UNSUB_PLACEHOLDER)

    connection = get_connection()
    connection.open()
    sent = failed = 0
    try:
        for subscriber in recipients:
            url = unsubscribe_url(subscriber)
            try:
                _message(
                    subject,
                    text.replace(UNSUB_PLACEHOLDER, url),
                    html.replace(UNSUB_PLACEHOLDER, url),
                    subscriber.email,
                    subscriber,
                    connection,
                ).send()
            except Exception:
                # One rejected address must not cost the rest of the list the
                # issue, nor strand it as unsent and re-mail whoever did get it.
                logger.exception("Newsletter delivery failed for %s", subscriber.email)
                failed += 1
            else:
                sent += 1
    finally:
        connection.close()

    # Nothing got through, so leave it retryable rather than banking a send.
    if sent:
        issue.sent_at = timezone.now()
        issue.recipient_count = sent
        issue.save(update_fields=["sent_at", "recipient_count"])
    return sent, failed


def send_test(race: Race, to: str, kind: str = Issue.RECAP) -> None:
    subject, text, html = render_issue(race, kind)
    _message(f"[TEST] {subject}", text, html, to).send()
