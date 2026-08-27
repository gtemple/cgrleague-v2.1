from django.core.cache import cache
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .. import sender
from ..models import Subscriber
from .serializers import SubscribeSerializer, TokenSerializer

RATE_LIMIT = 5
RATE_WINDOW = 60 * 60

# Deliberately identical whether or not the address is already on the list —
# the endpoint is public, so it must not confirm who is subscribed.
GENERIC_OK = {"detail": "Check your inbox for a confirmation link."}


def _client_ip(request) -> str:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


def _rate_limited(request) -> bool:
    key = f"newsletter_subscribe:{_client_ip(request)}"
    count = cache.get(key, 0)
    if count >= RATE_LIMIT:
        return True
    cache.set(key, count + 1, RATE_WINDOW)
    return False


class SubscribeView(APIView):
    def post(self, request):
        serializer = SubscribeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if data["website"]:
            return Response(GENERIC_OK)

        if _rate_limited(request):
            return Response(
                {"detail": "Too many attempts. Try again later."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        email = data["email"].strip().lower()
        subscriber, created = Subscriber.objects.get_or_create(
            email=email,
            defaults={"source": data["source"]},
        )

        if subscriber.is_active:
            return Response(GENERIC_OK)

        # Someone re-subscribing after opting out starts over at unconfirmed.
        if subscriber.unsubscribed_at is not None:
            subscriber.confirmed_at = None
            subscriber.unsubscribed_at = None
            subscriber.save(update_fields=["confirmed_at", "unsubscribed_at"])

        sender.send_confirmation(subscriber)
        return Response(GENERIC_OK, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class ConfirmView(APIView):
    def post(self, request):
        serializer = TokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        subscriber = Subscriber.objects.filter(token=serializer.validated_data["token"]).first()
        if subscriber is None:
            return Response(
                {"detail": "That link is no longer valid."},
                status=status.HTTP_404_NOT_FOUND,
            )

        subscriber.confirm()
        return Response({"detail": "You're subscribed.", "email": subscriber.email})


class UnsubscribeView(APIView):
    def post(self, request):
        # Mail clients hitting List-Unsubscribe-Post send the token in the URL
        # rather than a JSON body.
        token = request.data.get("token") or request.query_params.get("token")
        serializer = TokenSerializer(data={"token": token})
        serializer.is_valid(raise_exception=True)

        subscriber = Subscriber.objects.filter(token=serializer.validated_data["token"]).first()
        if subscriber is None:
            return Response(
                {"detail": "That link is no longer valid."},
                status=status.HTTP_404_NOT_FOUND,
            )

        subscriber.unsubscribe()
        return Response({"detail": "You've been unsubscribed.", "email": subscriber.email})
