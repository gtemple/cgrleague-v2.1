import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { SearchModal } from "../SearchModal";
import { useLatestSeasonId } from "../../hooks/useLatestSeasonId";
import "./style.css";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  "nav-link" + (isActive ? " nav-link-active" : "");

export function NavBar() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const latestSeasonId = useLatestSeasonId();
  const seasonsHref = latestSeasonId ? `/seasons/${latestSeasonId}` : "/seasons/1";
  const seasonsClass = location.pathname.startsWith("/seasons")
    ? "nav-link nav-link-active"
    : "nav-link";

  useEffect(() => { setNavOpen(false); }, [location]);

  useEffect(() => {
    if (!navOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navOpen]);

  // Cmd+K / Ctrl+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <header className="navbar">
        <div className="nav-inner">
          <NavLink to="/" className="nav-brand">
            <div className="nav-logo-container">CGR</div>
            <span className="brand">CGR LEAGUE</span>
          </NavLink>

          <button
            className={"nav-burger" + (navOpen ? " nav-burger--open" : "")}
            aria-label="Toggle navigation"
            aria-controls="site-nav"
            aria-expanded={navOpen}
            onClick={() => setNavOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>

          <nav id="site-nav" className={"nav-links" + (navOpen ? " nav-links--open" : "")}>
            <NavLink to={seasonsHref} className={() => seasonsClass}>Seasons</NavLink>
            <NavLink to="/drivers"      className={linkClass} end={false}>Drivers</NavLink>
            <NavLink to="/teams"        className={linkClass} end={false}>Teams</NavLink>
            <NavLink to="/tracks"       className={linkClass} end={false}>Tracks</NavLink>
            <NavLink to="/hall-of-fame" className={linkClass}>Hall of Fame</NavLink>
            <NavLink to="/articles"     className={linkClass} end={false}>Articles</NavLink>
          </nav>

          {/* One flex item, so nav-inner's space-between doesn't push a gap
              between the two buttons. */}
          <div className="nav-actions">
            <button
              className="nav-search-btn"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
            >
              <span className="nav-search-icon">⌕</span>
              <span className="nav-search-label">Search</span>
              <span className="nav-search-kbd">⌘K</span>
            </button>

            {/* Sends you to the login form or straight to results entry, so the
                button is never a dead end once you already have a token. */}
            <NavLink
              to={isAuthenticated ? "/admin/results" : "/login"}
              className="nav-admin-btn"
            >
              {isAuthenticated ? "Results" : "Admin"}
            </NavLink>
          </div>
        </div>
      </header>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
