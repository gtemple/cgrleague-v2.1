import { useEffect, useRef, useState } from "react";
import { adminApi, type GridDriver, type RaceInfo } from "../../api/admin";
import { pointsForRow } from "./scoring";
import { ApiError } from "../../api/client";
import { useAdmin } from "./adminContext";
import "./style.css";


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
  const { token, seasonId } = useAdmin();

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

  // Points this race already contributes, so the standings preview shows the
  // effect of the edit rather than counting the race twice.
  const [existingPoints, setExistingPoints] = useState<Record<number, number>>({});

  // Drag state (refs to avoid re-renders during drag)
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    setSelectedRaceId(null);
    setSubmitState("idle");
    setLoadError(null);
  }, [seasonId]);

  // Load races for the season
  useEffect(() => {
    if (!token || seasonId == null) {
      setLoadingRaces(false);
      return;
    }
    setLoadingRaces(true);
    adminApi.getRaces(token, seasonId)
      .then(setRaces)
      .catch((err) => {
        setRaces([]);
        setLoadError(describeLoadError(err));
      })
      .finally(() => setLoadingRaces(false));
  }, [token, seasonId]);

  // Load grid for the season (driver_seasons)
  useEffect(() => {
    if (!token || seasonId == null) {
      setLoadingGrid(false);
      return;
    }
    setLoadingGrid(true);
    adminApi.getGrid(token, seasonId)
      .then((g) => {
        setGrid(g);
        // Backend returns the grid in championship order.
        setOrder(g.map((d) => d.driver_season_id));
        const initial: Record<number, Placement> = {};
        for (const d of g) initial[d.driver_season_id] = defaultPlacement(!d.is_reserve);
        setPlacements(initial);
      })
      .catch((err) => {
        setGrid([]);
        setLoadError(describeLoadError(err));
      })
      .finally(() => setLoadingGrid(false));
  }, [token, seasonId]);

  // When a race is selected, load existing results to pre-populate
  useEffect(() => {
    if (!selectedRaceId || grid.length === 0 || seasonId == null) return;
    const race = races.find((r) => r.id === selectedRaceId);
    if (!race) return;

    setLoadingExisting(true);
    adminApi.getRaceDetail(seasonId, race.round, race.is_sprint)
      .then((detail) => {
        const existing = detail.results;
        setExistingPoints(
          Object.fromEntries(
            existing.map((r) => [
              r.driver_season_id,
              pointsForRow(r.finish_position, race.is_sprint, r.fastest_lap),
            ]),
          ),
        );
        if (existing.length === 0) {
          // No existing results — reset to default order
          setOrder(grid.map((d) => d.driver_season_id));
          const initial: Record<number, Placement> = {};
          for (const d of grid) initial[d.driver_season_id] = defaultPlacement(!d.is_reserve);
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
        setExistingPoints({});
        setOrder(grid.map((d) => d.driver_season_id));
        const initial: Record<number, Placement> = {};
        for (const d of grid) initial[d.driver_season_id] = defaultPlacement(!d.is_reserve);
        setPlacements(initial);
      })
      .finally(() => setLoadingExisting(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRaceId, seasonId]);

  const gridMap = Object.fromEntries(grid.map((d) => [d.driver_season_id, d]));

  // Pole, fastest lap and driver of the day belong to exactly one driver per
  // race, so once one is taken the box is locked everywhere else — untick the
  // holder to move it.
  const exclusiveHolder = (flag: "polePosition" | "fastestLap" | "dotd") => {
    const held = order.find((id) => placements[id]?.[flag]);
    return held ?? null;
  };
  const holders = {
    polePosition: exclusiveHolder("polePosition"),
    fastestLap: exclusiveHolder("fastestLap"),
    dotd: exclusiveHolder("dotd"),
  };

  const selectedRaceInfo = races.find((r) => r.id === selectedRaceId);
  const isSprint = !!selectedRaceInfo?.is_sprint;

  /** Finish position for a seat given the current order, or null if it has none. */
  function finishPositionOf(dsId: number, idx: number): number | null {
    const p = placements[dsId];
    if (!p?.competing || p.status === "DNS" || p.status === "DNQ") return null;
    return order.slice(0, idx + 1).filter((id) => {
      const pp = placements[id];
      return pp?.competing && pp.status !== "DNS" && pp.status !== "DNQ";
    }).length;
  }

  // Points this entry would award, per seat and per team.
  const pointsBySeat: Record<number, number> = {};
  order.forEach((dsId, idx) => {
    const p = placements[dsId];
    if (!p?.competing) return;
    pointsBySeat[dsId] = pointsForRow(finishPositionOf(dsId, idx), isSprint, p.fastestLap);
  });

  const competing = order.filter((id) => placements[id]?.competing);
  const gridSlots = competing
    .map((id) => placements[id]?.gridPosition)
    .filter((g) => g !== "" && g != null);
  const duplicateGrid = gridSlots.length !== new Set(gridSlots).size;

  const checks = [
    { label: `${competing.length} drivers competing`, ok: competing.length > 1 },
    { label: "Pole assigned", ok: holders.polePosition !== null, soft: true },
    { label: "Fastest lap assigned", ok: holders.fastestLap !== null, soft: true },
    { label: "Driver of the day assigned", ok: holders.dotd !== null, soft: true },
    { label: "Grid slots unique", ok: !duplicateGrid },
  ];
  const blocking = checks.some((c) => !c.ok && !c.soft);

  // Championship before this race, and after it if submitted as it stands.
  const standingsImpact = (() => {
    const rows = grid
      .filter((d) => !d.is_reserve || pointsBySeat[d.driver_season_id] != null)
      .map((d) => {
        const gained = pointsBySeat[d.driver_season_id] ?? 0;
        // season_points already includes this race when it has been entered
        // before, so subtract what is currently stored for it.
        const before = d.season_points - (existingPoints[d.driver_season_id] ?? 0);
        return {
          id: d.driver_season_id,
          name: `${d.driver.first_name} ${d.driver.last_name}`.trim(),
          before,
          after: before + gained,
          gained,
        };
      });
    const rank = (key: "before" | "after") =>
      [...rows].sort((a, b) => b[key] - a[key]).map((r) => r.id);
    const beforeRank = rank("before");
    const afterRank = rank("after");
    return [...rows]
      .sort((a, b) => b.after - a.after)
      .map((r) => ({
        ...r,
        move: beforeRank.indexOf(r.id) - afterRank.indexOf(r.id),
        position: afterRank.indexOf(r.id) + 1,
      }));
  })();

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
    if (!selectedRaceId || !token || seasonId == null) return;
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
    return <p className="adm-loading">Loading race control…</p>;
  }

  const selectedRace = races.find((r) => r.id === selectedRaceId);

  return (
    <div className="adm-results-page">
        {loadError && (
          <div className="adm-panel adm-alert">
            Couldn’t load Season {seasonId}: {loadError}
          </div>
        )}

        <div className="adm-panel">
          <div className="adm-section-head">
            <div>
              <h2 className="adm-section-title">Choose a race</h2>
              <p className="adm-hint">Completed rounds remain editable. Unentered rounds are marked as pending.</p>
            </div>
            <span className="adm-count-chip">{races.filter((race) => race.result_count > 0).length}/{races.length} entered</span>
          </div>
          <div className="adm-race-picker" role="list" aria-label="Season races">
            {races.map((race) => (
              <button
                key={race.id}
                type="button"
                className={`adm-race-choice${selectedRaceId === race.id ? " is-active" : ""}`}
                onClick={() => {
                  setSelectedRaceId(race.id);
                  setSubmitState("idle");
                }}
              >
                <span className="adm-race-round">R{race.round}{race.is_sprint ? " · Sprint" : ""}</span>
                <span className="adm-race-track">{race.track.name}</span>
                <span className={`adm-race-state${race.result_count ? " is-complete" : ""}`}>
                  {race.result_count ? `✓ ${race.result_count} entered` : "· Pending"}
                </span>
              </button>
            ))}
          </div>
          {!loadError && races.length === 0 && (
            <p className="adm-hint" style={{ margin: "10px 0 0" }}>
              No races found for Season {seasonId}.
            </p>
          )}
        </div>

        {selectedRace && (
          <div className="adm-panel">
            {loadingExisting ? (
              <p className="adm-loading">Loading existing results…</p>
            ) : (
              <>
                <p className="adm-hint">
                  Drag rows to set finish order. Position is assigned top to bottom;
                  DNS and DNQ always get no position.
                </p>

                <div className="adm-grid-scroll">
                  <div className="adm-grid">
                    <div className="adm-head">
                      <span className="adm-c-handle" />
                      <span className="adm-c-in">In</span>
                      <span className="adm-c-pos">Pos</span>
                      <span className="adm-c-pts">Pts</span>
                      <span className="adm-c-driver">Driver</span>
                      <span className="adm-c-grid">Grid</span>
                      <span className="adm-c-status">Status</span>
                      <span className="adm-c-flag">Pole</span>
                      <span className="adm-c-flag">FL</span>
                      <span className="adm-c-flag">DOTD</span>
                      <span className="adm-c-flag">CD</span>
                      <span className="adm-c-flag">OT</span>
                    </div>

                    {order.map((dsId, idx) => {
                      const driver = gridMap[dsId];
                      if (!driver) return null;
                      const p = placements[dsId] ?? defaultPlacement();
                      const isNoStart = p.status === "DNS" || p.status === "DNQ";

                      const finishPos = finishPositionOf(dsId, idx);

                      const rowClass = [
                        "adm-row",
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
                          <span className="adm-c-handle">
                            <span className="adm-handle">⠿</span>
                          </span>

                          <span className="adm-c-in">
                            <input
                              type="checkbox"
                              className="adm-check adm-check--in"
                              checked={p.competing}
                              title={p.competing ? "Competed — click to mark as sat out" : "Sat out — click to mark as competed"}
                              onChange={(e) => updatePlacement(dsId, { competing: e.target.checked })}
                            />
                          </span>

                          <span className="adm-c-pos">
                            <span className={"adm-pos" + (!p.competing || isNoStart ? " is-none" : "")}>
                              {!p.competing || isNoStart ? "—" : `P${finishPos}`}
                            </span>
                          </span>

                          <span className="adm-c-pts">
                            <span className={"adm-pts" + (pointsBySeat[dsId] ? "" : " is-none")}>
                              {p.competing ? (pointsBySeat[dsId] ?? 0) : "—"}
                            </span>
                          </span>

                          <span className="adm-c-driver">
                            {driver.team.color && (
                              <span className="adm-livery" style={{ background: driver.team.color }} />
                            )}
                            <span className="adm-driver-meta">
                              <span className="adm-driver-name">
                                {driver.car_number ? `#${driver.car_number} ` : ""}
                                {driver.driver.first_name} {driver.driver.last_name}
                              </span>
                              <span className="adm-driver-team">{driver.team.name}</span>
                            </span>
                          </span>

                          <span className="adm-c-grid">
                            <input
                              type="number"
                              className="adm-num"
                              min={1}
                              max={99}
                              value={p.gridPosition}
                              onChange={(e) => updatePlacement(dsId, { gridPosition: e.target.value })}
                              placeholder="—"
                              disabled={!p.competing}
                            />
                          </span>

                          <span className="adm-c-status">
                            <select
                              className="adm-status"
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

                          {/* Exclusive: locked out once another driver holds it */}
                          <FlagCell
                            checked={p.polePosition}
                            disabled={!p.competing || (holders.polePosition !== null && holders.polePosition !== dsId)}
                            onChange={(v) => setExclusiveFlag(dsId, "polePosition", v)}
                          />
                          <FlagCell
                            checked={p.fastestLap}
                            disabled={!p.competing || (holders.fastestLap !== null && holders.fastestLap !== dsId)}
                            onChange={(v) => setExclusiveFlag(dsId, "fastestLap", v)}
                          />
                          <FlagCell
                            checked={p.dotd}
                            disabled={!p.competing || (holders.dotd !== null && holders.dotd !== dsId)}
                            onChange={(v) => setExclusiveFlag(dsId, "dotd", v)}
                          />
                          <FlagCell checked={p.cleanestDriver} disabled={!p.competing} onChange={(v) => updatePlacement(dsId, { cleanestDriver: v })} />
                          <FlagCell checked={p.mostOvertakes}  disabled={!p.competing} onChange={(v) => updatePlacement(dsId, { mostOvertakes: v })} />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="adm-rail">
                  <div className="adm-rail-block">
                    <h3 className="adm-rail-title">Before you submit</h3>
                    <ul className="adm-checks">
                      {checks.map((c) => (
                        <li key={c.label} className={"adm-check-row" + (c.ok ? " is-ok" : c.soft ? " is-warn" : " is-bad")}>
                          <span className="adm-check-mark">{c.ok ? "✓" : c.soft ? "!" : "✕"}</span>
                          {c.label}
                        </li>
                      ))}
                    </ul>
                    {blocking && (
                      <p className="adm-hint">Fix the marked items — they will produce bad data.</p>
                    )}
                  </div>

                  <div className="adm-rail-block">
                    <h3 className="adm-rail-title">Championship after this race</h3>
                    <ol className="adm-impact">
                      {standingsImpact.slice(0, 12).map((r) => (
                        <li key={r.id} className="adm-impact-row">
                          <span className="adm-impact-pos">{r.position}</span>
                          <span className="adm-impact-name">{r.name}</span>
                          {r.gained > 0 && <span className="adm-impact-gain">+{r.gained}</span>}
                          <span className="adm-impact-pts">{r.after}</span>
                          <span className={"adm-impact-move" + (r.move > 0 ? " is-up" : r.move < 0 ? " is-down" : "")}>
                            {r.move > 0 ? `▲${r.move}` : r.move < 0 ? `▼${-r.move}` : "–"}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>

                <div className="adm-actions">
                  <button
                    className="adm-submit"
                    onClick={handleSubmit}
                    disabled={submitState === "loading"}
                  >
                    {submitState === "loading" ? "Saving…" : "Submit results"}
                  </button>
                  {submitState === "success" && <span className="adm-ok">✓ Results saved</span>}
                  {submitState === "error" && <span className="adm-err">Error: {submitError}</span>}
                </div>
              </>
            )}
          </div>
        )}
    </div>
  );
}

function FlagCell({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <span className="adm-c-flag">
      <input
        type="checkbox"
        className="adm-check"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </span>
  );
}
