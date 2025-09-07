from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from django.shortcuts import get_object_or_404

from seasons.models import Season
from .serializers import StandingRowSerializer
from results.query_utils import season_standings_queryset

class SeasonStandingsView(APIView):
    permission_classes = [AllowAny] 

    def get(self, request, season_id: int):
        # Validate season exists (gives 404 if not)
        get_object_or_404(Season, id=season_id)
        qs = season_standings_queryset(season_id)
        data = StandingRowSerializer(qs, many=True).data
        return Response(data)