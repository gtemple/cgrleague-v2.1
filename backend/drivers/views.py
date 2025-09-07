from django.http import JsonResponse
from .models import Driver

def list_drivers(request):
    data = list(Driver.objects.values(
        "id","first_name","last_name","initials",
        "city_of_birth","country_of_birth","country_of_representation",
        "date_of_birth","human","profile_image"
    ))
    return JsonResponse({"drivers": data})