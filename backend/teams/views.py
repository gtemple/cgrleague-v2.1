from django.http import JsonResponse
from .models import Team

def list_teams(request):
    data = list(Team.objects.values("id","team_name","country","founded","team_img"))
    return JsonResponse({"teams": data})