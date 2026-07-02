import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useHallOfFame, type HallOfFameDriver, type SeasonBestEntry, type HallOfFameData } from "../../hooks/useHallOfFame";
import { H2HMatrix } from "../../components/H2HMatrix";
import { displayImage } from "../../utils/displayImage";
import { Loader } from "../../components/Loader";
import "./style.css";

// ─── Driver avatar ────────────────────────────────────────────────────────────

type SeasonBestDriverInfo = NonNullable<SeasonBestEntry>["driver"];

const DriverAvatar = ({ driver, size = "md" }: { driver: HallOfFameDriver | SeasonBestDriverInfo; size?: "sm" | "md" | "lg" }) => (
  <div className={`hof-avatar hof-avatar-${size}`}>
    {driver?.profile_image
      ? <img loading="lazy" src={displayImage(driver.profile_image, "driver")} alt={driver.last_name} />
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
    <div className="hof-card hof-hero-card">
      <div className="hof-card-header">{label}</div>
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

// ─── Leaderboard card (Championships / Wins / Podiums / Poles) ───────────────

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
    <div className="hof-card hof-lb-card">
      <div className="hof-card-header">{title}</div>
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
  <div className="hof-card hof-award-card">
    <div className="hof-card-header">{title}</div>
    <div className="hof-award-body">
      <DriverAvatar driver={driver} size="md" />
      <div className="hof-award-info">
        <div className="hof-award-name">{driver.first_name} {driver.last_name}</div>
        <div className="hof-award-value" style={{ color: accent }}>{value}</div>
      </div>
    </div>
  </div>
);

// ─── Season Best card ─────────────────────────────────────────────────────────

const SeasonBestCard = ({
  title,
  entry,
  unit,
  accent,
}: {
  title: string;
  entry: SeasonBestEntry;
  unit?: string;
  accent: string;
}) => {
  if (!entry) return null;
  const { driver, season_id, value } = entry;
  return (
    <div className="hof-card hof-best-card">
      <div className="hof-card-header">{title}</div>
      <div className="hof-best-body">
        <DriverAvatar driver={driver} size="md" />
        <div className="hof-best-info">
          <div className="hof-best-name">{driver.first_name} {driver.last_name}</div>
          <Link to={`/seasons/${season_id}`} className="hof-best-season">
            Season {season_id}
          </Link>
        </div>
        <div className="hof-best-value" style={{ color: accent }}>
          {value}{unit ? <span className="hof-best-unit">{unit}</span> : null}
        </div>
      </div>
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export function HallOfFamePage() {
  const [includeAI, setIncludeAI] = useState(true);
  const { data, isLoading } = useHallOfFame(includeAI);

  const stats = useMemo(() => {
    if (!data) return null;
    // Handle both new shape {drivers, season_bests} and old flat-array shape
    const drivers: HallOfFameDriver[] = Array.isArray(data) ? data : (data.drivers ?? []);
    if (!drivers.length) return null;
    return {
      wins:            [...drivers].sort((a, b) => b.total_wins - a.total_wins).slice(0, 3),
      championships:   [...drivers].sort((a, b) => b.total_championships - a.total_championships).slice(0, 3),
      podiums:         [...drivers].sort((a, b) => b.total_podiums - a.total_podiums).slice(0, 3),
      poles:           [...drivers].sort((a, b) => b.total_poles - a.total_poles).slice(0, 3),
      points:          [...drivers].sort((a, b) => b.total_points - a.total_points).slice(0, 3),
      fastestLaps:     [...drivers].sort((a, b) => b.total_fastest_laps - a.total_fastest_laps)[0],
      dotd:            [...drivers].sort((a, b) => b.total_dotd - a.total_dotd)[0],
      cleanDriver:     [...drivers].sort((a, b) => b.total_clean_driver - a.total_clean_driver)[0],
      overtakes:       [...drivers].sort((a, b) => b.total_overtakes - a.total_overtakes)[0],
    };
  }, [data]);

  return (
    <div className="hof-page">

      {/* Header band */}
      <div className="hof-header-band">
        <div className="hof-header-inner">
          <div>
            <div className="hof-eyebrow">CGR LEAGUE · ALL-TIME GREATS</div>
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
        </div>
      </div>

      <div className="hof-body">
        {isLoading && <Loader full />}

        {!isLoading && stats && data && (
          <>
            {/* Hero: Career Points podium */}
            <section className="hof-hero-section">
              <Podium label="CAREER POINTS" drivers={stats.points} metric="total_points" />
            </section>

            {/* Four leaderboard cards */}
            <div className="hof-grid hof-grid-4">
              <LeaderboardCard title="CHAMPIONSHIPS" drivers={stats.championships} metric="total_championships" />
              <LeaderboardCard title="RACE WINS"     drivers={stats.wins}          metric="total_wins" />
              <LeaderboardCard title="PODIUMS"       drivers={stats.podiums}        metric="total_podiums" />
              <LeaderboardCard title="POLE POSITIONS" drivers={stats.poles}         metric="total_poles" />
            </div>

            {/* Single-season records */}
            <section className="hof-awards-section">
              <div className="hof-awards-label">SINGLE-SEASON RECORDS</div>
              <div className="hof-bests-grid">
                <SeasonBestCard
                  title="MOST WINS IN A SEASON"
                  entry={(data as HallOfFameData).season_bests?.most_wins ?? null}
                  accent="var(--cgr-gold)"
                />
                <SeasonBestCard
                  title="MOST POINTS IN A SEASON"
                  entry={(data as HallOfFameData).season_bests?.most_points ?? null}
                  accent="var(--cgr-blue)"
                />
                <SeasonBestCard
                  title="MOST POLES IN A SEASON"
                  entry={(data as HallOfFameData).season_bests?.most_poles ?? null}
                  accent="#1f9e74"
                />
              </div>
            </section>

            {/* Head-to-head matrix (human drivers only) */}
            <section className="hof-awards-section">
              <div className="hof-awards-label">HEAD-TO-HEAD · HUMAN DRIVERS</div>
              <H2HMatrix />
            </section>

            {/* Award cards */}
            <section className="hof-awards-section">
              <div className="hof-awards-label">CAREER AWARDS</div>
              <div className="hof-awards-grid">
                {stats.fastestLaps && (
                  <AwardCard title="FASTEST LAPS"      value={stats.fastestLaps.total_fastest_laps} driver={stats.fastestLaps} accent="#a23ce8" />
                )}
                {stats.dotd && (
                  <AwardCard title="DRIVER OF THE DAY" value={stats.dotd.total_dotd}               driver={stats.dotd}        accent="var(--cgr-blue)" />
                )}
                {stats.cleanDriver && (
                  <AwardCard title="CLEANEST DRIVER"   value={stats.cleanDriver.total_clean_driver} driver={stats.cleanDriver} accent="#1f9e74" />
                )}
                {stats.overtakes && (
                  <AwardCard title="MOST OVERTAKES"    value={stats.overtakes.total_overtakes}      driver={stats.overtakes}   accent="var(--cgr-gold)" />
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
