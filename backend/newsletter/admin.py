from django.contrib import admin

from .models import Issue, Subscriber


@admin.register(Subscriber)
class SubscriberAdmin(admin.ModelAdmin):
    list_display = ("email", "confirmed_at", "unsubscribed_at", "source", "created_at")
    list_filter = ("source",)
    search_fields = ("email",)
    readonly_fields = ("token", "created_at")


@admin.register(Issue)
class IssueAdmin(admin.ModelAdmin):
    list_display = ("subject", "kind", "race", "sent_at", "recipient_count", "created_at")
    list_filter = ("kind", "sent_at")
    readonly_fields = ("html", "text", "created_at")
