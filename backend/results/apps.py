from django.apps import AppConfig


class ResultsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "results"
    verbose_name = "Results & Races"

    def ready(self):
        from django.db.models.signals import post_save, post_delete
        from results.models import Race, RaceResult
        from results.cache import invalidate_for_race, invalidate_for_result

        def _invalidate(sender, instance, **kwargs):
            try:
                invalidate_for_result(instance)
            except Exception:
                pass  # never crash a save because of cache

        post_save.connect(_invalidate, sender=RaceResult, dispatch_uid="raceresult_cache_invalidate_save")
        post_delete.connect(_invalidate, sender=RaceResult, dispatch_uid="raceresult_cache_invalidate_delete")

        def _invalidate_race(sender, instance, **kwargs):
            try:
                invalidate_for_race(instance)
            except Exception:
                pass

        post_save.connect(_invalidate_race, sender=Race, dispatch_uid="race_cache_invalidate_save")
        post_delete.connect(_invalidate_race, sender=Race, dispatch_uid="race_cache_invalidate_delete")

        # Seats change the season's standings and the head-to-head grid without
        # any result being touched, so they need their own invalidation.
        from entries.models import DriverSeason
        from results.cache import invalidate_for_seat

        def _invalidate_seat(sender, instance, **kwargs):
            try:
                invalidate_for_seat(instance)
            except Exception:
                pass

        post_save.connect(_invalidate_seat, sender=DriverSeason, dispatch_uid="driverseason_cache_invalidate_save")
        post_delete.connect(_invalidate_seat, sender=DriverSeason, dispatch_uid="driverseason_cache_invalidate_delete")
