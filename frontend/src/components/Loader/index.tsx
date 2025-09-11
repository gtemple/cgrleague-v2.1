import "./style.css";

type LoaderProps = {
  label?: string;
  variant?: "spinner" | "skeleton";
  /** When skeleton: how many bars */
  lines?: number;
  /** Stretch to container (for full-page/section) */
  full?: boolean;
  /** Skeleton bar height (px) */
  barHeight?: number;
};

export function Loader({
  label = "Loading…",
  variant = "spinner",
  lines = 6,
  full = false,
  barHeight = 14,
}: LoaderProps) {
  if (variant === "skeleton") {
    return (
      <div className={"loader-wrap" + (full ? " loader-full" : "")} role="status" aria-live="polite">
        <div className="skeleton-stack">
          {Array.from({ length: lines }).map((_, i) => (
            <div
              key={i}
              className="skeleton-bar"
              style={{ height: barHeight, width: `${90 - (i % 3) * 8}%` }}
            />
          ))}
        </div>
        <div className="loader-label">{label}</div>
      </div>
    );
  }

  return (
    <div className={"loader-wrap" + (full ? " loader-full" : "")} role="status" aria-live="polite">
      <div className="spinner" aria-hidden />
      <div className="loader-label">{label}</div>
    </div>
  );
}
