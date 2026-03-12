from django.apps import AppConfig


class ResultsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "results"
    verbose_name = "Results & Races"

    def ready(self):
        from django.db.models.signals import post_save, post_delete
        from results.models import RaceResult
        from results.cache import invalidate_for_result

        def _invalidate(sender, instance, **kwargs):
            try:
                invalidate_for_result(instance)
            except Exception:
                pass  # never crash a save because of cache

        post_save.connect(_invalidate, sender=RaceResult, dispatch_uid="raceresult_cache_invalidate_save")
        post_delete.connect(_invalidate, sender=RaceResult, dispatch_uid="raceresult_cache_invalidate_delete")
