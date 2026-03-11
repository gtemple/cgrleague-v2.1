from django.urls import path
from .views import championship_timeline

urlpatterns = [
    path("seasons/<int:season_id>/timeline/", championship_timeline, name="championship-timeline"),
]
