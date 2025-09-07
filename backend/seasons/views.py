from django.http import JsonResponse
from .models import Season

def list_seasons(request):
    data = list(Season.objects.values("id", "game"))
    return JsonResponse({"seasons": data})