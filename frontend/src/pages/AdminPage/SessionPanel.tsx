import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminApi, type SessionGenerated, type SessionRace } from "../../api/admin";
import { ApiError } from "../../api/client";

const MIN_RACES = 2;
const MAX_RACES = 5;

function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    const payload = err.payload as { detail?: string } | null;
    if (payload?.detail) return payload.detail;
    return err.status === 401 ? "Your session has expired — log out and back in." : `Server returned ${err.status}.`;
  }
  return "Could not reach the server.";
}

function raceLabel(r: SessionRace): string {
  return `R${r.round}${r.is_sprint ? " Sprint" : ""} — ${r.track.name}`;
}

/**
 * A session is always a consecutive run of races, so selection is modelled as a
 * run rather than a free set: clicking inside or beside the run grows or trims
 * it, and clicking anywhere else starts a new one. That makes an invalid
 * selection unreachable instead of something to validate after the fact.
 */
function nextSelection(selected: number[], index: number): number[] {
  if (selected.length === 0) return [index];

  const first = selected[0];
  const last = selected[selected.length - 1];

  if (selected.includes(index)) {
    if (selected.length === 1) return [];
    if (index === first) return selected.slice(1);
    if (index === last) return selected.slice(0, -1);
    return [index];
  }
  if (selected.length >= MAX_RACES) return [index];
  if (index === first - 1) return [index, ...selected];
  if (index === last + 1) return [...selected, index];
  return [index];
}

export function SessionPanel({ token, seasonId }: { token: string; seasonId: number }) {
  const [races, setRaces] = useState<SessionRace[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SessionGenerated | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    adminApi.getSessionRaces(token, seasonId)
      .then((data) => {
        setRaces(data);
        setLoadError(null);
        setNotes(Object.fromEntries(data.map((r) => [r.id, r.race_notes])));
      })
      .catch((err) => {
        setRaces(null);
        setLoadError(errorText(err));
      });
  }, [token, seasonId]);

  useEffect(() => {
    setSelected([]);
    setResult(null);
    setError(null);
    load();
  }, [load]);

  const chosen = (races ?? []).filter((_, i) => selected.includes(i));
  const unscored = chosen.filter((r) => r.result_count === 0);
  const alreadyCovered = chosen.filter((r) => r.session_article !== null);

  const blocker =
    selected.length < MIN_RACES ? `Pick at least ${MIN_RACES} races.`
    : unscored.length > 0 ? `No results entered for ${unscored.map(raceLabel).join(", ")}.`
    : null;

  async function handleGenerate() {
    if (blocker) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const out = await adminApi.generateSession(token, {
        race_ids: chosen.map((r) => r.id),
        notes: Object.fromEntries(chosen.map((r) => [String(r.id), notes[r.id] ?? ""])),
      });
      setResult(out);
      load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="adm-panel">
      <label className="adm-label">Session report</label>
      <p className="adm-hint">
        One article across {MIN_RACES}–{MAX_RACES} races run back to back in a single
        sitting. Click a race to start a session, then click the one beside it to extend.
        Notes are saved to each race and fed to the writer as fact.
      </p>

      {loadError && <p className="adm-err">{loadError}</p>}

      {races && (
        <>
          <div className="adm-ses-races">
            {races.map((r, i) => {
              const pos = selected.indexOf(i);
              const isOn = pos >= 0;
              return (
                <button
                  key={r.id}
                  type="button"
                  className={`adm-ses-race${isOn ? " is-on" : ""}`}
                  onClick={() => setSelected((sel) => nextSelection(sel, i))}
                  disabled={busy}
                >
                  <span className="adm-ses-race-order">{isOn ? pos + 1 : ""}</span>
                  <span className="adm-ses-race-label">{raceLabel(r)}</span>
                  <span className="adm-ses-race-state">
                    {r.result_count === 0 ? "no results" : `${r.result_count} entered`}
                    {r.session_article && " · in a session"}
                  </span>
                </button>
              );
            })}
          </div>

          {chosen.length > 0 && (
            <div className="adm-ses-notes">
              {chosen.map((r) => (
                <div key={r.id} className="adm-ses-note">
                  <label className="adm-ses-note-label" htmlFor={`adm-ses-note-${r.id}`}>
                    {raceLabel(r)} — notes
                  </label>
                  <textarea
                    id={`adm-ses-note-${r.id}`}
                    className="adm-ses-note-input"
                    rows={2}
                    value={notes[r.id] ?? ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                    placeholder="Incidents, penalties, anything the writer should treat as fact."
                    disabled={busy}
                  />
                </div>
              ))}
            </div>
          )}

          {alreadyCovered.length > 0 && (
            <p className="adm-hint">
              {alreadyCovered.map(raceLabel).join(", ")} already appear in a session report.
            </p>
          )}

          <div className="adm-ses-actions">
            <button
              type="button"
              className="adm-submit"
              onClick={handleGenerate}
              disabled={busy || blocker !== null}
            >
              {busy ? "Writing…" : `Generate session report (${selected.length} races)`}
            </button>
            {blocker && !busy && <span className="adm-hint">{blocker}</span>}
            {busy && <span className="adm-hint">This takes a couple of minutes — leave the tab open.</span>}
          </div>

          {error && <p className="adm-err">{error}</p>}
          {result && (
            <p className="adm-ok">
              Created “{result.title}” —{" "}
              <Link to={`/articles/${result.article_id}`}>read it →</Link>
            </p>
          )}
        </>
      )}
    </div>
  );
}
