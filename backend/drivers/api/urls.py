from django.urls import path
from .views import DriversListView, DriverDetailView

urlpatterns = [
    path("drivers/", DriversListView.as_view(), name="drivers-list"),
    path("drivers/<int:driver_id>/", DriverDetailView.as_view(), name="driver-detail"),
]