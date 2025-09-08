// src/pages/SeasonPage/index.tsx
import React, { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useSeasonResultsMatrix } from "../../hooks/useSeasonResultsMatrix";
import { getPositionColor } from "../../utils/getPositionColor";


type DriverInfo = {
  first_name: string;
  last_name: string;
  team_name: string;
  profile_image: string | null;
  initials: string;
};

type MatrixRow = {
  driver_info: DriverInfo;
  finish_positions: Array<number | null>;
  grid_positions: Array<number | null>;
  statuses: Array<string | null>;
  fastest_lap: boolean[];
  pole_positions: boolean[];
  dotds: boolean[];
};

type Props = { seasonId?: number | string };


export function PositionLegend() {
  const positions = Array.from({ length: 20 }, (_, i) => `${i + 1}`);

  return (
    <div style={styles.container}>
      {positions.map((pos) => (
        <div key={pos} style={{ ...styles.box, backgroundColor: getPositionColor(pos) }}>
          <span style={styles.label}>{pos.toUpperCase()}</span>
        </div>
      ))}
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: "flex",
    gap: "4px",
    margin: "12px 0",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
  },
  box: {
    width: "40px",
    height: "40px",
    borderRadius: "6px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontSize: "0.7rem",
    fontWeight: 600,
    textShadow: "0 1px 2px rgba(0,0,0,0.6)",
  },
  label: {
    pointerEvents: "none",
  },
};

export default function SeasonPage({ seasonId: seasonIdProp }: Props) {
  const params = useParams();
  const seasonId = String(seasonIdProp ?? params.seasonId ?? "1");

  const [includeSprints, setIncludeSprints] = useState(true);

  //@ts-expect-error we don't need this check
  const { data, isLoading, error } = useSeasonResultsMatrix(seasonId, { includeSprints });

  // ✅ stable reference (fixes exhaustive-deps warning)
  const rows = useMemo<MatrixRow[]>(
    () => (Array.isArray(data) ? (data as MatrixRow[]) : []),
    [data]
  );

  const numRounds = useMemo(
    () => rows.reduce((max, r) => Math.max(max, r.finish_positions?.length ?? 0), 0),
    [rows]
  );

  // ✅ no any
  const errorMessage = useMemo(() => {
    if (!error) return null;
    return error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : JSON.stringify(error);
  }, [error]);

  return (
    <div style={{ padding: "1rem" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Season {seasonId} — Results</h1>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={includeSprints}
            onChange={(e) => setIncludeSprints(e.target.checked)}
          />
          Include sprints
        </label>
      </header>

      {isLoading && <p>Loading…</p>}
      {errorMessage && <p style={{ color: "crimson" }}>Failed to load results: {errorMessage}</p>}

      {!isLoading && !errorMessage && (
        <>
          <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "separate",
                borderSpacing: 0,
                minWidth: 900,
              }}
            >
              <thead>
                <tr>
                  <Th style={{ position: "sticky", left: 0, zIndex: 2, background: "white" }}>
                    Driver
                  </Th>
                  {Array.from({ length: numRounds }).map((_, i) => (
                    <Th key={i}>R{i + 1}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={idx}>
                    <Td
                      style={{
                        position: "sticky",
                        left: 0,
                        zIndex: 1,
                        background: "white",
                        minWidth: 260,
                      }}
                    >
                      <DriverCell info={r.driver_info} />
                    </Td>

                    {Array.from({ length: numRounds }).map((_, i) => {
                      const fin = r.finish_positions?.[i] ?? null;
                      const grid = r.grid_positions?.[i] ?? null;
                      const status = r.statuses?.[i] ?? null;
                      const fl = !!r.fastest_lap?.[i];
                      const pole = !!r.pole_positions?.[i];
                      const dotd = !!r.dotds?.[i];

                      const showStatus = status && status !== "FIN";
                      const finText = fin ?? "–";

                      const bg =
                        showStatus && status === "DNF"
                          ? "#fee2e2"
                          : typeof fin === "number" && fin <= 3
                          ? "#dcfce7"
                          : typeof fin === "number" && fin <= 10
                          ? "#e0f2fe"
                          : "transparent";

                      return (
                        <Td key={i} style={{ textAlign: "center", background: bg }}>
                          <div style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                            {showStatus ? status : finText}
                          </div>
                          <div style={{ fontSize: 12, color: "#6b7280" }}>
                            {grid ? `g${grid}` : ""}
                          </div>
                          <div style={{ marginTop: 4, fontSize: 12 }}>
                            {fl && <Flag badge="FL" title="Fastest lap" />}
                            {pole && <Flag badge="P" title="Pole position" />}
                            {dotd && <Flag badge="★" title="Driver of the Day" />}
                          </div>
                        </Td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <PositionLegend />
        </>
      )}
    </div>
  );
}

function DriverCell({ info }: { info: DriverInfo }) {
  const avatar = info.profile_image;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {avatar ? (
        <img
          src={avatar}
          alt={info.initials}
          style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }}
        />
      ) : (
        <div
          aria-hidden="true"
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            background: "#e5e7eb",
            fontWeight: 700,
            fontSize: 12,
          }}
        >
          {info.initials}
        </div>
      )}
      <div>
        <div style={{ fontWeight: 600 }}>
          {info.first_name} {info.last_name}
        </div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>{info.team_name}</div>
      </div>
    </div>
  );
}

function Flag({ badge, title }: { badge: string; title: string }) {
  return (
    <span
      title={title}
      style={{
        display: "inline-block",
        border: "1px solid #d1d5db",
        padding: "1px 6px",
        borderRadius: 999,
        marginRight: 6,
      }}
    >
      {badge}
    </span>
  );
}


function Th({
  children,
  style,
}: React.PropsWithChildren<{ style?: React.CSSProperties }>) {
  return (
    <th
      style={{
        textAlign: "left",
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: 0.4,
        color: "#6b7280",
        padding: "10px 12px",
        borderBottom: "1px solid #e5e7eb",
        background: "#f9fafb",
        ...style,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  style,
}: React.PropsWithChildren<{ style?: React.CSSProperties }>) {
  return (
    <td
      style={{
        padding: "8px 12px",
        borderBottom: "1px solid #f3f4f6",
        verticalAlign: "top",
        ...style,
      }}
    >
      {children}
    </td>
  );
}
