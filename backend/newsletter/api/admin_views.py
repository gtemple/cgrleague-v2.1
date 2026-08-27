"""Admin-only endpoints behind the newsletter section of the frontend admin page."""

from django.db.models import Count
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from articles.models import Article
from results.models import Race

from .. import sender
from ..models import Issue, Subscriber

KINDS = {Issue.RECAP: Article.RECAP, Issue.PREVIEW: Article.PREVIEW}


def _resolve(request, data) -> tuple:
    """(race, kind) from a request, or (None, error Response)."""
    kind = (data.get("kind") or Issue.RECAP).upper()
    if kind not in KINDS:
        return None, Response({"detail": "kind must be RECAP or PREVIEW."}, status=status.HTTP_400_BAD_REQUEST)

    race_id = data.get("race_id") or data.get("race")
    race = Race.objects.select_related("season", "track").filter(pk=race_id).first()
    if race is None:
        return None, Response({"detail": "No such race."}, status=status.HTTP_404_NOT_FOUND)

    return (race, kind), None


class NewsletterOverviewView(APIView):
    """
    GET /api/admin/newsletter/?season=<id>
    Every race in the season with, per kind, whether the article that carries the
    issue exists and whether it has already gone out.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        season_id = request.query_params.get("season")
        races = (
            Race.objects
            .filter(season_id=season_id)
            .select_related("track")
            .annotate(result_count=Count("results", distinct=True))
            .order_by("round", "is_sprint")
        )

        article_kinds = {
            (race_id, a_type)
            for race_id, a_type in Article.objects
            .filter(race__season_id=season_id, type__in=KINDS.values())
            .values_list("race_id", "type")
        }
        sent = {
            (i.race_id, i.kind): i
            for i in Issue.objects.filter(race__season_id=season_id, sent_at__isnull=False)
        }

        def state(race, kind):
            issue = sent.get((race.id, kind))
            return {
                "has_article": (race.id, KINDS[kind]) in article_kinds,
                "sent_at": issue.sent_at if issue else None,
                "recipient_count": issue.recipient_count if issue else 0,
            }

        return Response({
            "subscriber_count": Subscriber.objects.active().count(),
            "races": [
                {
                    "id": r.id,
                    "round": r.round,
                    "is_sprint": r.is_sprint,
                    "result_count": r.result_count,
                    "track": {"id": r.track_id, "name": r.track.name},
                    "recap": state(r, Issue.RECAP),
                    "preview": state(r, Issue.PREVIEW),
                }
                for r in races
            ],
        })


class NewsletterPreviewView(APIView):
    """
    GET /api/admin/newsletter/render/?race=<id>&kind=<RECAP|PREVIEW>
    The issue exactly as it would be mailed, for reading before sending.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        resolved, error = _resolve(request, request.query_params)
        if error:
            return error
        race, kind = resolved

        subject, text, html = sender.render_issue(race, kind)
        return Response({"subject": subject, "html": html, "text": text})


class NewsletterSendView(APIView):
    """
    POST /api/admin/newsletter/send/
    {race_id, kind, test_to?, force?}

    With test_to, one copy goes to that address only and nothing is recorded.
    Without it, the issue goes to every confirmed subscriber and is marked sent.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        resolved, error = _resolve(request, request.data)
        if error:
            return error
        race, kind = resolved

        test_to = (request.data.get("test_to") or "").strip()
        if test_to:
            sender.send_test(race, test_to, kind)
            return Response({"test": True, "sent": 1, "detail": f"Test copy sent to {test_to}."})

        force = bool(request.data.get("force"))
        already = Issue.objects.filter(race=race, kind=kind, sent_at__isnull=False).first()
        if already and not force:
            return Response(
                {
                    "detail": (
                        f"Already sent on {already.sent_at:%Y-%m-%d %H:%M} to "
                        f"{already.recipient_count} subscriber(s)."
                    ),
                    "already_sent": True,
                },
                status=status.HTTP_409_CONFLICT,
            )

        if not Subscriber.objects.active().count():
            return Response(
                {"detail": "No confirmed subscribers — nothing to send."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        issue = sender.build_issue(race, kind, resend=force)
        count = sender.send_issue(issue)
        return Response({
            "test": False,
            "sent": count,
            "subject": issue.subject,
            "sent_at": issue.sent_at,
            "detail": f"Sent to {count} subscriber(s).",
        })
