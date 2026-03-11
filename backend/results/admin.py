from django.contrib import admin, messages
from .models import Race, RaceResult


def _generate_articles_action(modeladmin, request, queryset):
    if queryset.count() != 1:
        modeladmin.message_user(request, "Select exactly one race.", level=messages.WARNING)
        return
    race = queryset.first()
    try:
        from articles.generator import generate_articles_for_race
        recap, preview = generate_articles_for_race(race.id)
        msg = f'RECAP created: "{recap.title}"'
        if preview:
            msg += f' | PREVIEW created: "{preview.title}"'
        modeladmin.message_user(request, msg, level=messages.SUCCESS)
    except Exception as e:
        modeladmin.message_user(request, f"Error: {e}", level=messages.ERROR)

_generate_articles_action.short_description = "Generate articles for selected race"


@admin.register(Race)
class RaceAdmin(admin.ModelAdmin):
    list_display = ("season", "round", "track", "is_sprint", "laps")
    list_filter = ("season", "is_sprint", "track")
    search_fields = ("track__track_name",)
    ordering = ("season", "round", "is_sprint")
    actions = [_generate_articles_action]
    fieldsets = (
        (None, {
            "fields": ("season", "track", "round", "is_sprint", "laps", "started_at"),
        }),
        ("Article Notes", {
            "fields": ("race_notes",),
            "description": (
                "Add any race-specific context here before generating articles — "
                "incidents, penalties, long pit stops, controversies, etc."
            ),
        }),
    )

@admin.register(RaceResult)
class RaceResultAdmin(admin.ModelAdmin):
    list_display = (
        "race", "driver_season", "grid_position", "finish_position",
        "status", "fastest_lap", "pole_position", "dotd",
    )
    list_filter = ("race__season", "race__is_sprint", "status", "fastest_lap", "pole_position", "dotd")
    search_fields = (
        "driver_season__driver__first_name",
        "driver_season__driver__last_name",
        "race__track__track_name",
    )
