import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminApi, type NewsletterOverview, type RaceInfo, type SessionRace } from "../../api/admin";
import { ApiError } from "../../api/client";
import { useAdmin } from "./adminContext";

function errorText(err: unknown): string {
  if (err instanceof ApiError && err.status === 401) return "Your session has expired — log out and back in.";
  return "The operations overview could not be loaded.";
}

export function AdminOverviewPage() {
  const { token, seasonId, season } = useAdmin();
  const [races, setRaces] = useState<RaceInfo[]>([]);
  const [sessions, setSessions] = useState<SessionRace[]>([]);
  const [newsletter, setNewsletter] = useState<NewsletterOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (seasonId == null) return;
    Promise.all([
      adminApi.getRaces(token, seasonId),
      adminApi.getSessionRaces(token, seasonId),
      adminApi.getNewsletter(token, seasonId),
    ])
      .then(([raceData, sessionData, newsletterData]) => {
        setRaces(raceData);
        setSessions(sessionData);
        setNewsletter(newsletterData);
        setError(null);
      })
      .catch((err) => setError(errorText(err)));
  }, [token, seasonId]);

  const nextUnentered = races.find((race) => race.result_count === 0) ?? null;
  const latestEntered = [...races].reverse().find((race) => race.result_count > 0) ?? null;
  const latestNewsletterRace = newsletter?.races.find((race) => race.id === latestEntered?.id) ?? null;
  const uncoveredRaces = sessions.filter((race) => race.result_count > 0 && !race.session_article);

  return (
    <div className="adm-overview">
      {error && <div className="adm-panel adm-alert">{error}</div>}

      <section className="adm-overview-intro">
        <div>
          <span className="adm-label">Season status</span>
          <p className="adm-overview-lede">
            Season {seasonId} is <strong>{season?.races_entered ?? 0} of {season?.race_count ?? 0}</strong> races entered.
          </p>
        </div>
        <Link className="adm-secondary-action" to="/admin/races">Open race control →</Link>
      </section>

      <div className="adm-ops-list">
        <article className="adm-op-row">
          <span className={`adm-op-mark${nextUnentered ? " is-action" : " is-done"}`}>{nextUnentered ? "01" : "✓"}</span>
          <div className="adm-op-copy">
            <span className="adm-op-kicker">Results</span>
            <h2>{nextUnentered ? `R${nextUnentered.round}${nextUnentered.is_sprint ? " Sprint" : ""} — ${nextUnentered.track.name}` : "All scheduled results are entered"}</h2>
            <p>{nextUnentered ? "This is the next race without a classified result." : "Race control has no outstanding rounds."}</p>
          </div>
          <Link className="adm-op-action" to="/admin/races">{nextUnentered ? "Enter results" : "Review races"} →</Link>
        </article>

        <article className="adm-op-row">
          <span className={`adm-op-mark${uncoveredRaces.length ? " is-action" : " is-done"}`}>{uncoveredRaces.length || "✓"}</span>
          <div className="adm-op-copy">
            <span className="adm-op-kicker">Session reports</span>
            <h2>{uncoveredRaces.length ? `${uncoveredRaces.length} completed race${uncoveredRaces.length === 1 ? "" : "s"} not in a session report` : "Completed races are covered"}</h2>
            <p>Combine consecutive league races into a single published session story.</p>
          </div>
          <Link className="adm-op-action" to="/admin/publishing/sessions">Open reports →</Link>
        </article>

        <article className="adm-op-row">
          <span className={`adm-op-mark${latestNewsletterRace && !latestNewsletterRace.recap.sent_at ? " is-action" : " is-done"}`}>
            {latestNewsletterRace && !latestNewsletterRace.recap.sent_at ? "!" : "✓"}
          </span>
          <div className="adm-op-copy">
            <span className="adm-op-kicker">Newsletter</span>
            <h2>
              {!latestEntered ? "No completed race to recap yet"
                : latestNewsletterRace?.recap.sent_at ? `Latest recap sent · R${latestEntered.round} ${latestEntered.track.name}`
                : `R${latestEntered.round} ${latestEntered.track.name} recap has not been sent`}
            </h2>
            <p>{newsletter?.subscriber_count ?? 0} confirmed subscriber{newsletter?.subscriber_count === 1 ? "" : "s"} on the list.</p>
          </div>
          <Link className="adm-op-action" to="/admin/publishing/newsletters">Manage newsletter →</Link>
        </article>

        <article className="adm-op-row">
          <span className="adm-op-mark">{races.length}</span>
          <div className="adm-op-copy">
            <span className="adm-op-kicker">Season setup</span>
            <h2>{races.length} race entries in this season</h2>
            <p>Review the driver grid and manage reserve seats.</p>
          </div>
          <Link className="adm-op-action" to="/admin/season/grid">Manage grid →</Link>
        </article>
      </div>
    </div>
  );
}
