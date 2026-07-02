import { useState } from "react";
import { Link } from "react-router-dom";
import { useTeamsHomepage } from "../../hooks/useTeamsHomepage";
import type { CurrentSeasonTeam, AllTeamEntry, TeamRecord } from "../../hooks/useTeamsHomepage";
import { displayImage } from "../../utils/displayImage";
import { Loader } from "../../components/Loader";
import { teamCode } from "../../utils/teamCode";
import "./style.css";

// ─── Standings row ────────────────────────────────────────────────────────────

function StandingsRow({ entry }: { entry: CurrentSeasonTeam }) {
  const { id, display_name, logo_image, color, points, wins, champ_pos } = entry;
  const logoUrl = logo_image ? displayImage(logo_image, "team") : null;
  const accent = color || "#7a766b";

  return (
    <Link
      to={`/teams/${id}`}
      className={`tix-row${champ_pos === 1 ? " tix-row--first" : ""}`}
    >
      <span className="tix-row-pos">{champ_pos}</span>
      <span className="tix-row-code" style={{ background: accent }}>{teamCode(display_name)}</span>
      <div className="tix-row-identity">
        {logoUrl && <img loading="lazy" className="tix-row-logo" src={logoUrl} alt="" />}
        <span className="tix-row-name">{display_name}</span>
        {wins > 0 && <span className="tix-row-win-badge">{wins}W</span>}
      </div>
      <div className="tix-row-pts">
        <span className="tix-row-pts-value">{points}</span>
        <span className="tix-row-pts-label">PTS</span>
      </div>
    </Link>
  );
}

// ─── Record tile ──────────────────────────────────────────────────────────────

const RECORD_LABELS: Record<string, string> = {
  points:  "ALL-TIME POINTS",
  wins:    "ALL-TIME WINS",
  podiums: "ALL-TIME PODIUMS",
  poles:   "ALL-TIME POLES",
};

function RecordTile({ stat, entry }: { stat: string; entry: TeamRecord }) {
  const { team, value } = entry;
  const accent = team.color || "#7a766b";

  return (
    <Link to={`/teams/${team.id}`} className="tix-record" style={{ "--record-accent": accent } as React.CSSProperties}>
      <span className="tix-record-label">{RECORD_LABELS[stat]}</span>
      <span className="tix-record-value">{value.toLocaleString()}</span>
      <div className="tix-record-team">
        <span className="tix-record-code" style={{ background: accent }}>{teamCode(team.display_name)}</span>
        <span className="tix-record-name">{team.display_name}</span>
      </div>
    </Link>
  );
}

// ─── Team grid card ───────────────────────────────────────────────────────────

function TeamGridCard({ entry, maxPoints }: { entry: AllTeamEntry; maxPoints: number }) {
  const { id, display_name, color, career_points, career_wins, career_seasons } = entry;
  const accent = color || "#7a766b";
  const barPct = maxPoints > 0 ? Math.round((career_points / maxPoints) * 100) : 0;

  return (
    <Link to={`/teams/${id}`} className="tix-grid-card">
      <div className="tix-grid-top">
        <span className="tix-grid-code" style={{ background: accent }}>{teamCode(display_name)}</span>
        <div className="tix-grid-info">
          <div className="tix-grid-name">{display_name}</div>
          <div className="tix-grid-seasons">{career_seasons} SEASONS</div>
        </div>
      </div>
      <div className="tix-grid-bar-row">
        <div className="tix-grid-bar-track">
          <div className="tix-grid-bar-fill" style={{ width: `${barPct}%`, background: accent }} />
        </div>
      </div>
      <div className="tix-grid-bottom">
        <span className="tix-grid-pts"><b>{career_points.toLocaleString()}</b> pts</span>
        <span className={`tix-grid-wins${career_wins > 0 ? " tix-grid-wins--active" : ""}`}>
          {career_wins > 0 ? `${career_wins}W` : "—"}
        </span>
      </div>
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
  const maxPoints = Math.max(1, ...all_teams.map((t) => t.career_points));

  const filtered = search.trim()
    ? all_teams.filter((t) =>
        t.display_name.toLowerCase().includes(search.toLowerCase()) ||
        t.name.toLowerCase().includes(search.toLowerCase())
      )
    : all_teams;

  return (
    <div className="tix-page">

      {/* ── Header band ── */}
      <div className="tix-header-band">
        <div className="tix-header-inner">
          <div>
            <div className="tix-eyebrow">CGR LEAGUE · CONSTRUCTORS</div>
            <h1 className="tix-title">Teams</h1>
          </div>
          <div className="tix-header-chips">
            {latest_season_id && <span className="tix-chip">SEASON {latest_season_id}</span>}
            <span className="tix-chip tix-chip--accent">{all_teams.length} TEAMS</span>
          </div>
        </div>
      </div>

      <div className="tix-body">

        {/* ── Current Season ── */}
        {current_season.length > 0 && (
          <section className="tix-section">
            <div className="tix-section-eyebrow-row">
              <span className="tix-section-eyebrow">CURRENT SEASON</span>
              {latest_season_id && <span className="tix-section-eyebrow-sub">Season {latest_season_id} · Constructor standings</span>}
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
            <div className="tix-section-eyebrow-row">
              <span className="tix-section-eyebrow">ALL-TIME RECORDS</span>
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
          <div className="tix-section-eyebrow-row tix-section-eyebrow-row--space">
            <span className="tix-section-eyebrow">ALL TEAMS · ALL-TIME</span>
            <input
              className="tix-search"
              type="search"
              placeholder="Search teams…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="tix-team-grid">
            {filtered.map((entry) => (
              <TeamGridCard key={entry.id} entry={entry} maxPoints={maxPoints} />
            ))}
            {filtered.length === 0 && (
              <p className="tix-empty">No teams match "{search}"</p>
            )}
          </div>
        </section>

      </div>
    </div>
  );
};
