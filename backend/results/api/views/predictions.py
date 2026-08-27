from django.core.cache import cache
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from results.cache import CACHE_TTL, key_race_prediction
from results.models import Race
from results.predictions import calculate_race_prediction


class RacePredictionView(APIView):
    """Probability forecast using only information preceding the target race."""

    permission_classes = [AllowAny]

    def get(self, request, season_id: int, round: int, *args, **kwargs):
        is_sprint = str(request.GET.get("is_sprint", "")).lower() in ("1", "true", "yes")
        race = (
            Race.objects.select_related("track", "season")
            .filter(season_id=season_id, round=round, is_sprint=is_sprint)
            .first()
        )
        if race is None:
            race = (
                Race.objects.select_related("track", "season")
                .filter(season_id=season_id, round=round)
                .first()
            )
        if race is None:
            return Response({"detail": "Race not found."}, status=404)

        cache_key = key_race_prediction(race.id)
        payload = cache.get(cache_key)
        if payload is None:
            payload = calculate_race_prediction(race)
            cache.set(cache_key, payload, timeout=CACHE_TTL)
        return Response(payload)
