import { NavLink } from "react-router-dom";
import { useAdmin } from "./adminContext";
import { NewsletterPanel } from "./NewsletterPanel";
import { SessionPanel } from "./SessionPanel";

function PublishingNav() {
  return (
    <nav className="adm-local-nav" aria-label="Publishing tools">
      <NavLink
        to="/admin/publishing/newsletters"
        className={({ isActive }) => `adm-local-link${isActive ? " is-active" : ""}`}
      >
        Newsletters
      </NavLink>
      <NavLink
        to="/admin/publishing/sessions"
        className={({ isActive }) => `adm-local-link${isActive ? " is-active" : ""}`}
      >
        Session reports
      </NavLink>
    </nav>
  );
}

export function NewslettersAdminPage() {
  const { token, seasonId } = useAdmin();
  if (seasonId == null) return null;
  return <><PublishingNav /><NewsletterPanel token={token} seasonId={seasonId} /></>;
}

export function SessionsAdminPage() {
  const { token, seasonId } = useAdmin();
  if (seasonId == null) return null;
  return <><PublishingNav /><SessionPanel token={token} seasonId={seasonId} /></>;
}
