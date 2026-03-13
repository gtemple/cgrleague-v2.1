from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    username = request.data.get("username", "").strip()
    password = request.data.get("password", "")
    if not username or not password:
        return Response({"detail": "Username and password required."}, status=400)
    user = authenticate(request, username=username, password=password)
    if user is None:
        return Response({"detail": "Invalid credentials."}, status=401)
    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key, "username": user.username})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    try:
        request.user.auth_token.delete()
    except Exception:
        pass
    return Response({"detail": "Logged out."})
