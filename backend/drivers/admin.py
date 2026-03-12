from django.contrib import admin, messages
from .models import Driver


def _generate_bio_action(modeladmin, request, queryset):
    if queryset.count() != 1:
        modeladmin.message_user(request, "Select exactly one driver.", level=messages.WARNING)
        return
    driver = queryset.first()
    try:
        from articles.generator import generate_driver_bio
        generate_driver_bio(driver.id)
        modeladmin.message_user(request, f'Bio generated for "{driver}".', level=messages.SUCCESS)
    except Exception as e:
        modeladmin.message_user(request, f"Error: {e}", level=messages.ERROR)

_generate_bio_action.short_description = "Generate bio for selected driver"


@admin.register(Driver)
class DriverAdmin(admin.ModelAdmin):
    list_display = ("id", "first_name", "last_name", "initials", "country_of_representation", "human")
    search_fields = ("first_name", "last_name", "initials", "country_of_birth", "country_of_representation")
    list_filter = ("human", "country_of_representation")
    actions = [_generate_bio_action]
