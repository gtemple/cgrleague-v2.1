import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { displayImage } from "../../utils/displayImage";
import { SearchModal } from "../SearchModal";
import "./style.css";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  "nav-link" + (isActive ? " nav-link-active" : "");

export function NavBar() {
  const [searchOpen, setSearchOpen] = useState(false);

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
          <div className="nav-brand">
            <div className="nav-logo-container">
              <img src={displayImage("cgr-icon", "siteImage")} alt="CGR Logo" />
            </div>
            <NavLink to="/" className="brand">CGR League</NavLink>
          </div>

          <input id="nav-toggle" type="checkbox" className="nav-toggle" aria-hidden="true" />
          <label
            htmlFor="nav-toggle"
            className="nav-burger"
            aria-label="Toggle navigation"
            aria-controls="site-nav"
            aria-expanded="false"
          >
            <span />
            <span />
            <span />
          </label>

          <nav id="site-nav" className="nav-links">
            <NavLink to="/seasons/7" className={linkClass}>Seasons</NavLink>
            <NavLink to="/drivers"   className={linkClass}>Drivers</NavLink>
            <NavLink to="/teams"     className={linkClass}>Teams</NavLink>
            <NavLink to="/tracks"    className={linkClass}>Tracks</NavLink>
            <NavLink to="/hall-of-fame" className={linkClass}>Hall of Fame</NavLink>
            <NavLink to="/articles"  className={linkClass}>Articles</NavLink>
          </nav>

          {/* Search button */}
          <button
            className="nav-search-btn"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
          >
            <span className="nav-search-icon">⌕</span>
            <span className="nav-search-label">Search</span>
            <span className="nav-search-kbd">⌘K</span>
          </button>
        </div>
      </header>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
