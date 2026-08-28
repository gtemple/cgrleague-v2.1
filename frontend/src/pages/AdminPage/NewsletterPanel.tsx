import { useCallback, useEffect, useState } from "react";
import {
  adminApi,
  type NewsletterIssueState,
  type NewsletterKind,
  type NewsletterOverview,
  type NewsletterRace,
  type RenderedIssue,
} from "../../api/admin";
import { ApiError } from "../../api/client";

const KINDS: { kind: NewsletterKind; title: string; blurb: string }[] = [
  { kind: "PREVIEW", title: "Preview", blurb: "Goes out before the race — preview article, head to head, drivers to watch." },
  { kind: "RECAP", title: "Recap", blurb: "Goes out after the race — recap article, podium, championship, what's next." },
  { kind: "SESSION", title: "Session summary", blurb: "Goes out after a run of races — the day race by race, the points it paid, and the championship swing." },
];

function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    const payload = err.payload as { detail?: string } | null;
    if (payload?.detail) return payload.detail;
    return err.status === 401 ? "Your session has expired — log out and back in." : `Server returned ${err.status}.`;
  }
  return "Could not reach the server.";
}

function formatSent(at: string): string {
  return new Date(at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function kindNoun(kind: NewsletterKind): string {
  return kind === "SESSION" ? "session summary" : kind.toLowerCase();
}

function raceLabel(r: NewsletterRace): string {
  return `R${r.round}${r.is_sprint ? " Sprint" : ""} — ${r.track.name}`;
}

type Fact = { tone: "is-ok" | "is-warn" | ""; mark: string; text: string };

function articleFact(kind: NewsletterKind, state: NewsletterIssueState): Fact {
  const label = kind === "SESSION" ? "session report" : kind.toLowerCase();
  return state.has_article
    ? { tone: "is-ok", mark: "✓", text: `${label} generated` }
    : { tone: "is-warn", mark: "!", text: `no ${label} — the issue will go out without it` };
}

/** A recap of a race with no results is an empty podium; a preview of one
 *  already run is a preview of the past. Neither blocks a send — both should
 *  be visible before you make one. */
function timingFact(kind: NewsletterKind, race: NewsletterRace): Fact {
  const raced = race.result_count > 0;
  if (kind === "SESSION") {
    return race.session.has_article
      ? { tone: "is-ok", mark: "✓", text: "a session ends on this race" }
      : { tone: "is-warn", mark: "!", text: "no session is filed under this race — generate one above first" };
  }
  if (kind === "RECAP") {
    return raced
      ? { tone: "is-ok", mark: "✓", text: `${race.result_count} results entered` }
      : { tone: "is-warn", mark: "!", text: "no results entered — podium and standings will be empty" };
  }
  return raced
    ? { tone: "is-warn", mark: "!", text: "this race has already been run" }
    : { tone: "is-ok", mark: "✓", text: "not raced yet" };
}

export function NewsletterPanel({ token, seasonId }: { token: string; seasonId: number }) {
  const [overview, setOverview] = useState<NewsletterOverview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [raceId, setRaceId] = useState<number | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Partial<Record<NewsletterKind, { ok: boolean; text: string }>>>({});
  const [rendered, setRendered] = useState<(RenderedIssue & { kind: NewsletterKind }) | null>(null);

  const load = useCallback(
    (keepRace: boolean) => {
      adminApi.getNewsletter(token, seasonId)
        .then((data) => {
          setOverview(data);
          setLoadError(null);
          if (keepRace) return;
          // Default to the most recent race that has been run — the recap of it
          // is the send you are usually here for.
          const raced = [...data.races].reverse().find((r) => r.result_count > 0);
          setRaceId((raced ?? data.races[0])?.id ?? null);
        })
        .catch((err) => {
          setOverview(null);
          setLoadError(errorText(err));
        });
    },
    [token, seasonId],
  );

  useEffect(() => {
    setNotes({});
    load(false);
  }, [load]);

  useEffect(() => {
    if (!rendered) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setRendered(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rendered]);

  const race = overview?.races.find((r) => r.id === raceId) ?? null;
  const subscribers = overview?.subscriber_count ?? 0;

  async function handlePreview(kind: NewsletterKind) {
    if (!race) return;
    setBusy(`${kind}:preview`);
    try {
      const issue = await adminApi.renderIssue(token, race.id, kind);
      setRendered({ ...issue, kind });
    } catch (err) {
      setNotes((n) => ({ ...n, [kind]: { ok: false, text: errorText(err) } }));
    } finally {
      setBusy(null);
    }
  }

  async function handleTest(kind: NewsletterKind) {
    if (!race || !testEmail.trim()) return;
    setBusy(`${kind}:test`);
    try {
      const out = await adminApi.sendIssue(token, { race_id: race.id, kind, test_to: testEmail.trim() });
      setNotes((n) => ({ ...n, [kind]: { ok: true, text: out.detail } }));
    } catch (err) {
      setNotes((n) => ({ ...n, [kind]: { ok: false, text: errorText(err) } }));
    } finally {
      setBusy(null);
    }
  }

  async function handleSend(kind: NewsletterKind, state: NewsletterIssueState) {
    if (!race) return;
    const resend = state.sent_at !== null;
    const warnings = [timingFact(kind, race), articleFact(kind, state)].filter((f) => f.tone === "is-warn");
    const question = [
      resend
        ? `This ${kindNoun(kind)} already went out on ${formatSent(state.sent_at!)}. Send it again to all ${subscribers} subscriber(s)?`
        : `Send the ${kind === "SESSION" ? "session summary" : `${race.track.name} ${kindNoun(kind)}`} to all ${subscribers} subscriber(s)? This cannot be undone.`,
      ...warnings.map((w) => `\n· ${w.text}`),
    ].join("");
    if (!window.confirm(question)) return;

    setBusy(`${kind}:send`);
    try {
      const out = await adminApi.sendIssue(token, { race_id: race.id, kind, force: resend });
      setNotes((n) => ({ ...n, [kind]: { ok: true, text: out.detail } }));
      load(true);
    } catch (err) {
      setNotes((n) => ({ ...n, [kind]: { ok: false, text: errorText(err) } }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="adm-panel">
      <div className="adm-news-head">
        <div>
          <label className="adm-label" htmlFor="adm-news-race">Newsletter</label>
          <p className="adm-hint" style={{ margin: 0 }}>
            Read an issue before it goes anywhere, send yourself a test copy, then fire it
            at the list.
          </p>
        </div>
        <span className="adm-news-count">
          {subscribers} confirmed subscriber{subscribers === 1 ? "" : "s"}
        </span>
      </div>

      {loadError && <p className="adm-err adm-news-note">{loadError}</p>}

      {overview && (
        <>
          <div className="adm-news-controls">
            <select
              id="adm-news-race"
              className="adm-select adm-news-race"
              value={raceId ?? ""}
              onChange={(e) => {
                setRaceId(e.target.value ? parseInt(e.target.value, 10) : null);
                setNotes({});
              }}
            >
              <option value="">— choose a race —</option>
              {overview.races.map((r) => (
                <option key={r.id} value={r.id}>{raceLabel(r)}</option>
              ))}
            </select>

            <input
              className="adm-news-email"
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="test copy to…"
              aria-label="Test recipient address"
            />
          </div>

          {race && (
            <div className="adm-news-cards">
              {KINDS.filter((k) => k.kind !== "SESSION" || race.session.has_article).map(({ kind, title, blurb }) => {
                const state =
                  kind === "RECAP" ? race.recap : kind === "PREVIEW" ? race.preview : race.session;
                const note = notes[kind];
                const isBusy = busy?.startsWith(`${kind}:`);
                return (
                  <div key={kind} className={"adm-news-card" + (state.sent_at ? " is-sent" : "")}>
                    <h3 className="adm-news-title">{title}</h3>
                    <p className="adm-news-blurb">{blurb}</p>

                    <ul className="adm-news-facts">
                      {[
                        articleFact(kind, state),
                        timingFact(kind, race),
                        state.sent_at
                          ? { tone: "is-ok" as const, mark: "✓", text: `sent ${formatSent(state.sent_at)} to ${state.recipient_count}` }
                          : { tone: "" as const, mark: "·", text: "not sent" },
                      ].map((f) => (
                        <li key={f.text} className={f.tone}>
                          <span className="adm-news-mark">{f.mark}</span>
                          {f.text}
                        </li>
                      ))}
                    </ul>

                    <div className="adm-news-actions">
                      <button
                        className="adm-news-btn"
                        onClick={() => handlePreview(kind)}
                        disabled={isBusy}
                      >
                        {busy === `${kind}:preview` ? "Rendering…" : "Preview"}
                      </button>
                      <button
                        className="adm-news-btn"
                        onClick={() => handleTest(kind)}
                        disabled={isBusy || !testEmail.trim()}
                        title={testEmail.trim() ? undefined : "Enter a test address first"}
                      >
                        {busy === `${kind}:test` ? "Sending…" : "Send test"}
                      </button>
                      <button
                        className="adm-submit adm-news-send"
                        onClick={() => handleSend(kind, state)}
                        disabled={isBusy || subscribers === 0}
                        title={subscribers === 0 ? "Nobody is subscribed yet" : undefined}
                      >
                        {busy === `${kind}:send`
                          ? "Sending…"
                          : state.sent_at ? "Resend to all" : "Send to all"}
                      </button>
                    </div>

                    {note && (
                      <p className={(note.ok ? "adm-ok" : "adm-err") + " adm-news-note"}>{note.text}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {rendered && (
        <div className="adm-news-modal" role="dialog" aria-modal="true" onClick={() => setRendered(null)}>
          <div className="adm-news-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="adm-news-sheet-head">
              <span className="adm-news-sheet-kind">{rendered.kind.toLowerCase()}</span>
              <span className="adm-news-subject">{rendered.subject}</span>
              <button className="adm-news-close" onClick={() => setRendered(null)} aria-label="Close preview">✕</button>
            </div>
            <iframe className="adm-news-frame" title="Newsletter preview" sandbox="" srcDoc={rendered.html} />
          </div>
        </div>
      )}
    </div>
  );
}
