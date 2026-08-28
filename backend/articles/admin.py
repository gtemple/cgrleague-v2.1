from django.contrib import admin
from .models import Article


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display = ("title", "type", "race", "generated_at")
    list_filter = ("type",)
    search_fields = ("title", "teaser", "content")
    raw_id_fields = ("race",)
    filter_horizontal = ("session_races",)
