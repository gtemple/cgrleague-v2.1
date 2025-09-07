from django.contrib import admin
from django.urls import path
from api.views import ping
from tracks.views import list_tracks
from seasons.views import list_seasons
from teams.views import list_teams

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/ping/", ping),
    path("api/tracks/", list_tracks),
    path("api/seasons/", list_seasons),
    path("api/teams/", list_teams),
]
