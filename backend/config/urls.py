from django.contrib import admin
from django.urls import path
from api.views import ping
from drivers.views import list_drivers

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/ping/", ping),
    path("api/drivers/", list_drivers),
]