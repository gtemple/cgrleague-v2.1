import { useState } from "react";
import { Link } from "react-router-dom";
import { useDriversHomepage } from "../../hooks/useDriversHomepage";
import type { HumanSpotlightEntry, AllDriverEntry } from "../../hooks/useDriversHomepage";
import { displayImage } from "../../utils/displayImage";
import { Loader } from "../../components/Loader";
import "./DriversIndex.css";

// ─── Human spotlight card ─────────────────────────────────────────────────────

function HumanCard({ entry }: { entry: HumanSpotlightEntry }) {
  const { driver, position, points, wins, team, last_finish } = entry;
  const avatarUrl = driver.profile_image ? displayImage(driver.profile_image, "driver") : null;
  const flagUrl = driver.country_of_representation
    ? displayImage(driver.country_of_representation, "flags")
    : null;
  const accent = team?.color || "#7a766b";

  return (
    <Link
      to={`/drivers/${driver.id}`}
      className="dix-human-card"
      style={{ "--accent": accent } as React.CSSProperties}
    >
      <div className="dix-human-bar" />
      <div className="dix-human-body">
        <div className="dix-human-top">
          <div className="dix-human-id">
            <div className="dix-human-avatar">
              {avatarUrl
                ? <img loading="lazy" src={avatarUrl} alt="" />
                : <div className="dix-human-avatar-placeholder" />}
            </div>
            <div>
              <div className="dix-human-nat-row">
                {flagUrl && <img loading="lazy" className="dix-human-flag" src={flagUrl} alt="" />}
                <span className="dix-human-dot" />
              </div>
              <div className="dix-human-name">{driver.display_name}</div>
              <div className="dix-human-team">{(team?.display_name ?? team?.name ?? "").toUpperCase()}</div>
            </div>
          </div>
          <span className="dix-human-pos">P{position}</span>
        </div>
        <div className="dix-human-stats">
          <div className="dix-human-stat">
            <div className="dix-human-stat-value">{points}</div>
            <div className="dix-human-stat-label">POINTS</div>
          </div>
          <div className="dix-human-stat">
            <div className="dix-human-stat-value">{wins}</div>
            <div className="dix-human-stat-label">WINS</div>
          </div>
          <div className="dix-human-stat">
            <div className="dix-human-stat-value">{last_finish != null ? `P${last_finish}` : "—"}</div>
            <div className="dix-human-stat-label">LAST RACE</div>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Roster row ────────────────────────────────────────────────────────────────

function RosterRow({ entry, rank, maxPoints }: { entry: AllDriverEntry; rank: number; maxPoints: number }) {
  const { driver, is_human, career_points, career_wins, career_races, specialist_label } = entry;
  const flagUrl = driver.country_of_representation
    ? displayImage(driver.country_of_representation, "flags")
    : null;
  const barPct = maxPoints > 0 ? Math.round((career_points / maxPoints) * 100) : 0;

  return (
    <Link to={`/drivers/${driver.id}`} className="dix-roster-row">
      <div className="dix-roster-rank">{rank}</div>
      <div className="dix-roster-identity">
        <span className="dix-roster-bar" />
        {flagUrl && <img loading="lazy" className="dix-roster-flag" src={flagUrl} alt="" />}
        <span className="dix-roster-name">{driver.display_name}</span>
        {is_human && <span className="dix-roster-human-badge">HUMAN</span>}
        {specialist_label && <span className="dix-roster-specialty">{specialist_label}</span>}
      </div>
      <div className="dix-roster-pts">
        <span className="dix-roster-bar-track">
          <span className="dix-roster-bar-fill" style={{ width: `${barPct}%` }} />
        </span>
        <span className="dix-roster-pts-value">{career_points.toLocaleString()}</span>
      </div>
      <div className={`dix-roster-wins${career_wins > 0 ? " dix-roster-wins--active" : ""}`}>{career_wins}</div>
      <div className="dix-roster-races">{career_races}</div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type GridMode = "all" | "human";

export const DriversIndex = () => {
  const { data, isLoading, error } = useDriversHomepage();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<GridMode>("all");

  if (isLoading) return (
    <div className="dix-page">
      <div className="dix-header-band">
        <div className="dix-header-inner">
          <div>
            <div className="dix-eyebrow">CGR LEAGUE · ROSTER</div>
            <h1 className="dix-title">Drivers</h1>
          </div>
        </div>
      </div>
      <div className="dix-body">
        <Loader label="Loading drivers…" full />
      </div>
    </div>
  );
  if (error || !data) return <div style={{ color: "crimson", padding: 20 }}>Failed to load drivers.</div>;

  const { human_spotlight, all_drivers, latest_season_id } = data;

  const baseList = filter === "human" ? all_drivers.filter((d) => d.is_human) : all_drivers;
  const filtered = search.trim()
    ? baseList.filter((d) => d.driver.display_name.toLowerCase().includes(search.toLowerCase()))
    : baseList;

  const maxPoints = Math.max(1, ...all_drivers.map((d) => d.career_points));

  return (
    <div className="dix-page">

      {/* ── Header band ── */}
      <div className="dix-header-band">
        <div className="dix-header-inner">
          <div>
            <div className="dix-eyebrow">CGR LEAGUE · ROSTER</div>
            <h1 className="dix-title">Drivers</h1>
          </div>
          <div className="dix-header-chips">
            {latest_season_id && <span className="dix-chip">SEASON {latest_season_id}</span>}
            <span className="dix-chip dix-chip--accent">{all_drivers.length} DRIVERS</span>
          </div>
        </div>
      </div>

      <div className="dix-body">

        {/* ── The humans ── */}
        {human_spotlight.length > 0 && (
          <section className="dix-section">
            <div className="dix-section-eyebrow-row">
              <span className="dix-section-eyebrow">THE HUMANS</span>
              {latest_season_id && <span className="dix-section-eyebrow-sub">· SEASON {latest_season_id} · LEAGUE MEMBERS</span>}
            </div>
            <div className="dix-human-grid">
              {human_spotlight.map((entry) => (
                <HumanCard key={entry.driver.id} entry={entry} />
              ))}
            </div>
          </section>
        )}

        {/* ── All drivers ── */}
        <div className="dix-roster-card">
          <div className="dix-roster-header">
            <span className="dix-section-eyebrow">ALL DRIVERS · CAREER</span>
            <div className="dix-roster-controls">
              <div className="dix-toggle">
                <button
                  className={filter === "all" ? "dix-toggle-btn dix-toggle-btn--active" : "dix-toggle-btn"}
                  onClick={() => setFilter("all")}
                >
                  All
                </button>
                <button
                  className={filter === "human" ? "dix-toggle-btn dix-toggle-btn--active" : "dix-toggle-btn"}
                  onClick={() => setFilter("human")}
                >
                  Human
                </button>
              </div>
              <input
                className="dix-search"
                type="search"
                placeholder="Search drivers…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="dix-roster-col-header">
            <div className="dix-roster-rank">#</div>
            <div>DRIVER</div>
            <div className="dix-roster-col-right">CAREER PTS</div>
            <div className="dix-roster-col-right">WINS</div>
            <div className="dix-roster-col-right">RACES</div>
          </div>

          {filtered.map((entry, i) => (
            <RosterRow key={entry.driver.id} entry={entry} rank={i + 1} maxPoints={maxPoints} />
          ))}
          {filtered.length === 0 && (
            <div className="dix-empty">NO DRIVERS MATCH "{search.toUpperCase()}"</div>
          )}
        </div>

      </div>
    </div>
  );
};
