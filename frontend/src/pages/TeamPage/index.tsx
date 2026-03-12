import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useTeamDetail, type TeamDriver } from "../../hooks/useTeamDetail";
import { useTeamsList } from "../../hooks/useTeamsList";
import { displayImage } from "../../utils/displayImage";
import { Loader } from "../../components/Loader";
import "./style.css";

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function champPosClass(pos: number) {
  if (pos === 1) return "team-champ-1";
  if (pos === 2) return "team-champ-2";
  if (pos === 3) return "team-champ-3";
  return "";
}

function lastName(name: string) {
  return name.split(" ").slice(-1)[0];
}

function DriverH2H({ drivers, color }: { drivers: TeamDriver[]; color: string }) {
  const accent = color || "rgba(255,255,255,0.45)";

  if (drivers.length === 0) return null;

  if (drivers.length === 1) {
    const d = drivers[0];
    return (
      <div className="th2h">
        <div className="th2h-side th2h-left" style={{ color: accent }}>
          <span className="th2h-name">{lastName(d.display_name)}</span>
          <span className="th2h-pts">{d.points}</span>
        </div>
        <div className="th2h-bar">
          <div className="th2h-bar-fill" style={{ width: "100%", background: accent }} />
        </div>
        <div className="th2h-side th2h-right th2h-right-empty" />
      </div>
    );
  }

  const sorted = [...drivers].sort((a, b) => b.points - a.points);
  const [lead, trail] = sorted;
  const total = lead.points + trail.points;
  const leadPct = total > 0 ? (lead.points / total) * 100 : 50;

  return (
    <div
      className="th2h"
      title={`${lead.display_name} ${leadPct.toFixed(0)}% · ${trail.display_name} ${(100 - leadPct).toFixed(0)}%`}
    >
      <div className="th2h-side th2h-left" style={{ color: accent }}>
        <span className="th2h-name">{lastName(lead.display_name)}</span>
        <span className="th2h-pts">{lead.points}</span>
      </div>
      <div className="th2h-bar">
        <div
          className="th2h-bar-fill th2h-bar-lead"
          style={{ width: `${leadPct}%`, background: accent }}
        />
        <div
          className="th2h-bar-fill th2h-bar-trail"
          style={{ width: `${100 - leadPct}%` }}
        />
      </div>
      <div className="th2h-side th2h-right">
        <span className="th2h-pts">{trail.points}</span>
        <span className="th2h-name">{lastName(trail.display_name)}</span>
      </div>
    </div>
  );
}

export function TeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();

  const { data: listData } = useTeamsList();
  const { data, isLoading, error } = useTeamDetail(teamId);

  const [selectValue, setSelectValue] = useState(teamId ?? "");
  useEffect(() => {
    if (teamId != null) setSelectValue(teamId);
  }, [teamId]);

  if (isLoading) return <Loader label="Loading team…" full />;
  if (error || !data) return <div className="team-state-error">Failed to load team.</div>;

  const { team, career, seasons } = data;
  const logoSrc = displayImage(team.logo_image ?? team.name, "team");
  const teams = listData?.teams ?? [];

  // Accent colour from the most recent season
  const accentColor = seasons[0]?.color || "";

  const winRate = career.races > 0
    ? ((career.wins / career.races) * 100).toFixed(1) + "%"
    : "—";
  const ptsPerRace = career.races > 0
    ? (career.points / career.races).toFixed(1)
    : "—";

  return (
    <div className="team-page">

      {/* ══════════════════════ HERO ══════════════════════ */}
      <header
        className="team-hero"
        style={accentColor ? { borderLeftColor: accentColor, borderLeftWidth: "3px" } : {}}
      >

        {/* Blurred logo as atmospheric background */}
        <div className="team-hero-bg">
          {logoSrc && <img src={logoSrc} alt="" aria-hidden />}
          <div
            className="team-hero-bg-overlay"
            style={accentColor ? {
              background: `linear-gradient(to right, ${accentColor}14 0%, transparent 45%),
                linear-gradient(to bottom, rgba(5,5,20,0.2) 0%, rgba(5,5,20,0.0) 30%, rgba(5,5,20,0.65) 85%, rgba(5,5,20,1) 100%)`
            } : {}}
          />
        </div>

        {/* Top bar: eyebrow + picker */}
        <div className="team-hero-topbar">
          <span
            className="team-eyebrow"
            style={accentColor ? { color: accentColor } : {}}
          >
            CGR League · Constructor
          </span>
          <select
            className="team-picker"
            value={selectValue}
            onChange={(e) => {
              const next = e.target.value;
              setSelectValue(next);
              if (next && next !== teamId) navigate(`/teams/${next}`);
            }}
          >
            {teams.map((t) => (
              <option key={t.id} value={String(t.id)}>{t.team_name}</option>
            ))}
          </select>
        </div>

        {/* Main hero body: logo left, name right */}
        <div className="team-hero-body">
          <div
            className="team-logo-wrap"
            style={accentColor ? { borderColor: `${accentColor}30` } : {}}
          >
            {logoSrc
              ? <img src={logoSrc} alt={team.name} className="team-logo-img" />
              : <div className="team-logo-fallback" />}
          </div>

          <div className="team-hero-name-block">
            <h1 className="team-name">{team.name}</h1>
            <div className="team-meta">
              {team.country && <span className="team-meta-chip">{team.country}</span>}
              {team.founded && <span className="team-meta-chip">Est. {team.founded}</span>}
              <span className="team-meta-chip">{career.seasons} Season{career.seasons !== 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>

        {/* Stat strip */}
        <div className="team-stat-strip">
          {[
            { value: career.points,       label: "Points" },
            { value: ptsPerRace,          label: "Pts / Race" },
            { value: career.wins,         label: "Wins" },
            { value: winRate,             label: "Win Rate" },
            { value: career.podiums,      label: "Podiums" },
            { value: career.poles,        label: "Poles" },
            { value: career.fastest_laps, label: "Fastest Laps" },
            { value: career.dotds,        label: "DOTDs" },
          ].map((s) => (
            <div className="team-stat" key={s.label}>
              <div className="team-stat-value">{s.value}</div>
              <div className="team-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </header>

      {/* ══════════════════════ SEASON HISTORY ══════════════════════ */}
      <section className="team-history-section">
        <h2 className="team-section-title">Season History</h2>
        <div className="team-table-scroll">
          <div className="team-table-hint">Drag sideways to see more →</div>
          <table className="team-history-table">
            <thead>
              <tr>
                <th>Season</th>
                <th>Name</th>
                <th>Pos</th>
                <th>Pts</th>
                <th>Wins</th>
                <th>Podiums</th>
                <th>Poles</th>
                <th>FL</th>
                <th>Races</th>
                <th className="th2h-col-header">Driver Split</th>
              </tr>
            </thead>
            <tbody>
              {seasons.map((row) => (
                <tr key={row.season.id}>
                  <td>
                    <Link className="team-season-pill" to={`/seasons/${row.season.id}`}>
                      S{row.season.id}
                    </Link>
                  </td>
                  <td>
                    <div className="team-name-cell">
                      <span
                        className="team-color-dot"
                        style={{ background: row.color || "rgba(255,255,255,0.2)" }}
                      />
                      <span className="team-display-name">{row.display_name}</span>
                    </div>
                  </td>
                  <td className={`team-champ-pos ${champPosClass(row.champ_pos)}`}>
                    {ordinal(row.champ_pos)}
                  </td>
                  <td className="team-pts-cell">{row.points}</td>
                  <td>{row.wins > 0 ? row.wins : <span className="team-zero">—</span>}</td>
                  <td>{row.podiums > 0 ? row.podiums : <span className="team-zero">—</span>}</td>
                  <td>{row.poles > 0 ? row.poles : <span className="team-zero">—</span>}</td>
                  <td>{row.fastest_laps > 0 ? row.fastest_laps : <span className="team-zero">—</span>}</td>
                  <td>{row.races}</td>
                  <td className="th2h-cell">
                    <DriverH2H drivers={row.drivers} color={row.color} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
