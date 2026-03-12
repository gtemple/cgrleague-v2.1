It seems write access to that file requires your approval. Here's the full content of `suggestions.md` — you can paste it directly or approve the write:

---

## What This Project Is

CGR League v2 is a private Formula 1-style racing league statistics platform built for a small group of players. The Django REST backend stores multi-season race results, driver/team entries, and track data, exposing endpoints for standings, constructor tables, season result matrices, and race teasers. The React/TypeScript/Vite frontend renders this data as a read-only stats site — think a personal Ergast/F1 reference for a custom league.

## Potential Next Features or Improvements

- **Result submission UI**: Results are entered via raw SQL seed files. An authenticated admin form (or Django admin with inline `RaceResult` editing per `Race`) would make data entry far less error-prone and remove the SQL dependency.
- **Cache expensive endpoints**: `SeasonResultsMatrixView`, `SeasonStandingsView`, and `ConstructorStandingsView` do heavy DB aggregation on every request. Add per-view caching with invalidation on result save — these are read-heavy and change only when a race is added.
- **Season comparison view for drivers**: Extend `DriverHistoryView` or add a chart-backed page plotting points-per-race across seasons so progression over time is visible.
- **Mid-season standings snapshots**: Add a `?through_round=N` query param to standings endpoints so historical "standings after round X" views are possible without client-side filtering.

## Obvious Gaps or TODOs

- **Zero tests**: Every `tests.py` across `results`, `drivers`, and `entries` is an empty stub. `scoring.py` and the standings aggregation logic are pure enough to unit-test without a database and should be covered first.
- **Insecure secret key fallback**: `SECRET_KEY` defaults to `"dev-secret-key"` in settings. Add a hard startup assertion (`raise ImproperlyConfigured`) when the env var is absent so a misconfigured production deploy fails loudly instead of silently.
- **No API authentication**: All endpoints are publicly readable with no auth layer. There is no DRF token or session auth infrastructure in place, making future write endpoints risky to add safely.
- **`human` flag on `Driver` is undocumented**: The field exists with no comment or migration note explaining what non-human drivers represent. Document or enforce its semantics.
- **`teams` and `seasons` apps have no API layer**: They appear in `INSTALLED_APPS` and the URL conf but only expose bare list views with no serializer depth, making them difficult to extend or consume consistently.



## Inbox Ideas That Might Apply

None of the current inbox ideas are a strong fit.


  Stats & Analytics

  1. Driver vs Driver comparison
  Pick any two drivers, see a side-by-side breakdown — head-to-head wins, avg
  finish, points per race, track records against each other. Good use of existing
  data.


  3. Track records page
  Each track has a page: fastest lap ever, most wins, best average finish per
  driver. Good destination for the flag/track images you already have.

  4. Season comparison
  Compare two seasons side by side — same drivers in both? Who improved? Who
  regressed?

  ---
  Site UX

  9. Global search
  Search box in the nav that covers drivers, tracks, and articles. Could be entirely
   frontend-filtered from existing API data.

  10. Race results page
  Right now results live inside driver pages. A dedicated race results page — select
   season/round, see full grid, positions, gaps, flags — would be a natural anchor
  for article links.

  11. Notification / "new article" badge
  Small dot on the Articles nav link when a new article has been published since the
   user last visited. Pure frontend using localStorage.

  ---
  Content

  12. Driver milestones
  Auto-detect and surface milestones — first win, 10th points finish, pole record.
  Could be surfaced in articles or as a feed on the homepage.
