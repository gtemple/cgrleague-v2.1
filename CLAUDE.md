# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

CGR League is a private F1-style racing league stats platform (see `PRODUCT.md` for product intent). Three pieces:

- `backend/` — Django + DRF API (Python 3.12), serves JSON under `/api/`. Deployed on Render.
- `frontend/` — React 19 + TypeScript + Vite SPA. Deployed on Netlify.
- `bot/` — standalone Discord bot (discord.py) that reads the public API and posts standings/results/articles to a guild.

The three run independently; the frontend and bot are pure API clients of the backend.

## Commands

Backend (run from `backend/`, `.venv` lives at repo root):
```
python manage.py runserver 0.0.0.0:8002   # dev server (port 8002)
python manage.py migrate
python manage.py makemigrations
python manage.py shell
```

Frontend (run from `frontend/`):
```
npm run dev       # Vite dev server on 5173, proxies /api to VITE_API_TARGET (default http://localhost:8002)
npm run build     # tsc -b && vite build
npm run lint      # eslint (also runs inline via vite-plugin-eslint during dev)
```

Full stack via Docker: `docker-compose up` (backend 8002, frontend 5173).

There is no automated test suite.

## Backend architecture

Django apps are split by domain, each with its own `models.py` and (for public data) an `api/` subpackage of `urls.py` + `views.py` + `serializers.py`. All routes are wired in `config/urls.py` under `/api/`.

Core data model and relationships:
- `seasons.Season` — a league season, tied to a `game`. Has optional `season_notes` injected into AI prompts.
- `drivers.Driver`, `teams.Team`, `tracks.Track` — season-independent entities.
- `entries.TeamSeason` — a team's entry in one season (per-season `display_name`, `color`). `entries.DriverSeason` — a driver's seat in one season, linking driver → `TeamSeason`. **Driver→team is locked per season through `DriverSeason`, not directly.**
- `results.Race` — one race (GP or sprint) in a season at a track, unique per `(season, round, is_sprint)`.
- `results.RaceResult` — one driver's result in a race, FK'd to `DriverSeason` (so the team is implied by the season seat). Postgres partial unique constraints enforce exactly one fastest_lap / dotd / pole per race.
- `articles.Article` — AI-generated content (recaps, previews, season articles, power rankings), FK'd to a race and/or season.

Points are **computed, not stored**: `RaceResult.points` is a property delegating to `results/scoring.py` (`points_for_result`). For DB-level aggregation, equivalent SQL `Case` expressions live in `results/api/views/utils.py` (`points_case`, `fl_bonus_case`) — keep these in sync with `scoring.py` if scoring rules change.

`results/api/views/` is a package, one module per heavy read endpoint: `standings.py`, `matrices.py`, `h2h.py`, `hall_of_fame.py`, `races.py`, plus `admin.py`.

### Data caveats (stat tracking is uneven across seasons)

`RaceResult` has many optional flags, but they were **not all tracked from the start** — verify coverage before building any career-spanning metric on them:

- **Poles** (`pole_position`): only from **Season 3** onwards (S1–S2 have none). Rate metrics must use pole-tracked seasons as the denominator, not all races. Derive the tracked-season set from the data (seasons with ≥1 pole) rather than hardcoding.
- **Cleanest driver** (`cleanest_driver`) and **Most overtakes** (`most_overtakes`): only recorded in **Season 7**. Effectively unusable for career/all-time stats.
- **Grid position** (`grid_position`): only recorded in **Season 7**, so anything derived from it (`avg_positions_gained` = grid − finish, pole-to-win) is S7-only despite reading like a career stat.
- **DNFs are near-zero league-wide** (median 0%, max ~5%): DNF = crash, not mechanical failure. A raw "reliability = non-DNF rate" metric does **not** differentiate drivers — everyone scores ~95–100.
- Reliably tracked every season: finish position, points, wins, podiums, fastest laps (`fastest_lap`), DOTD (`dotd`), status/DNF. `dotd` is "most exciting drive," so it *anti*-correlates with dominance (comeback artists score high, drivers who win from pole score low).
- Most `Race` rows have **no `started_at`** (only ~3 of 125), so a real countdown is usually impossible — UIs must handle a null date.
- `entries.TeamSeason.color` is populated for all teams via the `set_team_colors` management command (real-world livery hex); it is not part of the seed data.

**Driver DNA** (`drivers/dna.py`, shown on the driver page) is a computed 5-trait profile built only from the reliably-tracked stats above, each trait **percentile-ranked against the established grid** (drivers with ≥10 races) so it spreads 0–100 and is robust to the gaps. It's a population-wide computation cached under one key (`key_driver_dna`, invalidated on any result change) and attached to the driver-detail response *outside* the per-driver cached blob so it stays fresh. See the module docstring for trait definitions.

### Caching (important)

Expensive read endpoints cache their full response in Django's `LocMemCache` (24h TTL). Cache keys and the invalidation list live in `results/cache.py`. `invalidate_for_result()` deletes every dependent key and is fired by `post_save`/`post_delete` signals on `RaceResult` (wired in `results/apps.py`). When you add a cached endpoint, add its key builder AND add the key to `invalidate_for_result`, or it will serve stale data. Note LocMemCache is per-process — multiple workers each hold their own cache.

### AI article generation

`articles/generator.py` is the entry point (`generate_articles_for_race`, plus season/bio variants). Shared league facts (driver relationships, banned words, DNF-tracking caveat) live in `LEAGUE_CONTEXT` / `SYSTEM_PROMPT` constants — edit those rather than duplicating rules per prompt. Triggered via management commands in `articles/management/commands/` (`generate_articles`, `generate_season_articles`, `generate_track_bio`, `generate_driver_bio`), not automatically on race save.

**Providers.** Every model call in the app goes through `articles/llm.py` (`generate_json`); `generator.py` reaches it via `_call_model` and never imports a vendor SDK. Two backends, chosen by `ARTICLE_LLM_PROVIDER` (default `anthropic`) or a `--provider` flag on any of the four commands:

- `anthropic` — `claude-opus-4-8` with adaptive thinking, needs `ANTHROPIC_API_KEY`.
- `deepseek` — `deepseek-v4-pro` via the OpenAI SDK against `https://api.deepseek.com`, needs `DEEPSEEK_API_KEY`. Roughly an order of magnitude cheaper on output tokens.

Override either model with `ANTHROPIC_MODEL` / `DEEPSEEK_MODEL`.

The two providers are **not** equivalent on output guarantees, which is why the DeepSeek path is longer. Anthropic enforces the JSON schema server-side via `output_config`, so a parsed response always matches. DeepSeek only offers `json_object` mode, which guarantees valid JSON but not schema conformance, so that path injects the schema into the system prompt, validates the parsed result against it (`_validate`), and retries once — DeepSeek documents that the mode can intermittently return empty content. A response that fails validation twice raises rather than silently producing an article with missing fields. If you add a new schema, it needs nothing extra; `_validate` walks `required`, nested objects, and arrays already.

Seed/import data commands live across apps: `seed_*` in each app, plus `results/management/commands/import_legacy_results.py` and `set_track_laps.py`.

### Auth

DRF `TokenAuthentication`, default permission `AllowAny`. Login/logout in `api/auth_views.py`. Admin-only write endpoints under `/api/admin/...` (e.g. `SeasonGridView`, `SeasonRacesAdminView`). The frontend admin route is gated client-side by `ProtectedRoute`.

## Frontend architecture

Vanilla React Router 7 SPA, no Redux/React Query. Data fetching is a custom hook layer:
- `src/api/client.ts` — `fetchJson` + `ApiError`, resolves API base from `VITE_BACKEND_URL_DEV` (dev) / `VITE_BACKEND_URL` (prod), falling back to same-origin (dev proxy).
- `src/hooks/useApiQuery.ts` — generic query hook (loading/error/refetch, optional `transform`, `keepPreviousData`). Almost every `use*` hook in `src/hooks/` wraps this for one endpoint. Add a new hook per endpoint rather than calling `fetchJson` from components.
- `src/lib/api.ts` (`apiGet` with `credentials: 'include'`) + `src/lib/csrf.ts` are the cookie/session path used for authenticated admin calls; `src/api/admin.ts` uses these.

Routes are declared in `src/App.tsx`. Pages live in `src/pages/<PageName>/`, reusable widgets in `src/components/<Name>/`. Styling is plain CSS, **not** CSS Modules — each component/page folder has its own `style.css` imported directly. (Recent history is heavy CSS refactoring; match the existing per-component `style.css` convention.)

### Design tokens (read before writing any CSS)

**`src/styles/cgr-tokens.css` is the live design system.** Every page uses the `--cgr-*` tokens; see `DESIGN.md` for the full language. The shape of a page:

- Page shell is **light**: `background: var(--cgr-paper)`, `color: var(--cgr-text-primary)`, `font-family: var(--cgr-font-body)`.
- Headers are a **dark ink band** (`var(--cgr-ink)`) with a mono eyebrow and a condensed uppercase `--cgr-font-display` title. Text on ink uses the `--cgr-text-on-dark*` tokens.
- Content sits in white panels: `var(--cgr-card)` + `1px solid var(--cgr-border-card)` + `var(--cgr-radius-card)`.
- Numeric/label text is `--cgr-font-mono`, usually 10–11px with wide letter-spacing.

The `:root` block in `index.css` (`--bg`, `--surface`, `--text-bright`, `--accent`) is **legacy** and only still applies to pages that predate the redesign. Don't build new UI on it — a page styled with those tokens renders dark-on-dark against the current light surfaces.

## Environment / secrets

Backend reads repo-root `.env` (loaded in `config/settings.py`): `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DATABASE_URL` (Neon Postgres in prod; SQLite `db.sqlite3` for local testing — toggle commented block in `.env`), `DB_SSL_REQUIRED`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, and the optional `ARTICLE_LLM_PROVIDER` / `ANTHROPIC_MODEL` / `DEEPSEEK_MODEL` overrides. CORS/CSRF origins are read from `FRONTEND_ORIGINS` (comma-separated) plus Netlify/`cgr-league.net` regexes. The bot reads its own env: `DISCORD_TOKEN`, `DISCORD_GUILD_ID`, `API_BASE_URL`, `SITE_URL`, `CURRENT_SEASON`.
