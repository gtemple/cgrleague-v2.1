from django.contrib import admin, messages
from .models import Track


def _generate_bio_action(modeladmin, request, queryset):
    if queryset.count() != 1:
        modeladmin.message_user(request, "Select exactly one track.", level=messages.WARNING)
        return
    track = queryset.first()
    try:
        from articles.generator import generate_track_bio
        generate_track_bio(track.id)
        modeladmin.message_user(request, f'Bio generated for "{track}".', level=messages.SUCCESS)
    except Exception as e:
        modeladmin.message_user(request, f"Error: {e}", level=messages.ERROR)

_generate_bio_action.short_description = "Generate history bio for selected track"


def _generate_all_bios_action(modeladmin, request, queryset):
    from articles.generator import generate_track_bio
    tracks = Track.objects.all()
    success, failed = [], []
    for track in tracks:
        try:
            generate_track_bio(track.id)
            success.append(str(track))
        except Exception as e:
            failed.append(f"{track} ({e})")
    if success:
        modeladmin.message_user(
            request,
            f"Bios generated for {len(success)} track(s): {', '.join(success)}.",
            level=messages.SUCCESS,
        )
    if failed:
        modeladmin.message_user(
            request,
            f"{len(failed)} failed: {', '.join(failed)}",
            level=messages.ERROR,
        )

_generate_all_bios_action.short_description = "Generate history bios for ALL tracks (ignores selection)"


@admin.register(Track)
class TrackAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "city", "country", "distance")
    search_fields = ("name", "city", "country", "layout", "img")
    list_filter = ("country",)
    actions = [_generate_bio_action, _generate_all_bios_action]