import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useTeamDetail } from "../../hooks/useTeamDetail";
import { useTeamsList } from "../../hooks/useTeamsList";
import { displayImage } from "../../utils/displayImage";
import { Loader } from "../../components/Loader";
import "./style.css";

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
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

  if (error || !data) {
    return <div className="state state-error">Failed to load team.</div>;
  }

  const { team, career, seasons } = data;
  const logo = displayImage(team.logo_image ?? team.name, "team");
  const teams = listData?.teams ?? [];

  return (
    <div className="team-page">
      <section className="team-hero">
        <div className="team-hero-top">
          <div className="team-logo-wrap">
            {logo
              ? <img src={logo} alt={team.name} className="team-logo-img" />
              : <div className="team-logo-fallback" />}
          </div>
          <div className="team-hero-info">
            <h1 className="team-name">{team.name}</h1>
            <div className="team-meta">
              {team.country && <span>{team.country}</span>}
              {team.founded && <span>Est. {team.founded}</span>}
            </div>
          </div>
          <div className="team-picker">
            <select
              className="team-select"
              value={selectValue}
              onChange={(e) => {
                const next = e.target.value;
                setSelectValue(next);
                if (next && next !== teamId) navigate(`/teams/${next}`);
              }}
            >
              {teams.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.team_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="hero-divider" />

        <div className="hero-second-row">
          <div className="hero-highlight-container">
            <div className="hero-highlight-number">{career.points}</div>
            <div className="hero-highlight-label">Points</div>
          </div>
          <div className="hero-highlight-container">
            <div className="hero-highlight-number">{career.wins}</div>
            <div className="hero-highlight-label">Wins</div>
          </div>
          <div className="hero-highlight-container">
            <div className="hero-highlight-number">{career.podiums}</div>
            <div className="hero-highlight-label">Podiums</div>
          </div>
          <div className="hero-highlight-container">
            <div className="hero-highlight-number">{career.poles}</div>
            <div className="hero-highlight-label">Poles</div>
          </div>
          <div className="hero-highlight-container">
            <div className="hero-highlight-number">{career.fastest_laps}</div>
            <div className="hero-highlight-label">Fastest Laps</div>
          </div>
          <div className="hero-highlight-container">
            <div className="hero-highlight-number">{career.dotds}</div>
            <div className="hero-highlight-label">DOTDs</div>
          </div>
          <div className="hero-highlight-container">
            <div className="hero-highlight-number">{career.races}</div>
            <div className="hero-highlight-label">Races</div>
          </div>
          <div className="hero-highlight-container">
            <div className="hero-highlight-number">{career.seasons}</div>
            <div className="hero-highlight-label">Seasons</div>
          </div>
          <div className="hero-highlight-container">
            <div className="hero-highlight-number">{career.drivers}</div>
            <div className="hero-highlight-label">Drivers Used</div>
          </div>
        </div>
      </section>

      <section className="border team-history-section">
        <h2 className="section-title">Season History</h2>
        <div className="table-wrap">
          <div className="table-hint">Drag sideways to see more →</div>
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
                <th>Drivers</th>
              </tr>
            </thead>
            <tbody>
              {seasons.map((row) => (
                <tr key={row.season.id}>
                  <td>
                    <Link className="season-pill" to={`/seasons/${row.season.id}`}>
                      S{row.season.id}
                    </Link>
                  </td>
                  <td>
                    <span
                      className="team-color-dot"
                      style={{ background: row.color || "rgba(255,255,255,0.2)" }}
                    />
                    {row.display_name}
                  </td>
                  <td className="champ-pos">{ordinal(row.champ_pos)}</td>
                  <td>{row.points}</td>
                  <td>{row.wins}</td>
                  <td>{row.podiums}</td>
                  <td>{row.poles}</td>
                  <td>{row.fastest_laps}</td>
                  <td>{row.races}</td>
                  <td>
                    <div className="drivers-cell">
                      {row.drivers.map((d) => (
                        <Link
                          key={d.id}
                          to={`/drivers/${d.id}`}
                          className="driver-chip"
                          title={`${d.display_name} — ${d.points} pts`}
                        >
                          {d.display_name}
                        </Link>
                      ))}
                    </div>
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
