import { useState } from "react";
import { Link } from "react-router-dom";
import { useDriversHomepage } from "../../hooks/useDriversHomepage";
import type { HumanSpotlightEntry, AllDriverEntry, LeaderEntry } from "../../hooks/useDriversHomepage";
import { displayImage } from "../../utils/displayImage";
import { Loader } from "../../components/Loader";
import "./DriversIndex.css";

// ─── helpers ──────────────────────────────────────────────────────────────────

function posLabel(pos: number) {
  if (pos === 1) return "P1";
  if (pos === 2) return "P2";
  if (pos === 3) return "P3";
  return `P${pos}`;
}

function finishLabel(pos: number | null) {
  if (pos === null) return "—";
  return `P${pos}`;
}

// ─── Human spotlight card ─────────────────────────────────────────────────────

function SpotlightCard({ entry }: { entry: HumanSpotlightEntry }) {
  const { driver, position, points, wins, team, last_finish } = entry;
  const avatarUrl = driver.profile_image ? displayImage(driver.profile_image, "driver") : null;
  const flagUrl = driver.country_of_representation
    ? displayImage(driver.country_of_representation, "flags")
    : null;
  const logoUrl = team?.logo_image ? displayImage(team.logo_image, "team") : null;
  const accentColor = team?.color || "rgba(255,199,14,0.6)";

  return (
    <Link to={`/drivers/${driver.id}`} className="dix-spotlight-card" style={{ "--accent": accentColor } as React.CSSProperties}>
      <div className="dix-spotlight-pos" style={{ color: accentColor }}>{posLabel(position)}</div>

      <div className="dix-spotlight-avatar">
        {avatarUrl
          ? <img src={avatarUrl} alt={driver.display_name} />
          : <div className="dix-spotlight-avatar-placeholder" />
        }
      </div>

      <div className="dix-spotlight-info">
        <div className="dix-spotlight-name">
          {flagUrl && <img className="dix-flag" src={flagUrl} alt={driver.country_of_representation ?? ""} />}
          {driver.display_name}
        </div>
        {team && (
          <div className="dix-spotlight-team">
            {logoUrl && <img className="dix-team-logo" src={logoUrl} alt={team.display_name ?? ""} />}
            <span>{team.display_name ?? team.name}</span>
          </div>
        )}
      </div>

      <div className="dix-spotlight-stats">
        <div className="dix-spotlight-stat">
          <span className="dix-spotlight-stat-value">{points}</span>
          <span className="dix-spotlight-stat-label">PTS</span>
        </div>
        <div className="dix-spotlight-stat">
          <span className="dix-spotlight-stat-value">{wins}</span>
          <span className="dix-spotlight-stat-label">WINS</span>
        </div>
        <div className="dix-spotlight-stat">
          <span className={`dix-spotlight-stat-value${last_finish === 1 ? " dix-spotlight-stat-value--gold" : ""}`}>
            {finishLabel(last_finish)}
          </span>
          <span className="dix-spotlight-stat-label">LAST</span>
        </div>
      </div>
    </Link>
  );
}

// ─── All-time leader tile ─────────────────────────────────────────────────────

const LEADER_LABELS: Record<string, string> = {
  points: "Points",
  wins: "Wins",
  podiums: "Podiums",
  poles: "Poles",
  fastest_laps: "Fastest Laps",
};

function LeaderTile({ stat, entry }: { stat: string; entry: LeaderEntry }) {
  const { driver, value } = entry;
  const avatarUrl = driver.profile_image ? displayImage(driver.profile_image, "driver") : null;

  return (
    <Link to={`/drivers/${driver.id}`} className="dix-leader-tile">
      <div className="dix-leader-label">{LEADER_LABELS[stat]}</div>
      <div className="dix-leader-avatar">
        {avatarUrl
          ? <img src={avatarUrl} alt={driver.display_name} />
          : <div className="dix-leader-avatar-placeholder" />
        }
      </div>
      <div className="dix-leader-name">{driver.display_name}</div>
      <div className="dix-leader-value">{value.toLocaleString()}</div>
    </Link>
  );
}

// ─── Driver grid card ─────────────────────────────────────────────────────────

function DriverGridCard({ entry }: { entry: AllDriverEntry }) {
  const { driver, is_human, career_points, career_wins } = entry;
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
          ? <img src={avatarUrl} alt={driver.display_name} />
          : <div className="dix-grid-avatar-placeholder" />
        }
      </div>
      <div className="dix-grid-info">
        <div className="dix-grid-name">
          {flagUrl && <img className="dix-flag" src={flagUrl} alt={driver.country_of_representation ?? ""} />}
          {driver.display_name}
        </div>
        <div className="dix-grid-stats">
          <span>{career_points.toLocaleString()} pts</span>
          {career_wins > 0 && <span className="dix-grid-wins">{career_wins}W</span>}
        </div>
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const DriversIndex = () => {
  const { data, isLoading, error } = useDriversHomepage();
  const [search, setSearch] = useState("");

  if (isLoading) return <Loader label="Loading drivers…" full />;
  if (error || !data) return <div style={{ color: "crimson", padding: 20 }}>Failed to load drivers.</div>;

  const { human_spotlight, leaders, all_drivers, latest_season_id } = data;

  const filtered = search.trim()
    ? all_drivers.filter((d) =>
        d.driver.display_name.toLowerCase().includes(search.toLowerCase())
      )
    : all_drivers;

  const leaderEntries = Object.entries(leaders).filter(([, v]) => v !== null) as [string, LeaderEntry][];

  return (
    <div className="dix-page">

      {/* ── Human Spotlight ── */}
      {human_spotlight.length > 0 && (
        <section className="dix-section">
          <div className="dix-section-header">
            <h2 className="dix-section-title">Human Drivers</h2>
            {latest_season_id && (
              <span className="dix-section-sub">Season {latest_season_id} standings</span>
            )}
          </div>
          <div className="dix-spotlight-grid">
            {human_spotlight.map((entry) => (
              <SpotlightCard key={entry.driver.id} entry={entry} />
            ))}
          </div>
        </section>
      )}

      {/* ── All-time Leaders ── */}
      {leaderEntries.length > 0 && (
        <section className="dix-section">
          <div className="dix-section-header">
            <h2 className="dix-section-title">All-time Leaders</h2>
            <span className="dix-section-sub">Human drivers</span>
          </div>
          <div className="dix-leaders-strip">
            {leaderEntries.map(([stat, entry]) => (
              <LeaderTile key={stat} stat={stat} entry={entry} />
            ))}
          </div>
        </section>
      )}

      {/* ── Full Grid ── */}
      <section className="dix-section">
        <div className="dix-section-header">
          <h2 className="dix-section-title">All Drivers</h2>
          <input
            className="dix-search"
            type="search"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
