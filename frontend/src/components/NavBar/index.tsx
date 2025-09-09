import { NavLink } from "react-router-dom";
import "./style.css";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  "nav-link" + (isActive ? " nav-link-active" : "");

export function NavBar() {
  return (
    <header className="navbar">
      <div className="nav-inner">
        <NavLink to="/" className="brand">CGR League</NavLink>
        <nav className="nav-links">
          <NavLink to="/seasons/1" className={linkClass}>Season 1</NavLink>
        </nav>
      </div>
    </header>
  );
}