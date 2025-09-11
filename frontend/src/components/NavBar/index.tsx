import { NavLink } from "react-router-dom";
import { displayImage } from "../../utils/displayImage";
import "./style.css";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  "nav-link" + (isActive ? " nav-link-active" : "");

export function NavBar() {
  return (
    <header className="navbar">
      <div className="nav-inner">
        <div className="nav-brand">
          <div className="nav-logo-container">
            <img src={displayImage("cgr-icon", "siteImage")} alt="CGR Logo" />
          </div>
          <NavLink to="/" className="brand">CGR League</NavLink>
        </div>

        {/* NEW: mobile toggle */}
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
          <NavLink to="/drivers/1" className={linkClass}>Drivers</NavLink>
          <NavLink to="/tracks/1" className={linkClass}>Tracks</NavLink>
        </nav>

        <div />
      </div>
    </header>
  );
}
