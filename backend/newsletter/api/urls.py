from django.urls import path

from .admin_views import NewsletterOverviewView, NewsletterPreviewView, NewsletterSendView
from .views import ConfirmView, SubscribeView, UnsubscribeView

urlpatterns = [
    path("newsletter/subscribe/", SubscribeView.as_view(), name="newsletter-subscribe"),
    path("newsletter/confirm/", ConfirmView.as_view(), name="newsletter-confirm"),
    path("newsletter/unsubscribe/", UnsubscribeView.as_view(), name="newsletter-unsubscribe"),
    # Admin (token-authenticated)
    path("admin/newsletter/", NewsletterOverviewView.as_view(), name="admin-newsletter"),
    path("admin/newsletter/render/", NewsletterPreviewView.as_view(), name="admin-newsletter-render"),
    path("admin/newsletter/send/", NewsletterSendView.as_view(), name="admin-newsletter-send"),
]
