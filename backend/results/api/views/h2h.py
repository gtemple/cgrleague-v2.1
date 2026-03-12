from collections import defaultdict

from django.core.cache import cache
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from results.models import RaceResult
from results.cache import CACHE_TTL, key_h2h


class HeadToHeadMatrixView(APIView):
    """
    GET /api/hall-of-fame/h2h/

    Returns a pairwise head-to-head win matrix for all human drivers.
    matrix[a][b] = number of races where driver A finished ahead of driver B
    (both must have been classified with a finish_position in the same race).
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        ck = key_h2h()
        cached = cache.get(ck)
        if cached is not None:
            return Response(cached)

        rows = list(
            RaceResult.objects
            .filter(
                driver_season__driver__human=True,
                finish_position__isnull=False,
            )
            .values(
                "race_id",
                "driver_season__driver_id",
                "finish_position",
                "driver_season__driver__first_name",
                "driver_season__driver__last_name",
                "driver_season__driver__profile_image",
            )
            .order_by("race_id", "finish_position")
        )

        # Build driver info map and per-race participant lists
        driver_info = {}
        by_race = defaultdict(list)  # race_id -> [(driver_id, finish_pos)]

        for row in rows:
            d_id = row["driver_season__driver_id"]
            if d_id not in driver_info:
                driver_info[d_id] = {
                    "id": d_id,
                    "first_name": row["driver_season__driver__first_name"] or "",
                    "last_name": row["driver_season__driver__last_name"] or "",
                    "profile_image": row["driver_season__driver__profile_image"],
                }
            by_race[row["race_id"]].append((d_id, row["finish_position"]))

        # Pairwise comparison per race
        # matrix[winner_id][loser_id] += 1 each time winner finished ahead of loser
        matrix = defaultdict(lambda: defaultdict(int))

        for participants in by_race.values():
            participants.sort(key=lambda x: x[1])
            for i, (winner_id, _) in enumerate(participants):
                for loser_id, _ in participants[i + 1:]:
                    matrix[winner_id][loser_id] += 1

        # Sort drivers: most total h2h wins first, then alphabetically
        driver_ids = sorted(
            driver_info.keys(),
            key=lambda d: (
                -sum(matrix[d].values()),
                (driver_info[d]["last_name"] or "").lower(),
            ),
        )

        # Build serialisable matrix (string keys for JSON)
        matrix_out = {
            str(a): {str(b): matrix[a][b] for b in driver_ids if b != a}
            for a in driver_ids
        }

        payload = {
            "drivers": [driver_info[d] for d in driver_ids],
            "matrix": matrix_out,
        }
        cache.set(ck, payload, timeout=CACHE_TTL)
        return Response(payload)
