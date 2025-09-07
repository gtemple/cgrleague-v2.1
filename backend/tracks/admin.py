from django.contrib import admin
from .models import Track

@admin.register(Track)
class TrackAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "city", "country", "distance")
    search_fields = ("name", "city", "country", "layout", "img")
    list_filter = ("country",)