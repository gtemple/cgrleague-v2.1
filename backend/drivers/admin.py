from django.contrib import admin
from .models import Driver

@admin.register(Driver)
class DriverAdmin(admin.ModelAdmin):
    list_display = ("id", "first_name", "last_name", "initials", "country_of_representation", "human")
    search_fields = ("first_name", "last_name", "initials", "country_of_birth", "country_of_representation")
    list_filter = ("human", "country_of_representation")
