import type { DriverDNA as DriverDNAData } from "../../hooks/useDriverDetails";

export function DriverDNA({ dna }: { dna: DriverDNAData | null }) {
  if (!dna || dna.traits.length === 0) return null;

  const max = Math.max(...dna.traits.map((t) => t.value));

  return (
    <div className="dp-dna">
      <div className="dp-dna-header">
        <span className="dp-dna-title">DRIVER DNA</span>
        <span className="dp-dna-archetype">{dna.archetype.toUpperCase()}</span>
      </div>
      <div className="dp-dna-bars">
        {dna.traits.map((t) => {
          const isTop = t.value === max;
          return (
            <div className="dp-dna-trait" key={t.key}>
              <span className={`dp-dna-value${isTop ? " dp-dna-value--top" : ""}`}>{t.value}</span>
              <div className="dp-dna-track">
                <div
                  className={`dp-dna-fill${isTop ? " dp-dna-fill--top" : ""}`}
                  style={{ height: `${t.value}%` }}
                />
              </div>
              <span className="dp-dna-label">{t.label.toUpperCase()}</span>
            </div>
          );
        })}
      </div>
      <div className="dp-dna-footnote">
        PERCENTILE VS THE GRID · COMPUTED FROM CAREER DATA · ARCHETYPE = STANDOUT TRAIT
      </div>
    </div>
  );
}
