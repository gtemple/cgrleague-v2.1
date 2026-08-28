import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { adminApi, type SeasonInfo } from "../../api/admin";
import { ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import type { AdminContextValue } from "./adminContext";
import "./style.css";

const NAV_ITEMS = [
  { to: "/admin", label: "Overview", end: true },
  { to: "/admin/races", label: "Races", end: false },
  { to: "/admin/publishing", label: "Publishing", end: false },
  { to: "/admin/season", label: "Season", end: false },
];

function titleFor(pathname: string): string {
  if (pathname.startsWith("/admin/races")) return "Race control";
  if (pathname.startsWith("/admin/publishing/sessions")) return "Session reports";
  if (pathname.startsWith("/admin/publishing")) return "Newsletters";
  if (pathname.startsWith("/admin/season")) return "Season grid";
  return "Operations overview";
}

function loadErrorText(err: unknown): string {
  if (err instanceof ApiError && err.status === 401) return "Your session has expired — log out and back in.";
  return "The season list could not be loaded.";
}

export function AdminLayout() {
  const { token, username, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [seasons, setSeasons] = useState<SeasonInfo[]>([]);
  const [seasonId, setSeasonIdState] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    adminApi.getSeasons(token)
      .then((list) => {
        setSeasons(list);
        setLoadError(null);
        const remembered = Number(sessionStorage.getItem("cgrleague_admin_season"));
        const rememberedSeason = list.find((season) => season.id === remembered);
        const liveSeason = list.find((season) => season.races_entered < season.race_count);
        setSeasonIdState((rememberedSeason ?? liveSeason ?? list[0])?.id ?? null);
      })
      .catch((err) => setLoadError(loadErrorText(err)));
  }, [token]);

  const setSeasonId = (nextSeasonId: number) => {
    setSeasonIdState(nextSeasonId);
    sessionStorage.setItem("cgrleague_admin_season", String(nextSeasonId));
  };

  const season = seasons.find((item) => item.id === seasonId) ?? null;
  const context = useMemo<AdminContextValue | null>(() => {
    if (!token) return null;
    return { token, seasonId, seasons, season, setSeasonId };
  }, [token, seasonId, seasons, season]);

  return (
    <div className="adm-page">
      <header className="adm-band">
        <div className="adm-band-inner">
          <div>
            <span className="adm-eyebrow">CGR League · Admin</span>
            <h1 className="adm-title">{titleFor(location.pathname)}</h1>
          </div>

          <div className="adm-user">
            <label className="adm-season-wrap">
              <span className="adm-season-label">Season</span>
              <select
                className="adm-season"
                value={seasonId ?? ""}
                onChange={(event) => setSeasonId(Number(event.target.value))}
                aria-label="Admin season"
              >
                {seasons.map((item) => (
                  <option key={item.id} value={item.id}>
                    S{item.id} · {item.game} · {item.races_entered}/{item.race_count}
                  </option>
                ))}
              </select>
            </label>
            <span className="adm-username">{username}</span>
            <button className="adm-logout" onClick={() => logout().then(() => navigate("/login"))}>
              Log out
            </button>
          </div>
        </div>
      </header>

      <nav className="adm-nav" aria-label="Admin sections">
        <div className="adm-nav-inner">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `adm-nav-link${isActive ? " is-active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <main className="adm-inner">
        {loadError && <div className="adm-panel adm-alert">{loadError}</div>}
        {!loadError && seasons.length === 0 && <p className="adm-loading">Loading admin…</p>}
        {context && seasonId != null && <Outlet context={context} />}
      </main>
    </div>
  );
}
