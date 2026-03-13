from django.contrib import admin
from django.urls import path, include
from api.views import ping
from tracks.views import list_tracks
from seasons.views import list_seasons
from teams.views import list_teams, TeamDetailView, TeamsHomepageView
from api.auth_views import login_view, logout_view
from api.admin_views import SeasonGridView, SeasonRacesAdminView

urlpatterns = [
    path("admin/", admin.site.urls),
    # Auth
    path("api/auth/login/", login_view, name="auth-login"),
    path("api/auth/logout/", logout_view, name="auth-logout"),
    # Admin helpers (protected)
    path("api/admin/seasons/<int:season_id>/grid/", SeasonGridView.as_view(), name="admin-season-grid"),
    path("api/admin/seasons/<int:season_id>/races/", SeasonRacesAdminView.as_view(), name="admin-season-races"),
    # Public
    path("api/seasons/", list_seasons),
    path("api/teams/", list_teams),
    path("api/teams/homepage/", TeamsHomepageView.as_view()),
    path("api/teams/<int:team_id>/", TeamDetailView.as_view()),
    path("api/", include("tracks.api.urls")),
    path("api/", include("results.api.urls")),
    path("api/", include("drivers.api.urls")),
    path("api/", include("articles.api.urls")),
    path("api/", include("seasons.api.urls")),
]
