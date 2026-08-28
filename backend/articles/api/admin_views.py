"""Admin-only endpoints behind the session-report section of the frontend admin page."""

from django.db.models import Count
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from results.models import Race

from ..generator import SESSION_MAX_RACES, SESSION_MIN_RACES, generate_session_article
from ..models import Article


class SessionRacesView(APIView):
    """
    GET /api/admin/sessions/?season=<id>

    Every race in the season with its admin notes and whether it is already
    covered by a session article, so the panel can pick a day's worth of races
    and edit the notes that feed the prompt in one place.
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

        covered = {}
        for article in Article.objects.filter(
            type=Article.SESSION, session_races__season_id=season_id
        ).prefetch_related("session_races").distinct():
            for race in article.session_races.all():
                covered[race.id] = {"article_id": article.id, "title": article.title}

        return Response([
            {
                "id": r.id,
                "round": r.round,
                "is_sprint": r.is_sprint,
                "result_count": r.result_count,
                "race_notes": r.race_notes,
                "track": {"id": r.track_id, "name": r.track.name},
                "session_article": covered.get(r.id),
            }
            for r in races
        ])


class SessionGenerateView(APIView):
    """
    POST /api/admin/sessions/generate/

    Body: {"race_ids": [12, 13, 14], "notes": {"12": "...", "13": "..."}}

    Saves each race's notes first, so what the admin just typed is what the
    prompt sees, then generates the article. Runs inline — generation takes a
    couple of minutes with reasoning on.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        race_ids = request.data.get("race_ids")
        if not isinstance(race_ids, list) or not all(isinstance(i, int) for i in race_ids):
            return Response(
                {"detail": "'race_ids' must be a list of race IDs."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not SESSION_MIN_RACES <= len(race_ids) <= SESSION_MAX_RACES:
            return Response(
                {"detail": f"Select between {SESSION_MIN_RACES} and {SESSION_MAX_RACES} races."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        notes = request.data.get("notes") or {}
        if not isinstance(notes, dict):
            return Response({"detail": "'notes' must be an object."}, status=status.HTTP_400_BAD_REQUEST)
        for race in Race.objects.filter(id__in=race_ids):
            text = notes.get(str(race.id), notes.get(race.id))
            if text is not None and text.strip() != race.race_notes.strip():
                race.race_notes = text.strip()
                race.save(update_fields=["race_notes"])

        try:
            article = generate_session_article(race_ids)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {"article_id": article.id, "title": article.title, "teaser": article.teaser},
            status=status.HTTP_201_CREATED,
        )
