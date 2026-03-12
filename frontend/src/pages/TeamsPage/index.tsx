import { useState } from "react";
import { Link } from "react-router-dom";
import { useTeamsHomepage } from "../../hooks/useTeamsHomepage";
import type { CurrentSeasonTeam, AllTeamEntry, TeamRecord } from "../../hooks/useTeamsHomepage";
import { displayImage } from "../../utils/displayImage";
import { Loader } from "../../components/Loader";
import "./style.css";

// ─── helpers ──────────────────────────────────────────────────────────────────

function posBadgeClass(pos: number) {
  if (pos === 1) return "tix-pos tix-pos--1";
  if (pos === 2) return "tix-pos tix-pos--2";
  if (pos === 3) return "tix-pos tix-pos--3";
  return "tix-pos";
}

// ─── Standings row ────────────────────────────────────────────────────────────

function StandingsRow({ entry }: { entry: CurrentSeasonTeam }) {
  const { id, display_name, logo_image, color, points, wins, champ_pos } = entry;
  const logoUrl = logo_image ? displayImage(logo_image, "team") : null;
  const accent = color || "rgba(255,255,255,0.15)";

  return (
    <Link
      to={`/teams/${id}`}
      className={`tix-row${champ_pos === 1 ? " tix-row--first" : ""}`}
      style={{ "--row-accent": accent } as React.CSSProperties}
    >
      <div className="tix-row-left">
        <span className={posBadgeClass(champ_pos)}>P{champ_pos}</span>
        <div className="tix-row-logo">
          {logoUrl
            ? <img src={logoUrl} alt={display_name} />
            : <div className="tix-row-logo-placeholder" style={{ background: accent }} />
          }
        </div>
        <span className="tix-row-name">{display_name}</span>
      </div>
      <div className="tix-row-stats">
        <div className="tix-row-stat">
          <span className="tix-row-stat-value">{points}</span>
          <span className="tix-row-stat-label">PTS</span>
        </div>
        <div className="tix-row-stat">
          <span className={`tix-row-stat-value${wins > 0 ? " tix-row-stat-value--wins" : ""}`}>{wins}</span>
          <span className="tix-row-stat-label">W</span>
        </div>
      </div>
    </Link>
  );
}

// ─── Record tile ──────────────────────────────────────────────────────────────

const RECORD_LABELS: Record<string, string> = {
  points:  "All-time Points",
  wins:    "All-time Wins",
  podiums: "All-time Podiums",
  poles:   "All-time Poles",
};

function RecordTile({ stat, entry }: { stat: string; entry: TeamRecord }) {
  const { team, value } = entry;
  const logoUrl = team.logo_image ? displayImage(team.logo_image, "team") : null;
  const accent = team.color || "rgba(255,255,255,0.1)";

  return (
    <Link to={`/teams/${team.id}`} className="tix-record" style={{ "--record-accent": accent } as React.CSSProperties}>
      <div className="tix-record-left">
        <span className="tix-record-label">{RECORD_LABELS[stat]}</span>
        <span className="tix-record-value">{value.toLocaleString()}</span>
      </div>
      <div className="tix-record-right">
        <div className="tix-record-logo">
          {logoUrl
            ? <img src={logoUrl} alt={team.display_name} />
            : <div className="tix-record-logo-placeholder" style={{ background: accent }} />
          }
        </div>
        <span className="tix-record-name">{team.display_name}</span>
      </div>
    </Link>
  );
}

// ─── Team grid card ───────────────────────────────────────────────────────────

function TeamGridCard({ entry }: { entry: AllTeamEntry }) {
  const { id, display_name, logo_image, color, career_points, career_wins, career_seasons } = entry;
  const logoUrl = logo_image ? displayImage(logo_image, "team") : null;
  const accent = color || "";

  return (
    <Link
      to={`/teams/${id}`}
      className="tix-grid-card"
      style={accent ? { "--card-accent": accent } as React.CSSProperties : undefined}
    >
      <div className="tix-grid-logo">
        {logoUrl
          ? <img src={logoUrl} alt={display_name} />
          : <div className="tix-grid-logo-placeholder" style={accent ? { background: accent } : undefined} />
        }
      </div>
      <div className="tix-grid-info">
        <div className="tix-grid-name">{display_name}</div>
        <div className="tix-grid-stats">
          <span className="tix-grid-pts">{career_points.toLocaleString()} pts</span>
          {career_wins > 0 && <span className="tix-grid-wins">{career_wins}W</span>}
          <span className="tix-grid-seasons">{career_seasons}S</span>
        </div>
      </div>
      {accent && <div className="tix-grid-accent-bar" style={{ background: accent }} />}
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const TeamsIndex = () => {
  const { data, isLoading, error } = useTeamsHomepage();
  const [search, setSearch] = useState("");

  if (isLoading) return <Loader label="Loading teams…" full />;
  if (error || !data) return <div style={{ color: "crimson", padding: 20 }}>Failed to load teams.</div>;

  const { current_season, records, all_teams, latest_season_id } = data;
  const recordEntries = Object.entries(records).filter(([, v]) => v !== null) as [string, TeamRecord][];

  const filtered = search.trim()
    ? all_teams.filter((t) =>
        t.display_name.toLowerCase().includes(search.toLowerCase()) ||
        t.name.toLowerCase().includes(search.toLowerCase())
      )
    : all_teams;

  return (
    <div className="tix-page">

      {/* ── Hero ── */}
      <div className="tix-hero">
        <div className="tix-hero-left">
          <span className="tix-hero-eyebrow">CGR League</span>
          <h1 className="tix-hero-title">Teams</h1>
        </div>
        <div className="tix-hero-right">
          {latest_season_id && (
            <div className="tix-hero-badge">Season {latest_season_id}</div>
          )}
          <div className="tix-hero-badge">{all_teams.length} teams</div>
        </div>
      </div>

      {/* ── Current Season ── */}
      {current_season.length > 0 && (
        <section className="tix-section">
          <div className="tix-section-header">
            <h2 className="tix-section-title">Current Season</h2>
            {latest_season_id && (
              <span className="tix-section-sub">Season {latest_season_id} · Constructor standings</span>
            )}
          </div>
          <div className="tix-standings">
            {current_season.map((entry) => (
              <StandingsRow key={entry.id} entry={entry} />
            ))}
          </div>
        </section>
      )}

      {/* ── All-time Records ── */}
      {recordEntries.length > 0 && (
        <section className="tix-section">
          <div className="tix-section-header">
            <h2 className="tix-section-title">All-time Records</h2>
          </div>
          <div className="tix-records">
            {recordEntries.map(([stat, entry]) => (
              <RecordTile key={stat} stat={stat} entry={entry} />
            ))}
          </div>
        </section>
      )}

      {/* ── Team Grid ── */}
      <section className="tix-section">
        <div className="tix-section-header">
          <h2 className="tix-section-title">All Teams</h2>
          <input
            className="tix-search"
            type="search"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="tix-team-grid">
          {filtered.map((entry) => (
            <TeamGridCard key={entry.id} entry={entry} />
          ))}
          {filtered.length === 0 && (
            <p className="tix-empty">No teams match "{search}"</p>
          )}
        </div>
      </section>

    </div>
  );
};
