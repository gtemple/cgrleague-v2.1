import type { ReactNode } from "react";
import "./style.css";

interface StatusTickerProps {
  seasonLabel: string;
  roundCurrent: number;
  roundTotal: number;
  leaderName: string;
  leaderPoints: number;
  margin: number;
  right: ReactNode;
}

function Divider() {
  return <span className="ticker-divider" />;
}

export function StatusTicker({
  seasonLabel,
  roundCurrent,
  roundTotal,
  leaderName,
  leaderPoints,
  margin,
  right,
}: StatusTickerProps) {
  return (
    <div className="status-ticker">
      <span className="ticker-season">&#9679; {seasonLabel}</span>
      <Divider />
      <span className="ticker-item">
        ROUND{" "}
        <span className="ticker-value">
          {String(roundCurrent).padStart(2, "0")} / {String(roundTotal).padStart(2, "0")}
        </span>
      </span>
      <Divider />
      <span className="ticker-item">
        LEADER <span className="ticker-value">{leaderName}</span>{" "}
        <span className="ticker-leader-points">{leaderPoints}</span>
      </span>
      <Divider />
      <span className="ticker-item">
        MARGIN <span className="ticker-value">+{margin}</span>
      </span>
      <span className="ticker-right">{right}</span>
    </div>
  );
}
