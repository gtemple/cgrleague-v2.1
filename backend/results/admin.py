from django.contrib import admin, messages
from django.http import HttpResponseRedirect
from django.urls import path, reverse
from .models import Race, RaceResult, HistoryTeaserBlurb


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


def _generate_power_rankings_action(modeladmin, request, queryset):
    if queryset.count() != 1:
        modeladmin.message_user(request, "Select exactly one race.", level=messages.WARNING)
        return
    race = queryset.first()
    try:
        from articles.generator import generate_power_rankings
        article = generate_power_rankings(race)
        modeladmin.message_user(
            request,
            f'Power Rankings created: "{article.title}"',
            level=messages.SUCCESS,
        )
    except Exception as e:
        modeladmin.message_user(request, f"Error: {e}", level=messages.ERROR)

_generate_power_rankings_action.short_description = "Generate power rankings for selected race"


def _generate_all_action(modeladmin, request, queryset):
    if queryset.count() != 1:
        modeladmin.message_user(request, "Select exactly one race.", level=messages.WARNING)
        return
    race = queryset.first()
    try:
        from articles.generator import generate_articles_for_race, generate_power_rankings
        recap, preview = generate_articles_for_race(race.id)
        pr = generate_power_rankings(race)
        msg = f'RECAP: "{recap.title}" | POWER RANKINGS: "{pr.title}"'
        if preview:
            msg += f' | PREVIEW: "{preview.title}"'
        modeladmin.message_user(request, msg, level=messages.SUCCESS)
    except Exception as e:
        modeladmin.message_user(request, f"Error: {e}", level=messages.ERROR)

_generate_all_action.short_description = "Generate articles + power rankings for selected race"


@admin.register(Race)
class RaceAdmin(admin.ModelAdmin):
    list_display = ("season", "round", "track", "is_sprint", "laps")
    list_filter = ("season", "is_sprint", "track")
    search_fields = ("track__track_name",)
    ordering = ("season", "round", "is_sprint")
    actions = [_generate_all_action, _generate_articles_action, _generate_power_rankings_action]
    fieldsets = (
        (None, {
            "fields": ("season", "track", "round", "is_sprint", "laps", "started_at"),
        }),
        ("Article Notes", {
            "fields": ("race_notes",),
            "description": (
                "Add any race-specific context here before generating articles — "
                "incidents, penalties, long pit stops, controversies, etc. "
                "Keep notes concise (ideally under 200 words) to avoid bloating the AI prompt."
            ),
        }),
    )

@admin.register(HistoryTeaserBlurb)
class HistoryTeaserBlurbAdmin(admin.ModelAdmin):
    list_display = ("race_label", "blurb_preview", "generated_at")
    readonly_fields = ("race", "generated_at")
    change_list_template = "admin/results/historyteaserblurb/change_list.html"

    def race_label(self, obj):
        return str(obj.race)
    race_label.short_description = "Race"

    def blurb_preview(self, obj):
        return obj.blurb[:120] + "…" if len(obj.blurb) > 120 else obj.blurb
    blurb_preview.short_description = "Blurb"

    def get_urls(self):
        urls = super().get_urls()
        custom = [
            path(
                "generate-today/",
                self.admin_site.admin_view(self.generate_today_view),
                name="results_historyteaserblurb_generate_today",
            ),
        ]
        return custom + urls

    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        extra_context["generate_today_url"] = reverse(
            "admin:results_historyteaserblurb_generate_today"
        )
        return super().changelist_view(request, extra_context=extra_context)

    def generate_today_view(self, request):
        from django.core.cache import cache
        from results.api.views.races import _generate_history_blurb, choose_flashback_race
        from results.api.views.utils import serialize_driver, serialize_team
        from results.scoring import points_for_result
        from results.cache import key_history_teaser

        try:
            # Same selection the frontend teaser uses, so the blurb we generate
            # is for the race actually featured on the homepage.
            chosen = choose_flashback_race()
            if chosen is None:
                self.message_user(request, "No history candidate for today's flashback.", level=messages.WARNING)
                return HttpResponseRedirect("../")

            top3 = list(
                RaceResult.objects
                .filter(race=chosen, finish_position__isnull=False)
                .select_related("driver_season__driver", "driver_season__team_season__team")
                .order_by("finish_position")[:3]
            )

            results_payload = [
                {
                    "finish_position": rr.finish_position,
                    "fastest_lap": rr.fastest_lap,
                    "pole_position": rr.pole_position,
                    "points": points_for_result(rr),
                    "driver": serialize_driver(rr.driver_season.driver),
                    "team": serialize_team(
                        getattr(getattr(rr.driver_season, "team_season", None), "team", None)
                    ),
                }
                for rr in top3
            ]

            result = _generate_history_blurb(
                chosen.season_id, chosen.round, chosen.track.name,
                results_payload, race_notes=chosen.race_notes or "",
            )

            if not result or not result.get("blurb"):
                self.message_user(request, "Claude API call failed — check ANTHROPIC_API_KEY.", level=messages.ERROR)
                return HttpResponseRedirect("../")

            obj, created = HistoryTeaserBlurb.objects.update_or_create(
                race=chosen,
                defaults={
                    "blurb": result["blurb"],
                    "quote": result.get("quote", ""),
                },
            )
            # Bust the cached teaser so the frontend picks up the new content
            cache.delete(key_history_teaser())

            action = "Created" if created else "Updated"
            self.message_user(
                request,
                f'{action} blurb for {chosen}: "{result["blurb"][:80]}…"',
                level=messages.SUCCESS,
            )
        except Exception as e:
            self.message_user(request, f"Error: {e}", level=messages.ERROR)

        return HttpResponseRedirect("../")


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
