import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { ArticleDetail, ArticleSummary } from "../../hooks/useArticles";
import type {
  PreRaceContext,
  RaceDetail,
  TrackHistoryRow,
} from "../../hooks/useRaceDetail";
import { displayImage } from "../../utils/displayImage";
import { CircuitHistory } from "./RacePanels";

type Props = {
  race: RaceDetail;
  seasonId: string;
  context: PreRaceContext;
  history: TrackHistoryRow[];
  preview: ArticleSummary | null;
  previewDetail: ArticleDetail | null;
};

function useCountdown(target: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [target]);

  if (!target) return null;
  const seconds = Math.floor((new Date(target).getTime() - now) / 1000);
  if (seconds <= 0) return { passed: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    passed: false,
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  };
}

function formClass(value: number | null | "DNF") {
  if (value === "DNF" || value == null) return "is-dnf";
  if (value === 1) return "is-win";
  if (value <= 3) return "is-podium";
  if (value <= 10) return "is-points";
  return "";
}

function formLabel(value: number | null | "DNF") {
  return value === "DNF" || value == null ? "DNF" : `P${value}`;
}

export function PreRaceCentre({ race, seasonId, context, history, preview, previewDetail }: Props) {
  const countdown = useCountdown(race.started_at);
  const raceDate = race.started_at
    ? new Intl.DateTimeFormat(undefined, {
        weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
      }).format(new Date(race.started_at))
    : null;
  const standings = context.standings.slice(0, 6);
  const leaderPoints = standings[0]?.points ?? 0;
  const sidebar = previewDetail?.preview_sidebar;
  const distanceKm = race.track.distance ? race.track.distance / 1000 : null;
  const raceDistance = distanceKm && race.laps ? distanceKm * race.laps : null;

  return (
    <section className="rp-prerace" aria-labelledby="race-weekend-title">
      <div className="rp-prerace-mast">
        <div>
          <span className="rp-prerace-kicker">RACE WEEKEND BRIEFING</span>
          <h2 id="race-weekend-title">Everything before lights out</h2>
          <p>{raceDate ?? "Start time to be confirmed"}</p>
        </div>
        <div className="rp-countdown" aria-label={countdown?.passed ? "Scheduled start time has passed" : "Countdown to race start"}>
          {!countdown ? (
            <span className="rp-countdown-tbd">DATE<br />TBD</span>
          ) : countdown.passed ? (
            <span className="rp-countdown-tbd">START<br />IMMINENT</span>
          ) : (
            [
              [countdown.days, "DAYS"],
              [countdown.hours, "HRS"],
              [countdown.minutes, "MIN"],
              [countdown.seconds, "SEC"],
            ].map(([value, label]) => (
              <span className="rp-countdown-cell" key={label}>
                <b>{String(value).padStart(2, "0")}</b><small>{label}</small>
              </span>
            ))
          )}
        </div>
      </div>

      {preview && (
        <article className="rp-preview-feature">
          <div className="rp-preview-copy">
            <span className="rp-panel-title">THE PREVIEW</span>
            <h3>{preview.title}</h3>
            <p>{preview.teaser}</p>
            <Link to={`/articles/${preview.id}`}>Read the full preview →</Link>
          </div>
          {sidebar?.head_to_head && (
            <div className="rp-preview-battle">
              <span>BATTLE TO WATCH</span>
              <strong>{sidebar.head_to_head.driver_a} <i>v</i> {sidebar.head_to_head.driver_b}</strong>
              <p>{sidebar.head_to_head.context}</p>
            </div>
          )}
        </article>
      )}

      {sidebar?.drivers_to_watch && sidebar.drivers_to_watch.length > 0 && (
        <div className="rp-watch-strip">
          <span className="rp-panel-title">DRIVERS TO WATCH</span>
          <div className="rp-watch-grid">
            {sidebar.drivers_to_watch.map((driver) => (
              <div className="rp-watch-card" key={driver.name}>
                <strong>{driver.name}</strong>
                <b>{driver.stat}</b>
                <p>{driver.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rp-prerace-grid">
        <section className="rp-panel rp-form-panel">
          <div className="rp-panel-heading">
            <h3 className="rp-panel-title">CHAMPIONSHIP PICTURE</h3>
            <span>{context.completed_races ? `AFTER ${context.completed_races} SESSION${context.completed_races === 1 ? "" : "S"}` : "SEASON OPENER"}</span>
          </div>
          {context.completed_races === 0 ? (
            <p className="rp-prerace-note">The field starts level. Championship form will appear after the opening round.</p>
          ) : (
            <ol className="rp-form-table">
              {standings.map((row) => (
                <li key={row.driver.id}>
                  <span className="rp-form-pos">P{row.position}</span>
                  <span className="rp-form-avatar">
                    {row.driver.profile_image && <img src={displayImage(row.driver.profile_image, "driver")} alt="" />}
                  </span>
                  <span className="rp-form-driver">
                    <Link to={`/drivers/${row.driver.id}`}>{row.driver.display_name}</Link>
                    <small>{row.team.name}</small>
                  </span>
                  <span className="rp-form-dots" aria-label={`Recent form for ${row.driver.display_name}`}>
                    {row.form.map((value, index) => <i className={formClass(value)} key={index}>{formLabel(value)}</i>)}
                  </span>
                  <span className="rp-form-points">
                    <b>{row.points}</b><small>{row.position === 1 ? "PTS" : `−${leaderPoints - row.points}`}</small>
                  </span>
                </li>
              ))}
            </ol>
          )}
          <Link className="rp-panel-link" to={`/seasons/${seasonId}`}>Full championship →</Link>
        </section>

        <section className="rp-panel">
          <div className="rp-panel-heading">
            <h3 className="rp-panel-title">CIRCUIT SPECIALISTS</h3>
            <span>ALL-TIME AT {race.track.name.toUpperCase()}</span>
          </div>
          {context.circuit_specialists.length ? (
            <ol className="rp-specialists">
              {context.circuit_specialists.map((row, index) => (
                <li key={row.driver.id}>
                  <span className="rp-specialist-rank">0{index + 1}</span>
                  <span className="rp-form-avatar">
                    {row.driver.profile_image && <img src={displayImage(row.driver.profile_image, "driver")} alt="" />}
                  </span>
                  <span className="rp-specialist-driver">
                    <Link to={`/drivers/${row.driver.id}`}>{row.driver.display_name}</Link>
                    <small>{row.races} START{row.races === 1 ? "" : "S"} · AVG {row.avg_finish?.toFixed(1) ?? "—"}</small>
                  </span>
                  <span className="rp-specialist-stat"><b>{row.wins}</b><small>WINS</small></span>
                  <span className="rp-specialist-stat"><b>{row.podiums}</b><small>PODS</small></span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rp-prerace-note">A first visit for this field—there is no established circuit specialist yet.</p>
          )}
          <Link className="rp-panel-link" to={`/tracks/${race.track.id}`}>Full track record →</Link>
        </section>

        <CircuitHistory rows={history} trackName={race.track.name} />

        <section className="rp-panel">
          <h3 className="rp-panel-title">WEEKEND NOTES</h3>
          <dl className="rp-weekend-facts">
            <div><dt>Round</dt><dd>{String(race.round).padStart(2, "0")}</dd></div>
            <div><dt>Format</dt><dd>{race.is_sprint ? "Sprint" : "Grand Prix"}</dd></div>
            <div><dt>Track length</dt><dd>{distanceKm ? `${distanceKm.toFixed(3)} km` : "—"}</dd></div>
            <div><dt>Race distance</dt><dd>{raceDistance ? `${raceDistance.toFixed(1)} km` : race.laps ? `${race.laps} laps` : "—"}</dd></div>
            <div><dt>Previous winners</dt><dd>{history.length}</dd></div>
            <div><dt>Championship leader</dt><dd>{context.completed_races ? standings[0]?.driver.display_name ?? "—" : "Level field"}</dd></div>
          </dl>
        </section>
      </div>
    </section>
  );
}
