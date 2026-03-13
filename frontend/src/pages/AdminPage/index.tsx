import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { adminApi, type GridDriver, type RaceInfo } from "../../api/admin";
import { ApiError } from "../../api/client";

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

  // Drag state (refs to avoid re-renders during drag)
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Load races for the season
  useEffect(() => {
    if (!token) return;
    setLoadingRaces(true);
    adminApi.getRaces(token, CURRENT_SEASON)
      .then(setRaces)
      .catch(() => setRaces([]))
      .finally(() => setLoadingRaces(false));
  }, [token]);

  // Load grid for the season (driver_seasons)
  useEffect(() => {
    if (!token) return;
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
      .catch(() => setGrid([]))
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
    return <p style={{ padding: "2rem" }}>Loading…</p>;
  }

  const selectedRace = races.find((r) => r.id === selectedRaceId);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h2 style={{ margin: 0 }}>Submit Results — Season {CURRENT_SEASON}</h2>
        <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)" }}>
          {username} &nbsp;
          <button
            onClick={() => logout().then(() => navigate("/login"))}
            style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: "0.85rem" }}
          >
            Logout
          </button>
        </span>
      </div>

      {/* Race selector */}
      <div style={{ marginBottom: "1.5rem" }}>
        <label style={{ display: "block", marginBottom: 6, fontSize: "0.875rem", color: "rgba(255,255,255,0.6)" }}>
          Select Race
        </label>
        <select
          value={selectedRaceId ?? ""}
          onChange={(e) => {
            setSelectedRaceId(e.target.value ? parseInt(e.target.value, 10) : null);
            setSubmitState("idle");
          }}
          style={selectStyle}
        >
          <option value="">— choose a race —</option>
          {races.map((r) => (
            <option key={r.id} value={r.id}>
              R{r.round}{r.is_sprint ? " Sprint" : ""} — {r.track.name}
              {r.started_at ? ` (${new Date(r.started_at).toLocaleDateString()})` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Grid */}
      {selectedRace && (
        <>
          {loadingExisting ? (
            <p style={{ color: "rgba(255,255,255,0.5)" }}>Loading existing results…</p>
          ) : (
            <>
              <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.4)", marginBottom: "0.75rem" }}>
                Drag rows to set finish order. Position is assigned top → bottom (DNS/DNQ always get null position).
              </p>

              {/* Column headers */}
              <div style={{ ...headerRow }}>
                <span style={{ width: 32 }} />
                <span style={{ width: 32, textAlign: "center" }}>In</span>
                <span style={{ width: 40, textAlign: "center" }}>Pos</span>
                <span style={{ flex: 1 }}>Driver</span>
                <span style={{ width: 72, textAlign: "center" }}>Grid</span>
                <span style={{ width: 80, textAlign: "center" }}>Status</span>
                <span style={{ width: 56, textAlign: "center" }}>Pole</span>
                <span style={{ width: 56, textAlign: "center" }}>FL</span>
                <span style={{ width: 56, textAlign: "center" }}>DOTD</span>
                <span style={{ width: 56, textAlign: "center" }}>CD</span>
                <span style={{ width: 56, textAlign: "center" }}>OT</span>
              </div>

              {order.map((dsId, idx) => {
                const driver = gridMap[dsId];
                if (!driver) return null;
                const p = placements[dsId] ?? defaultPlacement();
                const isNoStart = p.status === "DNS" || p.status === "DNQ";
                const isDraggingOver = dragOverIndex === idx;

                // Compute finish position only among competing, non-DNS/DNQ drivers above this one
                const finishPos = p.competing && !isNoStart
                  ? order.slice(0, idx + 1).filter((id) => {
                      const pp = placements[id];
                      return pp?.competing && pp.status !== "DNS" && pp.status !== "DNQ";
                    }).length
                  : null;

                return (
                  <div
                    key={dsId}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                    style={{
                      ...driverRow,
                      borderTop: isDraggingOver ? "2px solid #e10600" : "2px solid transparent",
                      opacity: !p.competing ? 0.35 : dragIndexRef.current === idx ? 0.4 : 1,
                    }}
                  >
                    {/* Drag handle */}
                    <span style={{ width: 32, cursor: "grab", color: "rgba(255,255,255,0.3)", userSelect: "none", fontSize: "1.1rem" }}>
                      ⠿
                    </span>

                    {/* Competing toggle */}
                    <span style={{ width: 32, display: "flex", justifyContent: "center" }}>
                      <input
                        type="checkbox"
                        checked={p.competing}
                        title={p.competing ? "Competed — click to mark as sat out" : "Sat out — click to mark as competed"}
                        onChange={(e) => updatePlacement(dsId, { competing: e.target.checked })}
                        style={{ width: 15, height: 15, cursor: "pointer", accentColor: "#60a5fa" }}
                      />
                    </span>

                    {/* Position */}
                    <span style={{ width: 40, textAlign: "center", fontWeight: 700, fontSize: "0.9rem", color: !p.competing || isNoStart ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.8)" }}>
                      {!p.competing ? "—" : isNoStart ? "—" : `P${finishPos}`}
                    </span>

                    {/* Driver name + team */}
                    <span style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                      {driver.team.color && (
                        <span style={{ width: 4, height: 28, borderRadius: 2, background: driver.team.color, flexShrink: 0 }} />
                      )}
                      <span>
                        <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                          {driver.car_number ? `#${driver.car_number} ` : ""}
                          {driver.driver.first_name} {driver.driver.last_name}
                        </span>
                        <span style={{ display: "block", fontSize: "0.75rem", color: "rgba(255,255,255,0.45)" }}>
                          {driver.team.name}
                        </span>
                      </span>
                    </span>

                    {/* Grid position */}
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={p.gridPosition}
                      onChange={(e) => updatePlacement(dsId, { gridPosition: e.target.value })}
                      placeholder="—"
                      disabled={!p.competing}
                      style={{ ...numInput, width: 64, opacity: p.competing ? 1 : 0.3 }}
                    />

                    {/* Status */}
                    <select
                      value={p.status}
                      onChange={(e) => updatePlacement(dsId, { status: e.target.value as Status })}
                      disabled={!p.competing}
                      style={{ ...selectStyle, width: 80, padding: "4px 6px", fontSize: "0.8rem", opacity: p.competing ? 1 : 0.3 }}
                    >
                      <option>FIN</option>
                      <option>DNF</option>
                      <option>DNS</option>
                      <option>DSQ</option>
                      <option>DNQ</option>
                    </select>

                    {/* Exclusive flags: Pole, FL, DOTD */}
                    <FlagCell checked={p.polePosition} disabled={!p.competing} onChange={(v) => setExclusiveFlag(dsId, "polePosition", v)} />
                    <FlagCell checked={p.fastestLap}   disabled={!p.competing} onChange={(v) => setExclusiveFlag(dsId, "fastestLap", v)} />
                    <FlagCell checked={p.dotd}         disabled={!p.competing} onChange={(v) => setExclusiveFlag(dsId, "dotd", v)} />

                    {/* Non-exclusive: Cleanest Driver, Most Overtakes */}
                    <FlagCell checked={p.cleanestDriver} disabled={!p.competing} onChange={(v) => updatePlacement(dsId, { cleanestDriver: v })} />
                    <FlagCell checked={p.mostOvertakes}  disabled={!p.competing} onChange={(v) => updatePlacement(dsId, { mostOvertakes: v })} />
                  </div>
                );
              })}

              {/* Submit */}
              <div style={{ marginTop: "2rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                <button
                  onClick={handleSubmit}
                  disabled={submitState === "loading"}
                  style={{
                    padding: "0.65rem 2rem",
                    background: "#e10600",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    fontWeight: 700,
                    fontSize: "0.95rem",
                    cursor: submitState === "loading" ? "not-allowed" : "pointer",
                    opacity: submitState === "loading" ? 0.7 : 1,
                  }}
                >
                  {submitState === "loading" ? "Saving…" : "Submit Results"}
                </button>
                {submitState === "success" && (
                  <span style={{ color: "#4ade80", fontWeight: 600 }}>✓ Results saved!</span>
                )}
                {submitState === "error" && (
                  <span style={{ color: "#f87171" }}>Error: {submitError}</span>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function FlagCell({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <span style={{ width: 56, display: "flex", justifyContent: "center" }}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 16, height: 16, cursor: disabled ? "default" : "pointer", accentColor: "#e10600", opacity: disabled ? 0.3 : 1 }}
      />
    </span>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  background: "#1a1c28",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 6,
  color: "#fff",
  padding: "6px 10px",
  fontSize: "0.875rem",
  cursor: "pointer",
};

const numInput: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 4,
  color: "#fff",
  padding: "4px 6px",
  fontSize: "0.8rem",
  textAlign: "center",
  MozAppearance: "textfield",
};

const driverRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 8px",
  borderRadius: 6,
  background: "rgba(255,255,255,0.04)",
  marginBottom: 4,
  transition: "border-top 0.1s",
};

const headerRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "4px 8px",
  fontSize: "0.75rem",
  color: "rgba(255,255,255,0.4)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 6,
};
