import { useState } from "react";
import { Link } from "react-router-dom";
import { useDriversHomepage } from "../../hooks/useDriversHomepage";
import type { HumanSpotlightEntry, AllDriverEntry } from "../../hooks/useDriversHomepage";
import { displayImage } from "../../utils/displayImage";
import { Loader } from "../../components/Loader";
import "./DriversIndex.css";

// ─── helpers ──────────────────────────────────────────────────────────────────

function posBadgeClass(pos: number) {
  if (pos === 1) return "dix-pos dix-pos--1";
  if (pos === 2) return "dix-pos dix-pos--2";
  if (pos === 3) return "dix-pos dix-pos--3";
  return "dix-pos";
}

// ─── Standings row ────────────────────────────────────────────────────────────

function StandingsRow({ entry }: { entry: HumanSpotlightEntry }) {
  const { driver, position, points, wins, team, last_finish } = entry;
  const avatarUrl = driver.profile_image ? displayImage(driver.profile_image, "driver") : null;
  const flagUrl = driver.country_of_representation
    ? displayImage(driver.country_of_representation, "flags")
    : null;
  const logoUrl = team?.logo_image ? displayImage(team.logo_image, "team") : null;
  const accentColor = team?.color || null;

  return (
    <Link
      to={`/drivers/${driver.id}`}
      className={`dix-row${position === 1 ? " dix-row--first" : ""}`}
      style={position === 1 && accentColor ? { "--row-accent": accentColor } as React.CSSProperties : undefined}
    >
      <div className="dix-row-left">
        <span className={posBadgeClass(position)}>P{position}</span>
        <div className="dix-row-avatar">
          {avatarUrl
            ? <img loading="lazy" src={avatarUrl} alt={driver.display_name} />
            : <div className="dix-row-avatar-placeholder" />
          }
        </div>
        <div className="dix-row-identity">
          <div className="dix-row-name">
            {flagUrl && <img loading="lazy" className="dix-flag" src={flagUrl} alt={driver.country_of_representation ?? ""} />}
            {driver.display_name}
          </div>
          {team && (
            <div className="dix-row-team">
              {logoUrl && <img loading="lazy" className="dix-team-logo" src={logoUrl} alt={team.display_name ?? ""} />}
              {team.display_name ?? team.name}
            </div>
          )}
        </div>
      </div>

      <div className="dix-row-stats">
        <div className="dix-row-stat">
          <span className="dix-row-stat-value">{points}</span>
          <span className="dix-row-stat-label">PTS</span>
        </div>
        <div className="dix-row-stat">
          <span className={`dix-row-stat-value${wins > 0 ? " dix-row-stat-value--wins" : ""}`}>{wins}</span>
          <span className="dix-row-stat-label">W</span>
        </div>
        <div className="dix-row-stat">
          <span className={`dix-row-stat-value${last_finish === 1 ? " dix-row-stat-value--gold" : ""}`}>
            {last_finish !== null ? `P${last_finish}` : "—"}
          </span>
          <span className="dix-row-stat-label">LAST</span>
        </div>
      </div>
    </Link>
  );
}

// ─── Driver grid card ─────────────────────────────────────────────────────────

function DriverGridCard({ entry }: { entry: AllDriverEntry }) {
  const { driver, is_human, career_points, career_wins, career_races, specialist_label } = entry;
  const avatarUrl = driver.profile_image ? displayImage(driver.profile_image, "driver") : null;
  const flagUrl = driver.country_of_representation
    ? displayImage(driver.country_of_representation, "flags")
    : null;

  return (
    <Link
      to={`/drivers/${driver.id}`}
      className={`dix-grid-card${is_human ? " dix-grid-card--human" : ""}`}
    >
      <div className="dix-grid-avatar">
        {avatarUrl
          ? <img loading="lazy" src={avatarUrl} alt={driver.display_name} />
          : <div className="dix-grid-avatar-placeholder" />
        }
      </div>
      <div className="dix-grid-info">
        <div className="dix-grid-name">
          {flagUrl && <img loading="lazy" className="dix-flag" src={flagUrl} alt={driver.country_of_representation ?? ""} />}
          {driver.display_name}
        </div>
        <div className="dix-grid-stats">
          <span className="dix-grid-pts">{career_points.toLocaleString()} pts</span>
          {career_wins > 0 && <span className="dix-grid-wins">{career_wins}W</span>}
          <span className="dix-grid-races">{career_races}R</span>
        </div>
        {specialist_label && (
          <div className="dix-grid-specialty">{specialist_label}</div>
        )}
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type GridMode = "human" | "all";

export const DriversIndex = () => {
  const { data, isLoading, error } = useDriversHomepage();
  const [search, setSearch] = useState("");
  const [gridMode, setGridMode] = useState<GridMode>("human");

  if (isLoading) return <Loader label="Loading drivers…" full />;
  if (error || !data) return <div style={{ color: "crimson", padding: 20 }}>Failed to load drivers.</div>;

  const { human_spotlight, all_drivers, latest_season_id } = data;
  const humanDrivers = all_drivers.filter((d) => d.is_human);

  const baseList = gridMode === "human"
    ? humanDrivers
    : [
        ...all_drivers.filter((d) => d.is_human),
        ...all_drivers.filter((d) => !d.is_human),
      ];

  const filtered = search.trim()
    ? baseList.filter((d) =>
        d.driver.display_name.toLowerCase().includes(search.toLowerCase())
      )
    : baseList;

  return (
    <div className="dix-page">

      {/* ── Hero ── */}
      <div className="dix-hero">
        <div className="dix-hero-left">
          <span className="dix-hero-eyebrow">CGR League</span>
          <h1 className="dix-hero-title">Drivers</h1>
        </div>
        <div className="dix-hero-right">
          {latest_season_id && (
            <div className="dix-hero-badge">Season {latest_season_id}</div>
          )}
          <div className="dix-hero-badge">{all_drivers.length} drivers</div>
        </div>
      </div>

      {/* ── Current Season ── */}
      {human_spotlight.length > 0 && (
        <section className="dix-section">
          <div className="dix-section-header">
            <h2 className="dix-section-title">Current Season</h2>
            {latest_season_id && (
              <span className="dix-section-sub">Season {latest_season_id} · Human drivers</span>
            )}
          </div>
          <div className="dix-standings">
            {human_spotlight.map((entry) => (
              <StandingsRow key={entry.driver.id} entry={entry} />
            ))}
          </div>
        </section>
      )}

      {/* ── Driver Grid ── */}
      <section className="dix-section">
        <div className="dix-section-header">
          <h2 className="dix-section-title">Drivers</h2>
          <div className="dix-grid-controls">
            <div className="dix-toggle">
              <button
                className={`dix-toggle-btn${gridMode === "human" ? " dix-toggle-btn--active" : ""}`}
                onClick={() => setGridMode("human")}
              >
                Human
              </button>
              <button
                className={`dix-toggle-btn${gridMode === "all" ? " dix-toggle-btn--active" : ""}`}
                onClick={() => setGridMode("all")}
              >
                All
              </button>
            </div>
            <input
              className="dix-search"
              type="search"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="dix-driver-grid">
          {filtered.map((entry) => (
            <DriverGridCard key={entry.driver.id} entry={entry} />
          ))}
          {filtered.length === 0 && (
            <p className="dix-empty">No drivers match "{search}"</p>
          )}
        </div>
      </section>

    </div>
  );
};
