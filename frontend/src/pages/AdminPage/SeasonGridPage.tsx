import { useCallback, useEffect, useState } from "react";
import { adminApi, type GridDriver, type SeatOptions } from "../../api/admin";
import { ApiError } from "../../api/client";
import { useAdmin } from "./adminContext";

function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    const payload = err.payload as { detail?: string } | null;
    return payload?.detail ?? `Server returned ${err.status}.`;
  }
  return "Could not reach the server.";
}

export function SeasonGridPage() {
  const { token, seasonId } = useAdmin();
  const [grid, setGrid] = useState<GridDriver[]>([]);
  const [options, setOptions] = useState<SeatOptions | null>(null);
  const [driverId, setDriverId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [carNumber, setCarNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (seasonId == null) return;
    Promise.all([
      adminApi.getGrid(token, seasonId),
      adminApi.getSeatOptions(token, seasonId),
    ])
      .then(([nextGrid, nextOptions]) => {
        setGrid(nextGrid);
        setOptions(nextOptions);
        setError(null);
      })
      .catch((err) => setError(errorText(err)));
  }, [token, seasonId]);

  useEffect(() => load(), [load]);

  async function addSeat() {
    if (seasonId == null || !driverId || !teamId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const created = await adminApi.createSeat(token, seasonId, {
        driver_id: Number(driverId),
        team_season_id: Number(teamId),
        car_number: carNumber ? Number(carNumber) : null,
      });
      setMessage(`${created.driver} added at ${created.team}.`);
      setDriverId("");
      setCarNumber("");
      load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function removeSeat(driver: GridDriver) {
    if (seasonId == null) return;
    const name = `${driver.driver.first_name} ${driver.driver.last_name}`.trim();
    if (!window.confirm(`Remove ${name}'s ${driver.team.name} seat from this season?`)) return;
    setBusy(true);
    setError(null);
    try {
      await adminApi.deleteSeat(token, seasonId, driver.driver_season_id);
      setMessage(`${name}'s seat was removed.`);
      load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const regulars = grid.filter((driver) => !driver.is_reserve);
  const reserves = grid.filter((driver) => driver.is_reserve);

  return (
    <div className="adm-season-grid">
      <section className="adm-panel">
        <div className="adm-section-head">
          <div>
            <h2 className="adm-section-title">Current grid</h2>
            <p className="adm-hint">The season's full-time seats and substitutes, ordered by championship position.</p>
          </div>
          <span className="adm-count-chip">{regulars.length} full-time · {reserves.length} reserves</span>
        </div>

        {error && <p className="adm-err">{error}</p>}
        <div className="adm-seat-list">
          {grid.map((driver) => {
            const name = `${driver.driver.first_name} ${driver.driver.last_name}`.trim();
            return (
              <div className="adm-seat-row" key={driver.driver_season_id}>
                <span className="adm-livery" style={{ background: driver.team.color }} />
                <span className="adm-seat-number">{driver.car_number ? `#${driver.car_number}` : "—"}</span>
                <span className="adm-seat-driver">
                  <strong>{name}</strong>
                  <small>{driver.team.name}</small>
                </span>
                <span className={`adm-seat-role${driver.is_reserve ? " is-reserve" : ""}`}>
                  {driver.is_reserve ? "Reserve" : "Full-time"}
                </span>
                <span className="adm-seat-points">{driver.season_points} pts</span>
                {driver.is_reserve && (
                  <button className="adm-text-button" type="button" disabled={busy} onClick={() => removeSeat(driver)}>
                    Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {options && (
        <section className="adm-panel">
          <h2 className="adm-section-title">Add a substitute</h2>
          <p className="adm-hint">
            Add a reserve seat for the season. In Race control, mark them as competing only for the races they drove.
          </p>
          <div className="adm-sub">
            <select className="adm-select adm-sub-field" value={driverId} onChange={(event) => setDriverId(event.target.value)} aria-label="Substitute driver">
              <option value="">— driver —</option>
              {options.drivers.map((driver) => (
                <option key={driver.id} value={driver.id} disabled={teamId !== "" && driver.seated_team_season_ids.includes(Number(teamId))}>
                  {driver.name}{driver.human ? "" : " (AI)"}
                </option>
              ))}
            </select>
            <select className="adm-select adm-sub-field" value={teamId} onChange={(event) => setTeamId(event.target.value)} aria-label="Team">
              <option value="">— team —</option>
              {options.teams.map((team) => <option key={team.team_season_id} value={team.team_season_id}>{team.name}</option>)}
            </select>
            <input className="adm-num adm-sub-car" type="number" min={1} max={99} value={carNumber} onChange={(event) => setCarNumber(event.target.value)} placeholder="No." aria-label="Car number" />
            <button className="adm-submit adm-sub-add" type="button" onClick={addSeat} disabled={busy || !driverId || !teamId}>
              {busy ? "Saving…" : "Add seat"}
            </button>
          </div>
          {message && <p className="adm-ok adm-sub-msg">{message}</p>}
        </section>
      )}
    </div>
  );
}
