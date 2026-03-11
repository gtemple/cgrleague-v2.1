import { useState, useMemo } from "react";
import { useHallOfFame, type HallOfFameDriver } from "../../hooks/useHallOfFame";
import { displayImage } from "../../utils/displayImage";
import { Loader } from "../../components/Loader";
import "./style.css";

// ─── Driver avatar ────────────────────────────────────────────────────────────

const DriverAvatar = ({ driver, size = "md" }: { driver: HallOfFameDriver; size?: "sm" | "md" | "lg" }) => (
  <div className={`hof-avatar hof-avatar-${size}`}>
    {driver.profile_image
      ? <img src={displayImage(driver.profile_image, "driver")} alt={driver.last_name} />
      : null}
  </div>
);

// ─── Hero podium (Career Points) ──────────────────────────────────────────────

type PodiumProps = {
  drivers: HallOfFameDriver[];
  metric: keyof HallOfFameDriver;
  label: string;
};

const Podium = ({ drivers, metric, label }: PodiumProps) => {
  if (drivers.length === 0) return null;

  const sorted = [...drivers]
    .sort((a, b) => (b[metric] as number) - (a[metric] as number))
    .slice(0, 3);

  // Display order: 2nd left, 1st centre, 3rd right
  const displayOrder = [sorted[1], sorted[0], sorted[2]].filter(Boolean);

  return (
    <div className="stats-card hof-hero-card">
      <div className="stats-card-header">{label}</div>
      <div className="hof-podium-stage">
        {displayOrder.map((driver) => {
          const rank = sorted.findIndex(d => d.id === driver.id) + 1;
          return (
            <div key={driver.id} className={`hof-podium-spot hof-rank-${rank}`}>
              <div className="hof-podium-info">
                <DriverAvatar driver={driver} size={rank === 1 ? "lg" : "md"} />
                <div className="hof-podium-name">{driver.first_name} {driver.last_name}</div>
                <div className="hof-podium-value">{driver[metric] as number}</div>
              </div>
              <div className="hof-podium-step">
                <span className="hof-podium-rank-num">{rank}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Leaderboard card (Championships / Wins / Podiums) ───────────────────────

const RANK_LABELS = ["1st", "2nd", "3rd"];

const LeaderboardCard = ({
  title,
  drivers,
  metric,
}: {
  title: string;
  drivers: HallOfFameDriver[];
  metric: keyof HallOfFameDriver;
}) => {
  const sorted = [...drivers]
    .sort((a, b) => (b[metric] as number) - (a[metric] as number))
    .slice(0, 3);

  return (
    <div className="stats-card hof-lb-card">
      <div className="stats-card-header">{title}</div>
      <div className="hof-lb-rows">
        {sorted.map((driver, i) => (
          <div key={driver.id} className={`hof-lb-row hof-lb-rank-${i + 1}`}>
            <span className="hof-lb-rank">{RANK_LABELS[i]}</span>
            <DriverAvatar driver={driver} size="sm" />
            <span className="hof-lb-name">{driver.first_name} {driver.last_name}</span>
            <span className="hof-lb-value">{driver[metric] as number}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Award card (FL / DOTD / Clean / Overtakes) ──────────────────────────────

const AwardCard = ({
  title,
  value,
  driver,
  accent,
}: {
  title: string;
  value: number;
  driver: HallOfFameDriver;
  accent: string;
}) => (
  <div className="stats-card hof-award-card">
    <div className="stats-card-header">{title}</div>
    <div className="hof-award-body">
      <DriverAvatar driver={driver} size="md" />
      <div className="hof-award-info">
        <div className="hof-award-name">{driver.first_name} {driver.last_name}</div>
        <div className="hof-award-value" style={{ color: accent }}>{value}</div>
      </div>
    </div>
  </div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

export function HallOfFamePage() {
  const [includeAI, setIncludeAI] = useState(true);
  const { data, isLoading } = useHallOfFame(includeAI);

  const stats = useMemo(() => {
    if (!data) return null;
    return {
      wins:            [...data].sort((a, b) => b.total_wins - a.total_wins).slice(0, 3),
      championships:   [...data].sort((a, b) => b.total_championships - a.total_championships).slice(0, 3),
      podiums:         [...data].sort((a, b) => b.total_podiums - a.total_podiums).slice(0, 3),
      points:          [...data].sort((a, b) => b.total_points - a.total_points).slice(0, 3),
      fastestLaps:     [...data].sort((a, b) => b.total_fastest_laps - a.total_fastest_laps)[0],
      dotd:            [...data].sort((a, b) => b.total_dotd - a.total_dotd)[0],
      cleanDriver:     [...data].sort((a, b) => b.total_clean_driver - a.total_clean_driver)[0],
      overtakes:       [...data].sort((a, b) => b.total_overtakes - a.total_overtakes)[0],
    };
  }, [data]);

  return (
    <div className="hof-page">

      {/* Header */}
      <header className="hof-header">
        <div className="hof-header-left">
          <div className="hof-eyebrow">CGR League</div>
          <h1 className="hof-title">Hall of Fame</h1>
        </div>
        <div className="hof-filter-tabs">
          <button
            className={`hof-tab${includeAI ? ' hof-tab-active' : ''}`}
            onClick={() => setIncludeAI(true)}
          >
            All Drivers
          </button>
          <button
            className={`hof-tab${!includeAI ? ' hof-tab-active' : ''}`}
            onClick={() => setIncludeAI(false)}
          >
            Humans Only
          </button>
        </div>
      </header>

      {isLoading && <Loader full />}

      {!isLoading && stats && (
        <>
          {/* Hero: Career Points podium */}
          <section className="hof-hero-section">
            <Podium label="Career Points" drivers={stats.points} metric="total_points" />
          </section>

          {/* Three leaderboard cards */}
          <div className="hof-grid">
            <LeaderboardCard title="Championships" drivers={stats.championships} metric="total_championships" />
            <LeaderboardCard title="Race Wins"     drivers={stats.wins}          metric="total_wins" />
            <LeaderboardCard title="Podiums"       drivers={stats.podiums}        metric="total_podiums" />
          </div>

          {/* Award cards */}
          <section className="hof-awards-section">
            <div className="hof-awards-label">Season Awards</div>
            <div className="hof-awards-grid">
              {stats.fastestLaps && (
                <AwardCard title="Fastest Laps"      value={stats.fastestLaps.total_fastest_laps} driver={stats.fastestLaps} accent="rgb(231, 109, 255)" />
              )}
              {stats.dotd && (
                <AwardCard title="Driver of the Day" value={stats.dotd.total_dotd}               driver={stats.dotd}        accent="rgb(99, 179, 237)" />
              )}
              {stats.cleanDriver && (
                <AwardCard title="Cleanest Driver"   value={stats.cleanDriver.total_clean_driver} driver={stats.cleanDriver} accent="rgb(72, 199, 142)" />
              )}
              {stats.overtakes && (
                <AwardCard title="Most Overtakes"    value={stats.overtakes.total_overtakes}      driver={stats.overtakes}   accent="rgb(255, 199, 14)" />
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
