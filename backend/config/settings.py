from pathlib import Path
import os
from dotenv import load_dotenv
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

# Load ../.env for local dev; in production use real env vars
load_dotenv(BASE_DIR.parent / ".env")

# ------------------------------------------------------------------------------
# Core settings
# ------------------------------------------------------------------------------
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-secret-key")
DEBUG = os.getenv("DJANGO_DEBUG", "true").lower() == "true"

# Comma-separated host list for prod (e.g. "api.example.com,service.onrender.com")
_env_hosts = [h.strip() for h in os.getenv("DJANGO_ALLOWED_HOSTS", "").split(",") if h.strip()]
ALLOWED_HOSTS = _env_hosts or ["localhost", "127.0.0.1"]

# If you deploy the frontend (Netlify/Vercel/etc), set this to that origin:
# e.g. FRONTEND_ORIGIN="https://your-site.netlify.app"
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "").rstrip("/")

# ------------------------------------------------------------------------------
# Apps
# ------------------------------------------------------------------------------
INSTALLED_APPS = [
    # CORS first so it can add headers early
    "corsheaders",

    # WhiteNoise helper so runserver doesn't serve static files itself
    "whitenoise.runserver_nostatic",

    # Django core
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Third-party
    "rest_framework",

    # Your apps
    "api",
    "drivers",
    "tracks",
    "seasons",
    "teams",
    "entries",
    "results",
]

# ------------------------------------------------------------------------------
# Middleware
# ------------------------------------------------------------------------------
MIDDLEWARE = [
    # CORS must be very early
    "corsheaders.middleware.CorsMiddleware",

    "django.middleware.security.SecurityMiddleware",

    # WhiteNoise should be right after SecurityMiddleware
    "whitenoise.middleware.WhiteNoiseMiddleware",

    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# ------------------------------------------------------------------------------
# CORS / CSRF
# ------------------------------------------------------------------------------
CORS_ALLOW_CREDENTIALS = True

_local_origins = {
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
}
_cors_set = set(_local_origins)
if FRONTEND_ORIGIN:
    _cors_set.add(FRONTEND_ORIGIN)

CORS_ALLOWED_ORIGINS = sorted(_cors_set)

# CSRF_TRUSTED_ORIGINS must include scheme + domain
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS

# If you're behind a proxy (Render/Railway), trust their HTTPS header
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# In production these should be secure
SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "1" if not DEBUG else "0") == "1"
CSRF_COOKIE_SECURE = os.getenv("CSRF_COOKIE_SECURE", "1" if not DEBUG else "0") == "1"
SECURE_SSL_REDIRECT = os.getenv("DJANGO_SECURE_SSL_REDIRECT", "0").lower() in ("1", "true", "yes")

# ------------------------------------------------------------------------------
# Database
# ------------------------------------------------------------------------------
_db_url = os.getenv("DATABASE_URL")
if _db_url:
    DATABASES = {
        "default": dj_database_url.parse(
            _db_url,
            conn_max_age=600,
            ssl_require=os.getenv("DB_SSL_REQUIRED", "true").lower() in ("1", "true", "yes"),
        )
    }
else:
    # Fallback for local dev if you don't have DATABASE_URL
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

# ------------------------------------------------------------------------------
# Templates
# ------------------------------------------------------------------------------
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

# ------------------------------------------------------------------------------
# ASGI/WSGI
# ------------------------------------------------------------------------------
ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
# If you run with uvicorn/gunicorn-uvicorn-worker, also ensure:
ASGI_APPLICATION = "config.asgi.application"

# ------------------------------------------------------------------------------
# Static files (WhiteNoise)
# ------------------------------------------------------------------------------
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Use WhiteNoise hashed compression storage
STORAGES = {
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    }
}

# Optional: add a small cache-control for static
WHITENOISE_MAX_AGE = int(os.getenv("WHITENOISE_MAX_AGE", "31536000"))  # 1 year
