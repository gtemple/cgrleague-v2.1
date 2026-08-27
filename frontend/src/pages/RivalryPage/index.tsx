import { useMemo } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useRivalry, type RivalryTotals } from "../../hooks/useRivalry";
import { resolveRivalryColors } from "../../utils/rivalryColors";
import { displayImage } from "../../utils/displayImage";
import { Loader } from "../../components/Loader";
import { MomentumChart } from "./MomentumChart";
import "./style.css";

type StatRow = {
  label: string;
  a: number | null;
  b: number | null;
  /** lower value wins the row (finishing positions) */
  lowerWins?: boolean;
  format?: (v: number) => string;
};

function buildRows(a: RivalryTotals, b: RivalryTotals): StatRow[] {
  return [
    { label: "Points", a: a.points, b: b.points },
    { label: "Wins", a: a.wins, b: b.wins },
    { label: "Podiums", a: a.podiums, b: b.podiums },
    { label: "Poles", a: a.poles, b: b.poles },
    { label: "Fastest laps", a: a.fastest_laps, b: b.fastest_laps },
    { label: "Driver of the day", a: a.dotd, b: b.dotd },
    { label: "Avg finish", a: a.avg_finish, b: b.avg_finish, lowerWins: true, format: (v) => v.toFixed(2) },
    { label: "Best finish", a: a.best_finish, b: b.best_finish, lowerWins: true, format: (v) => `P${v}` },
    { label: "DNFs", a: a.dnfs, b: b.dnfs, lowerWins: true },
  ];
}

export const RivalryPage = () => {
  const { driverA, driverB } = useParams();
  const rawA = Number(driverA);
  const rawB = Number(driverB);
  const [lo, hi] = [Math.min(rawA, rawB), Math.max(rawA, rawB)];
  const canonical = rawA === lo;

  const { data, isLoading, error } = useRivalry(lo, hi, canonical && rawA !== rawB);

  const palette = useMemo(
    () => resolveRivalryColors(data?.driver_a.team.color, data?.driver_b.team.color),
    [data?.driver_a.team.color, data?.driver_b.team.color]
  );

  if (!Number.isFinite(rawA) || !Number.isFinite(rawB) || rawA === rawB) {
    return <Navigate to="/hall-of-fame" replace />;
  }
  // One URL per pair, so the two directions don't split the cache.
  if (!canonical) return <Navigate to={`/rivalry/${lo}/${hi}`} replace />;

  if (isLoading) return <div className="rv-page"><div className="rv-inner"><Loader /></div></div>;
  if (error || !data) {
    return (
      <div className="rv-page">
        <div className="rv-inner"><p className="rv-empty">Couldn't load this rivalry.</p></div>
      </div>
    );
  }

  const { driver_a: A, driver_b: B, totals, streaks, timeline } = data;

  if (data.shared_races === 0) {
    return (
      <div className="rv-page">
        <div className="rv-band">
          <div className="rv-band-inner">
            <Link to="/hall-of-fame" className="rv-back">← ALL HEAD-TO-HEADS</Link>
            <h1 className="rv-title">{A.display_name} <span className="rv-v">v</span> {B.display_name}</h1>
          </div>
        </div>
        <div className="rv-inner">
          <p className="rv-empty">
            These two have never been classified in the same race, so there's nothing to compare yet.
          </p>
        </div>
      </div>
    );
  }

  const rows = buildRows(totals.a, totals.b);
  const aheadA = totals.a.ahead;
  const aheadB = totals.b.ahead;
  const splitPct = (aheadA / data.shared_races) * 100;
  const leader = aheadA === aheadB ? null : aheadA > aheadB ? A : B;

  const imgA = A.profile_image ? displayImage(A.profile_image, "driver") : null;
  const imgB = B.profile_image ? displayImage(B.profile_image, "driver") : null;

  const recent = [...timeline].reverse();

  return (
    <div className="rv-page">
      <div className="rv-band">
        <div className="rv-band-inner">
          <Link to="/hall-of-fame" className="rv-back">← ALL HEAD-TO-HEADS</Link>

      {/* Verdict: the split bar is the headline, not a decorative metric card */}
      <header className="rv-head">
        <div className="rv-fighter rv-fighter--a">
          <div className="rv-avatar" style={{ borderColor: palette.a }}>
            {imgA ? <img src={imgA} alt="" /> : <span>{A.initials}</span>}
          </div>
          <div className="rv-fighter-meta">
            <Link to={`/drivers/${A.id}`} className="rv-fighter-name">{A.display_name}</Link>
            <span className="rv-fighter-team">{A.team.name}</span>
          </div>
          <span className="rv-tally" style={{ color: palette.a }}>{aheadA}</span>
        </div>

        <div className="rv-versus">
          <span className="rv-versus-label">head to head</span>
          <span className="rv-versus-count">{data.shared_races} races</span>
        </div>

        <div className="rv-fighter rv-fighter--b">
          <span className="rv-tally" style={{ color: palette.b }}>{aheadB}</span>
          <div className="rv-fighter-meta">
            <Link to={`/drivers/${B.id}`} className="rv-fighter-name">{B.display_name}</Link>
            <span className="rv-fighter-team">{B.team.name}</span>
          </div>
          <div className="rv-avatar" style={{ borderColor: palette.b }}>
            {imgB ? <img src={imgB} alt="" /> : <span>{B.initials}</span>}
          </div>
        </div>
      </header>

      <div className="rv-split" role="img" aria-label={`${A.display_name} finished ahead ${aheadA} times, ${B.display_name} ${aheadB} times`}>
        <div className="rv-split-a" style={{ width: `${splitPct}%`, background: palette.a }} />
        <div className="rv-split-b" style={{ width: `${100 - splitPct}%`, background: palette.b }} />
      </div>
      <p className="rv-verdict">
        {leader
          ? <>{leader.display_name} leads the head-to-head {Math.max(aheadA, aheadB)}–{Math.min(aheadA, aheadB)}</>
          : <>Dead level at {aheadA}–{aheadB}</>}
        {streaks.current.driver && streaks.current.length > 1 && (
          <> · {(streaks.current.driver === "a" ? A : B).last_name} has won the last {streaks.current.length}</>
        )}
      </p>

      {palette.adjusted && (
        <p className="rv-note">Second colour reassigned: these liveries are too close to read apart.</p>
      )}
        </div>
      </div>

      <div className="rv-inner">
      <MomentumChart
        timeline={timeline}
        nameA={A.last_name || A.display_name}
        nameB={B.last_name || B.display_name}
        colorA={palette.a}
        colorB={palette.b}
      />

      <section className="rv-section">
        <h2 className="rv-h2">IN RACES THEY BOTH FINISHED</h2>
        <div className="rv-panel">
        <table className="rv-stats">
          <caption className="rv-sr">Statistical comparison</caption>
          <thead>
            <tr>
              <th scope="col" className="rv-stats-val">{A.last_name}</th>
              <th scope="col" className="rv-stats-label">Stat</th>
              <th scope="col" className="rv-stats-val">{B.last_name}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const av = r.a;
              const bv = r.b;
              const fmt = r.format ?? ((v: number) => String(v));
              const aWins = av != null && bv != null && (r.lowerWins ? av < bv : av > bv);
              const bWins = av != null && bv != null && (r.lowerWins ? bv < av : bv > av);
              const total = (av ?? 0) + (bv ?? 0);
              const aShare = total > 0 ? ((av ?? 0) / total) * 100 : 50;
              return (
                <tr key={r.label}>
                  <td className={"rv-stats-val" + (aWins ? " is-win" : "")}>
                    {av == null ? "—" : fmt(av)}
                  </td>
                  <td className="rv-stats-label">
                    <span className="rv-stats-name">{r.label}</span>
                    <span className="rv-bar">
                      <span className="rv-bar-a" style={{ width: `${aShare}%`, background: palette.a }} />
                      <span className="rv-bar-b" style={{ width: `${100 - aShare}%`, background: palette.b }} />
                    </span>
                  </td>
                  <td className={"rv-stats-val" + (bWins ? " is-win" : "")}>
                    {bv == null ? "—" : fmt(bv)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </section>

      <div className="rv-cols">
        <section className="rv-section">
          <h2 className="rv-h2">SEASON BY SEASON</h2>
          <div className="rv-panel">
          <ul className="rv-seasons">
            {data.seasons.map((s) => {
              const pct = (s.a_ahead / s.races) * 100;
              return (
                <li key={s.season_id} className="rv-season">
                  <Link to={`/seasons/${s.season_id}`} className="rv-season-id">S{s.season_id}</Link>
                  <span className="rv-season-score" style={{ color: s.a_ahead >= s.b_ahead ? palette.a : palette.b }}>
                    {s.a_ahead}–{s.b_ahead}
                  </span>
                  <span className="rv-bar rv-bar--thin">
                    <span style={{ width: `${pct}%`, background: palette.a }} />
                    <span style={{ width: `${100 - pct}%`, background: palette.b }} />
                  </span>
                  <span className="rv-season-pts">{s.a_points}–{s.b_points} pts</span>
                </li>
              );
            })}
          </ul>
          </div>
        </section>

        <section className="rv-section">
          <h2 className="rv-h2">CIRCUIT OWNERSHIP</h2>
          <div className="rv-panel">
          <ul className="rv-tracks">
            {data.tracks.slice(0, 10).map((t) => {
              const owner = t.a_ahead === t.b_ahead ? null : t.a_ahead > t.b_ahead ? "a" : "b";
              return (
                <li key={t.track_id} className="rv-track">
                  <Link to={`/tracks/${t.track_id}`} className="rv-track-name">{t.name}</Link>
                  <span className="rv-track-score">
                    <span style={{ color: owner === "a" ? palette.a : "inherit", fontWeight: owner === "a" ? 700 : 400 }}>{t.a_ahead}</span>
                    <span className="rv-track-dash">–</span>
                    <span style={{ color: owner === "b" ? palette.b : "inherit", fontWeight: owner === "b" ? 700 : 400 }}>{t.b_ahead}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          </div>
        </section>
      </div>

      <section className="rv-section">
        <h2 className="rv-h2">NOTES</h2>
        <div className="rv-panel">
        <ul className="rv-notes">
          <li><b>{data.closest_races}</b> races decided by a single position</li>
          {data.biggest_margin && (
            <li>Widest gap: <b>{data.biggest_margin.margin}</b> positions</li>
          )}
          <li>Longest run: <b>{streaks.best_a}</b> ({A.last_name}) · <b>{streaks.best_b}</b> ({B.last_name})</li>
          {data.teammate_seasons.length > 0 && (
            <li>
              Teammates in {data.teammate_seasons.map((s) => `S${s}`).join(", ")}
            </li>
          )}
        </ul>
        </div>
      </section>

      <section className="rv-section">
        <h2 className="rv-h2">EVERY MEETING</h2>
        <div className="rv-panel">
        <div className="rv-log-scroll">
          <table className="rv-log">
            <thead>
              <tr>
                <th scope="col">Race</th>
                <th scope="col" className="rv-log-num">{A.initials}</th>
                <th scope="col" className="rv-log-num">{B.initials}</th>
                <th scope="col">Won by</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((t) => {
                const w = t.winner === "a" ? A : B;
                return (
                  <tr key={`${t.race_id}-${t.season_id}`}>
                    <th scope="row" className="rv-log-race">
                      <Link to={`/seasons/${t.season_id}/races/${t.round}`}>
                        <span className="rv-log-season">S{t.season_id}</span> {t.track}
                        {t.is_sprint && <span className="rv-log-sprint">Sprint</span>}
                      </Link>
                    </th>
                    <td className={"rv-log-num" + (t.winner === "a" ? " is-win" : "")}>P{t.a_finish}</td>
                    <td className={"rv-log-num" + (t.winner === "b" ? " is-win" : "")}>P{t.b_finish}</td>
                    <td className="rv-log-by">
                      <span className="rv-dot" style={{ background: t.winner === "a" ? palette.a : palette.b }} />
                      {w.last_name} <span className="rv-log-margin">+{t.margin}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </div>
      </section>
      </div>
    </div>
  );
};
