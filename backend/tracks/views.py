from django.http import JsonResponse
from .models import Track

def list_tracks(request):
    data = list(Track.objects.values("id", "name", "city", "country", "distance", "layout", "img"))
    return JsonResponse({"tracks": data})