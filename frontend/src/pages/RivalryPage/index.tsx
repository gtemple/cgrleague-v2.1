import { useMemo } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useRivalry, type RivalryTotals } from "../../hooks/useRivalry";
import { useDriversList } from "../../hooks/useDriverList";
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

function buildTrackedRows(a: RivalryTotals, b: RivalryTotals): StatRow[] {
  const rows: StatRow[] = [];
  if (a.grid_races || b.grid_races) {
    rows.push(
      { label: "Avg grid", a: a.avg_grid, b: b.avg_grid, lowerWins: true, format: (v) => v.toFixed(2) },
      {
        label: "Avg places gained",
        a: a.avg_positions_gained,
        b: b.avg_positions_gained,
        format: (v) => (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2)),
      },
    );
  }
  if (a.cleanest_driver || b.cleanest_driver) {
    rows.push({ label: "Cleanest driver", a: a.cleanest_driver, b: b.cleanest_driver });
  }
  if (a.most_overtakes || b.most_overtakes) {
    rows.push({ label: "Most overtakes", a: a.most_overtakes, b: b.most_overtakes });
  }
  return rows;
}

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

function StatTable({
  rows, labelA, labelB, colorA, colorB,
}: { rows: StatRow[]; labelA: string; labelB: string; colorA: string; colorB: string }) {
  return (
    <table className="rv-stats">
      <caption className="rv-sr">Statistical comparison</caption>
      <thead>
        <tr>
          <th scope="col" className="rv-stats-val">{labelA}</th>
          <th scope="col" className="rv-stats-label">Stat</th>
          <th scope="col" className="rv-stats-val">{labelB}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const av = r.a;
          const bv = r.b;
          const fmt = r.format ?? ((v: number) => String(v));
          const aWins = av != null && bv != null && (r.lowerWins ? av < bv : av > bv);
          const bWins = av != null && bv != null && (r.lowerWins ? bv < av : bv > av);
          const magA = Math.abs(av ?? 0);
          const magB = Math.abs(bv ?? 0);
          const total = magA + magB;
          // On lower-is-better rows the raw share would hand the longer bar to
          // the worse value, so flip it and let the bar always favour the winner.
          const aShare = total > 0 ? ((r.lowerWins ? magB : magA) / total) * 100 : 50;
          return (
            <tr key={r.label}>
              <td className={"rv-stats-val" + (aWins ? " is-win" : "")}>
                {av == null ? "—" : fmt(av)}
              </td>
              <td className="rv-stats-label">
                <span className="rv-stats-name">{r.label}</span>
                <span className="rv-bar">
                  <span className="rv-bar-a" style={{ width: `${aShare}%`, background: colorA }} />
                  <span className="rv-bar-b" style={{ width: `${100 - aShare}%`, background: colorB }} />
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
  );
}

function seasonList(seasons: number[]) {
  return seasons.map((s) => `S${s}`).join(", ");
}

export const RivalryPage = () => {
  const { driverA, driverB } = useParams();
  const navigate = useNavigate();
  const { data: driverList } = useDriversList();
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
  const trackedRows = buildTrackedRows(totals.a, totals.b);
  const trackedSeasons = seasonList(
    [...new Set([...data.tracked.grid, ...data.tracked.cleanest, ...data.tracked.overtakes])].sort((x, y) => x - y)
  );
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

      <div className="rv-swap">
        <label className="rv-swap-field">
          <span className="rv-sr">Replace {A.display_name}</span>
          <select
            className="rv-picker"
            value={String(A.id)}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (next && next !== B.id) navigate(`/rivalry/${Math.min(next, B.id)}/${Math.max(next, B.id)}`);
            }}
          >
            {(driverList ?? []).map((d) => (
              <option key={d.id} value={String(d.id)} disabled={d.id === B.id}>
                {d.display_name}
              </option>
            ))}
          </select>
        </label>
        <span className="rv-swap-v">v</span>
        <label className="rv-swap-field">
          <span className="rv-sr">Replace {B.display_name}</span>
          <select
            className="rv-picker"
            value={String(B.id)}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (next && next !== A.id) navigate(`/rivalry/${Math.min(next, A.id)}/${Math.max(next, A.id)}`);
            }}
          >
            {(driverList ?? []).map((d) => (
              <option key={d.id} value={String(d.id)} disabled={d.id === A.id}>
                {d.display_name}
              </option>
            ))}
          </select>
        </label>
      </div>

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
          <StatTable rows={rows} labelA={A.last_name} labelB={B.last_name} colorA={palette.a} colorB={palette.b} />
        </div>
      </section>

      {trackedRows.length > 0 && (
        <section className="rv-section">
          <h2 className="rv-h2">NEWER STATS</h2>
          <div className="rv-panel">
            <p className="rv-scope">
              The league started recording these part-way through its history, so they
              cover {data.tracked.grid_races} of the {data.shared_races} races these two
              shared{trackedSeasons ? ` (${trackedSeasons})` : ""}. The set widens as more
              seasons are logged.
            </p>
            <StatTable rows={trackedRows} labelA={A.last_name} labelB={B.last_name} colorA={palette.a} colorB={palette.b} />
          </div>
        </section>
      )}

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
