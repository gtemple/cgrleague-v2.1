from django.db import transaction
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from results.cache import invalidate_for_result
from results.models import Race, RaceResult

VALID_STATUSES = {"FIN", "DNF", "DNS", "DSQ", "DNQ"}


class BulkUpsertResultsView(APIView):
    """
    POST /api/admin/races/<race_id>/results/

    Replaces all results for a race in one atomic transaction.
    Body:
    {
        "results": [
            {
                "driver_season_id": 42,
                "finish_position": 1,          // null for DNS/DSQ/DNQ
                "grid_position": 3,            // null if unknown
                "status": "FIN",
                "laps_completed": 58,          // null if unknown
                "fastest_lap": false,
                "pole_position": true,
                "dotd": false,
                "cleanest_driver": false,
                "most_overtakes": false
            },
            ...
        ]
    }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, race_id: int):
        try:
            race = Race.objects.get(pk=race_id)
        except Race.DoesNotExist:
            return Response({"detail": "Race not found."}, status=404)

        results_data = request.data.get("results")
        if not isinstance(results_data, list):
            return Response({"detail": "'results' must be a list."}, status=400)

        errors = []
        to_create = []

        for i, row in enumerate(results_data):
            ds_id = row.get("driver_season_id")
            if not ds_id:
                errors.append(f"Row {i}: missing driver_season_id")
                continue

            status = row.get("status", "FIN")
            if status not in VALID_STATUSES:
                errors.append(f"Row {i}: invalid status '{status}'")
                continue

            finish_pos = row.get("finish_position")
            # DNS / DNQ drivers typically have no finish position
            if status in ("DNS", "DNQ"):
                finish_pos = None

            to_create.append(
                RaceResult(
                    race=race,
                    driver_season_id=ds_id,
                    finish_position=finish_pos,
                    grid_position=row.get("grid_position"),
                    status=status,
                    laps_completed=row.get("laps_completed"),
                    fastest_lap=bool(row.get("fastest_lap", False)),
                    pole_position=bool(row.get("pole_position", False)),
                    dotd=bool(row.get("dotd", False)),
                    cleanest_driver=bool(row.get("cleanest_driver", False)),
                    most_overtakes=bool(row.get("most_overtakes", False)),
                )
            )

        if errors:
            return Response({"detail": "Validation errors.", "errors": errors}, status=400)

        with transaction.atomic():
            RaceResult.objects.filter(race=race).delete()
            RaceResult.objects.bulk_create(to_create)

        # bulk_create fires no post_save, and the delete above fires no
        # post_delete when the race had no results yet, so invalidate directly.
        for rr in to_create:
            invalidate_for_result(rr)

        return Response({"created": len(to_create)}, status=201)
