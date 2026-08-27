import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { adminApi, type GridDriver, type RaceInfo } from "../../api/admin";
import { ApiError } from "../../api/client";
import "./style.css";

const CURRENT_SEASON = 7;

type Status = "FIN" | "DNF" | "DNS" | "DSQ" | "DNQ";

type Placement = {
  competing: boolean;
  status: Status;
  gridPosition: string;
  lapsCompleted: string;
  polePosition: boolean;
  fastestLap: boolean;
  dotd: boolean;
  cleanestDriver: boolean;
  mostOvertakes: boolean;
};

function describeLoadError(err: unknown): string {
  if (err instanceof ApiError) {
    return err.status === 401
      ? "your session has expired — log out and back in"
      : `the server returned ${err.status}`;
  }
  return "could not reach the server";
}

function defaultPlacement(competing = true): Placement {
  return {
    competing,
    status: "FIN",
    gridPosition: "",
    lapsCompleted: "",
    polePosition: false,
    fastestLap: false,
    dotd: false,
    cleanestDriver: false,
    mostOvertakes: false,
  };
}

export function AdminPage() {
  const { token, username, logout } = useAuth();
  const navigate = useNavigate();

  const [races, setRaces] = useState<RaceInfo[]>([]);
  const [grid, setGrid] = useState<GridDriver[]>([]);
  const [selectedRaceId, setSelectedRaceId] = useState<number | null>(null);
  const [order, setOrder] = useState<number[]>([]); // driver_season_ids in finish order
  const [placements, setPlacements] = useState<Record<number, Placement>>({});

  const [loadingRaces, setLoadingRaces] = useState(true);
  const [loadingGrid, setLoadingGrid] = useState(true);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [submitState, setSubmitState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Drag state (refs to avoid re-renders during drag)
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Load races for the season
  useEffect(() => {
    if (!token) {
      setLoadingRaces(false);
      return;
    }
    setLoadingRaces(true);
    adminApi.getRaces(token, CURRENT_SEASON)
      .then(setRaces)
      .catch((err) => {
        setRaces([]);
        setLoadError(describeLoadError(err));
      })
      .finally(() => setLoadingRaces(false));
  }, [token]);

  // Load grid for the season (driver_seasons)
  useEffect(() => {
    if (!token) {
      setLoadingGrid(false);
      return;
    }
    setLoadingGrid(true);
    adminApi.getGrid(token, CURRENT_SEASON)
      .then((g) => {
        setGrid(g);
        // Set default order (car number order)
        setOrder(g.map((d) => d.driver_season_id));
        const initial: Record<number, Placement> = {};
        for (const d of g) initial[d.driver_season_id] = defaultPlacement();
        setPlacements(initial);
      })
      .catch((err) => {
        setGrid([]);
        setLoadError(describeLoadError(err));
      })
      .finally(() => setLoadingGrid(false));
  }, [token]);

  // When a race is selected, load existing results to pre-populate
  useEffect(() => {
    if (!selectedRaceId || grid.length === 0) return;
    const race = races.find((r) => r.id === selectedRaceId);
    if (!race) return;

    setLoadingExisting(true);
    adminApi.getRaceDetail(CURRENT_SEASON, race.round, race.is_sprint)
      .then((detail) => {
        const existing = detail.results;
        if (existing.length === 0) {
          // No existing results — reset to default order
          setOrder(grid.map((d) => d.driver_season_id));
          const initial: Record<number, Placement> = {};
          for (const d of grid) initial[d.driver_season_id] = defaultPlacement();
          setPlacements(initial);
          return;
        }

        // Sort existing results: classified (by finish_position) first, unclassified after
        const classified = existing
          .filter((r) => r.finish_position !== null)
          .sort((a, b) => (a.finish_position ?? 999) - (b.finish_position ?? 999));
        const unclassified = existing.filter((r) => r.finish_position === null);
        const sorted = [...classified, ...unclassified];

        const newPlacements: Record<number, Placement> = {};
        const newOrder: number[] = [];
        const seen = new Set<number>();

        for (const r of sorted) {
          const dsId = r.driver_season_id;
          if (!dsId || seen.has(dsId)) continue;
          seen.add(dsId);
          newOrder.push(dsId);
          newPlacements[dsId] = {
            competing: true,
            status: r.status as Status,
            gridPosition: r.grid_position?.toString() ?? "",
            lapsCompleted: r.laps_completed?.toString() ?? "",
            polePosition: r.pole_position,
            fastestLap: r.fastest_lap,
            dotd: r.dotd,
            cleanestDriver: r.cleanest_driver,
            mostOvertakes: r.most_overtakes,
          };
        }

        // Drivers not in existing results sat out — mark as not competing
        for (const d of grid) {
          if (!seen.has(d.driver_season_id)) {
            newOrder.push(d.driver_season_id);
            newPlacements[d.driver_season_id] = defaultPlacement(false);
          }
        }

        setOrder(newOrder);
        setPlacements(newPlacements);
      })
      .catch(() => {
        // Race has no results yet — keep defaults
        setOrder(grid.map((d) => d.driver_season_id));
        const initial: Record<number, Placement> = {};
        for (const d of grid) initial[d.driver_season_id] = defaultPlacement();
        setPlacements(initial);
      })
      .finally(() => setLoadingExisting(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRaceId]);

  const gridMap = Object.fromEntries(grid.map((d) => [d.driver_season_id, d]));

  function updatePlacement(dsId: number, patch: Partial<Placement>) {
    setPlacements((prev) => ({ ...prev, [dsId]: { ...prev[dsId], ...patch } }));
  }

  // For exclusive flags: only one driver can hold pole/FL/DOTD per race
  function setExclusiveFlag(dsId: number, flag: "polePosition" | "fastestLap" | "dotd", value: boolean) {
    if (!value) {
      updatePlacement(dsId, { [flag]: false });
      return;
    }
    setPlacements((prev) => {
      const next = { ...prev };
      for (const id of order) {
        next[id] = { ...next[id], [flag]: id === dsId };
      }
      return next;
    });
  }

  // ── Drag & Drop ──────────────────────────────────────────────────────────
  function handleDragStart(index: number) {
    dragIndexRef.current = index;
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragIndexRef.current !== null && dragIndexRef.current !== index) {
      setDragOverIndex(index);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const from = dragIndexRef.current;
    const to = dragOverIndex;
    if (from === null || to === null || from === to) {
      dragIndexRef.current = null;
      setDragOverIndex(null);
      return;
    }
    setOrder((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    dragIndexRef.current = null;
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    dragIndexRef.current = null;
    setDragOverIndex(null);
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!selectedRaceId || !token) return;
    setSubmitState("loading");
    setSubmitError(null);

    // Only submit drivers who actually competed; sat-out drivers get no result entry
    let finishCounter = 0;
    const results = order
      .filter((dsId) => placements[dsId]?.competing)
      .map((dsId) => {
        const p = placements[dsId];
        const isNoStart = p.status === "DNS" || p.status === "DNQ";
        if (!isNoStart) finishCounter++;
        return {
          driver_season_id: dsId,
          finish_position: isNoStart ? null : finishCounter,
          grid_position: p.gridPosition !== "" ? parseInt(p.gridPosition, 10) : null,
          status: p.status,
          laps_completed: p.lapsCompleted !== "" ? parseInt(p.lapsCompleted, 10) : null,
          fastest_lap: p.fastestLap,
          pole_position: p.polePosition,
          dotd: p.dotd,
          cleanest_driver: p.cleanestDriver,
          most_overtakes: p.mostOvertakes,
        };
      });

    try {
      await adminApi.submitResults(token, selectedRaceId, results);
      setSubmitState("success");
    } catch (err) {
      setSubmitState("error");
      if (err instanceof ApiError) {
        const payload = err.payload as { detail?: string; errors?: string[] } | null;
        setSubmitError(payload?.errors?.join(", ") ?? payload?.detail ?? err.message);
      } else {
        setSubmitError("Submission failed.");
      }
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  if (loadingRaces || loadingGrid) {
    return <div className="ad-page"><p className="ad-loading">Loading…</p></div>;
  }

  const selectedRace = races.find((r) => r.id === selectedRaceId);

  return (
    <div className="ad-page">
      <div className="ad-band">
        <div className="ad-band-inner">
          <div>
            <span className="ad-eyebrow">CGR League · Admin</span>
            <h1 className="ad-title">Results — Season {CURRENT_SEASON}</h1>
          </div>
          <span className="ad-user">
            {username}
            <button className="ad-logout" onClick={() => logout().then(() => navigate("/login"))}>
              Log out
            </button>
          </span>
        </div>
      </div>

      <div className="ad-inner">
        {loadError && (
          <div className="ad-panel ad-alert">
            Couldn’t load Season {CURRENT_SEASON}: {loadError}
          </div>
        )}

        <div className="ad-panel">
          <label className="ad-label" htmlFor="ad-race">Select race</label>
          <select
            id="ad-race"
            className="ad-select"
            value={selectedRaceId ?? ""}
            onChange={(e) => {
              setSelectedRaceId(e.target.value ? parseInt(e.target.value, 10) : null);
              setSubmitState("idle");
            }}
          >
            <option value="">— choose a race —</option>
            {races.map((r) => (
              <option key={r.id} value={r.id}>
                R{r.round}{r.is_sprint ? " Sprint" : ""} — {r.track.name}
                {r.started_at ? ` (${new Date(r.started_at).toLocaleDateString()})` : ""}
              </option>
            ))}
          </select>
          {!loadError && races.length === 0 && (
            <p className="ad-hint" style={{ margin: "10px 0 0" }}>
              No races found for Season {CURRENT_SEASON}.
            </p>
          )}
        </div>

        {selectedRace && (
          <div className="ad-panel">
            {loadingExisting ? (
              <p className="ad-loading">Loading existing results…</p>
            ) : (
              <>
                <p className="ad-hint">
                  Drag rows to set finish order. Position is assigned top to bottom;
                  DNS and DNQ always get no position.
                </p>

                <div className="ad-grid-scroll">
                  <div className="ad-grid">
                    <div className="ad-head">
                      <span className="ad-c-handle" />
                      <span className="ad-c-in">In</span>
                      <span className="ad-c-pos">Pos</span>
                      <span className="ad-c-driver">Driver</span>
                      <span className="ad-c-grid">Grid</span>
                      <span className="ad-c-status">Status</span>
                      <span className="ad-c-flag">Pole</span>
                      <span className="ad-c-flag">FL</span>
                      <span className="ad-c-flag">DOTD</span>
                      <span className="ad-c-flag">CD</span>
                      <span className="ad-c-flag">OT</span>
                    </div>

                    {order.map((dsId, idx) => {
                      const driver = gridMap[dsId];
                      if (!driver) return null;
                      const p = placements[dsId] ?? defaultPlacement();
                      const isNoStart = p.status === "DNS" || p.status === "DNQ";

                      // Position counts only competing, started drivers above this one
                      const finishPos = p.competing && !isNoStart
                        ? order.slice(0, idx + 1).filter((id) => {
                            const pp = placements[id];
                            return pp?.competing && pp.status !== "DNS" && pp.status !== "DNQ";
                          }).length
                        : null;

                      const rowClass = [
                        "ad-row",
                        dragOverIndex === idx ? "is-dragover" : "",
                        dragIndexRef.current === idx ? "is-dragging" : "",
                        !p.competing ? "is-out" : "",
                      ].filter(Boolean).join(" ");

                      return (
                        <div
                          key={dsId}
                          className={rowClass}
                          draggable
                          onDragStart={() => handleDragStart(idx)}
                          onDragOver={(e) => handleDragOver(e, idx)}
                          onDrop={handleDrop}
                          onDragEnd={handleDragEnd}
                        >
                          <span className="ad-c-handle">
                            <span className="ad-handle">⠿</span>
                          </span>

                          <span className="ad-c-in">
                            <input
                              type="checkbox"
                              className="ad-check ad-check--in"
                              checked={p.competing}
                              title={p.competing ? "Competed — click to mark as sat out" : "Sat out — click to mark as competed"}
                              onChange={(e) => updatePlacement(dsId, { competing: e.target.checked })}
                            />
                          </span>

                          <span className="ad-c-pos">
                            <span className={"ad-pos" + (!p.competing || isNoStart ? " is-none" : "")}>
                              {!p.competing || isNoStart ? "—" : `P${finishPos}`}
                            </span>
                          </span>

                          <span className="ad-c-driver">
                            {driver.team.color && (
                              <span className="ad-livery" style={{ background: driver.team.color }} />
                            )}
                            <span className="ad-driver-meta">
                              <span className="ad-driver-name">
                                {driver.car_number ? `#${driver.car_number} ` : ""}
                                {driver.driver.first_name} {driver.driver.last_name}
                              </span>
                              <span className="ad-driver-team">{driver.team.name}</span>
                            </span>
                          </span>

                          <span className="ad-c-grid">
                            <input
                              type="number"
                              className="ad-num"
                              min={1}
                              max={99}
                              value={p.gridPosition}
                              onChange={(e) => updatePlacement(dsId, { gridPosition: e.target.value })}
                              placeholder="—"
                              disabled={!p.competing}
                            />
                          </span>

                          <span className="ad-c-status">
                            <select
                              className="ad-status"
                              value={p.status}
                              onChange={(e) => updatePlacement(dsId, { status: e.target.value as Status })}
                              disabled={!p.competing}
                            >
                              <option>FIN</option>
                              <option>DNF</option>
                              <option>DNS</option>
                              <option>DSQ</option>
                              <option>DNQ</option>
                            </select>
                          </span>

                          {/* Exclusive: only one driver per race can hold these */}
                          <FlagCell checked={p.polePosition}   disabled={!p.competing} onChange={(v) => setExclusiveFlag(dsId, "polePosition", v)} />
                          <FlagCell checked={p.fastestLap}     disabled={!p.competing} onChange={(v) => setExclusiveFlag(dsId, "fastestLap", v)} />
                          <FlagCell checked={p.dotd}           disabled={!p.competing} onChange={(v) => setExclusiveFlag(dsId, "dotd", v)} />
                          <FlagCell checked={p.cleanestDriver} disabled={!p.competing} onChange={(v) => updatePlacement(dsId, { cleanestDriver: v })} />
                          <FlagCell checked={p.mostOvertakes}  disabled={!p.competing} onChange={(v) => updatePlacement(dsId, { mostOvertakes: v })} />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="ad-actions">
                  <button
                    className="ad-submit"
                    onClick={handleSubmit}
                    disabled={submitState === "loading"}
                  >
                    {submitState === "loading" ? "Saving…" : "Submit results"}
                  </button>
                  {submitState === "success" && <span className="ad-ok">✓ Results saved</span>}
                  {submitState === "error" && <span className="ad-err">Error: {submitError}</span>}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FlagCell({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <span className="ad-c-flag">
      <input
        type="checkbox"
        className="ad-check"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </span>
  );
}
