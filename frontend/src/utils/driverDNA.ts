import type { DriverHistoryRow } from "../hooks/useDriverHistory";

export interface DriverDNATrait {
  key: "pace" | "qualifying" | "racecraft" | "consistency" | "reliability";
  label: string;
  value: number; // 0-100
}

export interface DriverDNAResult {
  traits: DriverDNATrait[];
  archetype: string;
}

const clamp = (x: number) => Math.max(2, Math.min(100, Math.round(x * 100)));

const ARCHETYPE_BY_TRAIT: Record<DriverDNATrait["key"], string> = {
  qualifying: "Qualifier",
  pace: "Pace Setter",
  racecraft: "Racer",
  reliability: "Iron Man",
  consistency: "Iron Man",
};

/**
 * Derives a 0-100 driver "DNA" profile across five traits from career-by-season
 * data. Purely a computed heuristic (not a stored stat) — weights and reference
 * ceilings are calibrated against league-wide norms, not any single driver.
 */
export function computeDriverDNA(rows: DriverHistoryRow[]): DriverDNAResult | null {
  const races = rows.reduce((a, r) => a + r.races, 0);
  if (races === 0) return null;

  const pod = rows.reduce((a, r) => a + r.podiums, 0);
  const pol = rows.reduce((a, r) => a + r.poles, 0);
  const fl = rows.reduce((a, r) => a + r.fastest_laps, 0);
  const dnf = rows.reduce((a, r) => a + r.dnfs, 0);
  const dotd = rows.reduce((a, r) => a + r.dotds, 0);
  const pts = rows.reduce((a, r) => a + r.points, 0);
  const fin = races - dnf;

  const avgFinRows = rows.filter((r) => r.avg_finish != null);
  const avgFinWeight = avgFinRows.reduce((a, r) => a + r.races, 0);
  const avgFin = avgFinWeight > 0
    ? avgFinRows.reduce((a, r) => a + r.avg_finish! * r.races, 0) / avgFinWeight
    : 20;

  const posGainRows = rows.filter((r) => r.avg_positions_gained != null);
  const posGainWeight = posGainRows.reduce((a, r) => a + r.races, 0);
  const posGain = posGainWeight > 0
    ? posGainRows.reduce((a, r) => a + r.avg_positions_gained! * r.races, 0) / posGainWeight
    : 0;

  const ppr = pts / races;

  const qualifying = clamp((pol / races) / 0.08);
  const pace = clamp(0.7 * (ppr / 16) + 0.3 * ((fl / races) / 0.12));
  const racecraft = clamp(
    0.45 * ((fin > 0 ? pod / fin : 0) / 0.40) +
    0.30 * ((posGain + 3) / 8) +
    0.25 * ((dotd / races) / 0.20)
  );
  const consistency = clamp(
    0.45 * (fin / races) +
    0.25 * (1 - dnf / races) +
    0.30 * ((21 - avgFin) / 20)
  );
  const reliability = clamp((races - dnf) / races);

  const traits: DriverDNATrait[] = [
    { key: "pace", label: "Pace", value: pace },
    { key: "qualifying", label: "Qualifying", value: qualifying },
    { key: "racecraft", label: "Racecraft", value: racecraft },
    { key: "consistency", label: "Consistency", value: consistency },
    { key: "reliability", label: "Reliability", value: reliability },
  ];

  const max = Math.max(...traits.map((t) => t.value));
  const min = Math.min(...traits.map((t) => t.value));
  let archetype = "All-Rounder";
  if (max - min > 18) {
    const top = traits.find((t) => t.value === max)!;
    archetype = ARCHETYPE_BY_TRAIT[top.key];
  }

  return { traits, archetype };
}
