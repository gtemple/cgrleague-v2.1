from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie

@ensure_csrf_cookie  # sets csrftoken so POSTs work later; safe for GET
def ping(request):
    return JsonResponse({"status": "ok"})