# settings.py

import os
from pathlib import Path
import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR.parent / ".env")

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-secret-key")
DEBUG = os.getenv("DJANGO_DEBUG", "true").lower() == "true"

# --- HOSTS ---
ALLOWED_HOSTS = [
    "localhost",
    "127.0.0.1",
    # Render service hostname for your backend
    "cgrleague-v2-1.onrender.com",
]
# Optionally allow more hosts via env (comma-separated)
EXTRA_ALLOWED = [h.strip() for h in os.getenv("ALLOWED_HOSTS", "").split(",") if h.strip()]
ALLOWED_HOSTS.extend(EXTRA_ALLOWED)

INSTALLED_APPS = [
    "corsheaders",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "api",
    "drivers",
    "tracks",
    "seasons",
    "teams",
    "entries",
    "results",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",          # keep first
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",     # add this just after SecurityMiddleware
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# --- Static files (required for collectstatic on Render) ---
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"               # <- add this

# --- CORS / CSRF ---

# You’re using fetch(..., { credentials: "include" }), so:
#  - DO NOT use wildcard CORS.
#  - You MUST list exact origins (or regexes).
CORS_ALLOW_CREDENTIALS = True

# Read frontend origins from env (comma-separated), with sensible defaults.
# IMPORTANT: include scheme (https://) and no trailing slash.
def _split_csv(name: str) -> list[str]:
    return [v.strip() for v in os.getenv(name, "").split(",") if v.strip()]

FRONTEND_ORIGINS = _split_csv("FRONTEND_ORIGINS")  # e.g. "https://cgr-league.net,https://your-site.netlify.app"

# Local dev defaults
DEV_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

CORS_ALLOWED_ORIGINS = DEV_ORIGINS + FRONTEND_ORIGINS

# If you want to allow all Netlify deploy previews:
# (You cannot wildcard in CORS_ALLOWED_ORIGINS, use regex)
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://.*\.netlify\.app$",
]

# CSRF must use full scheme+host. Include frontend + backend hosts that serve forms/cookies.
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://cgrleague-v2-1.onrender.com",
] + FRONTEND_ORIGINS

# Optional: restrict CORS processing to your API paths
# CORS_URLS_REGEX = r"^/api/.*$"

# --- DB ---
DATABASES = {
    "default": dj_database_url.parse(
        os.getenv("DATABASE_URL"),
        conn_max_age=300,
        ssl_require=os.getenv("DB_SSL_REQUIRED", "false").lower() == "true",
    )
}

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

STATIC_URL = "static/"
