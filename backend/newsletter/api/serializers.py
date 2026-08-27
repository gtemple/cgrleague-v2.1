from rest_framework import serializers


class SubscribeSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    source = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    # Honeypot: a real person never sees this field, so anything in it is a bot.
    website = serializers.CharField(required=False, allow_blank=True, default="")


class TokenSerializer(serializers.Serializer):
    token = serializers.UUIDField()
