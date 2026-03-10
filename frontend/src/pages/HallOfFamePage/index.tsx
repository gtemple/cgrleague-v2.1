import { useState, useMemo } from "react";
import { useHallOfFame, type HallOfFameDriver } from "../../hooks/useHallOfFame";
import { displayImage } from "../../utils/displayImage";
import { Loader } from "../../components/Loader";
import "./style.css";

type PodiumProps = {
  drivers: HallOfFameDriver[];
  metric: keyof HallOfFameDriver;
  label: string;
};

const Podium = ({ drivers, metric, label }: PodiumProps) => {
  if (drivers.length === 0) return null;

  // Order: 2nd, 1st, 3rd for visualization
  const sorted = [...drivers].sort((a, b) => (b[metric] as number) - (a[metric] as number)).slice(0, 3);
  const displayOrder = [sorted[1], sorted[0], sorted[2]].filter(Boolean);

  return (
    <div className="hall-of-fame-podium">
      <h3>{label}</h3>
      <div className="podium-container">
        {displayOrder.map((driver) => {
          const isWinner = driver.id === sorted[0].id;
          const rank = sorted.findIndex(d => d.id === driver.id) + 1;
          
          return (
            <div key={driver.id} className={`podium-spot rank-${rank} ${isWinner ? 'winner' : ''}`}>
              <div className="podium-driver-card">
                <div className="podium-driver-img">
                  <img src={displayImage(driver.driver_img || 'default', 'driver')} alt={driver.last_name} />
                </div>
                <div className="podium-info text-center">
                  <span className="podium-name">{driver.first_name} {driver.last_name}</span>
                  <span className="podium-value">{driver[metric]}</span>
                </div>
              </div>
              <div className="podium-step">
                <span className="podium-rank-num">{rank}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const StatCard = ({ title, value, driver }: { title: string, value: number, driver: HallOfFameDriver }) => (
  <div className="hof-stat-card text-center">
    <div className="hof-stat-title">{title}</div>
    <div className="hof-stat-value">{value}</div>
    <div className="hof-stat-driver">{driver.first_name} {driver.last_name}</div>
  </div>
);

export function HallOfFamePage() {
  const [onlyHuman, setOnlyHuman] = useState(true);
  const { data, isLoading } = useHallOfFame(onlyHuman);

  const stats = useMemo(() => {
    if (!data) return null;
    return {
      wins: [...data].sort((a, b) => b.total_wins - a.total_wins).slice(0, 3),
      championships: [...data].sort((a, b) => b.total_championships - a.total_championships).slice(0, 3),
      podiums: [...data].sort((a, b) => b.total_podiums - a.total_podiums).slice(0, 3),
      points: [...data].sort((a, b) => b.total_points - a.total_points).slice(0, 3),
      fastestLaps: [...data].sort((a, b) => b.total_fastest_laps - a.total_fastest_laps)[0],
      dotd: [...data].sort((a, b) => b.total_dotd - a.total_dotd)[0],
      cleanDriver: [...data].sort((a, b) => b.total_clean_driver - a.total_clean_driver)[0],
      overtakes: [...data].sort((a, b) => b.total_overtakes - a.total_overtakes)[0],
    };
  }, [data]);

  if (isLoading) return <Loader full />;
  if (!stats) return null;

  return (
    <div className="hall-of-fame-page">
      <div className="hof-header">
        <h1>Hall of Fame</h1>
        <div className="toggle-container">
          <label className="switch">
            <input 
              type="checkbox" 
              checked={onlyHuman} 
              onChange={() => setOnlyHuman(!onlyHuman)} 
            />
            <span className="slider round"></span>
          </label>
          <span className="toggle-label whitespace-nowrap">Humans Only</span>
        </div>
      </div>

      <section className="hof-hero-section">
          <Podium 
            label="All-Time Race Wins" 
            drivers={stats.wins} 
            metric="total_wins" 
          />
      </section>

      <div className="hof-grid-stats">
        <Podium label="Most Championships" drivers={stats.championships} metric="total_championships" />
        <Podium label="Most Podiums" drivers={stats.podiums} metric="total_podiums" />
        <Podium label="Total Career Points" drivers={stats.points} metric="total_points" />
      </div>

      <section className="hof-awards-section">
        <h2>King of Speed & Consistency</h2>
        <div className="hof-awards-grid">
          {stats.fastestLaps && <StatCard title="Fastest Laps" value={stats.fastestLaps.total_fastest_laps} driver={stats.fastestLaps} />}
          {stats.dotd && <StatCard title="Driver of the Day" value={stats.dotd.total_dotd} driver={stats.dotd} />}
          {stats.cleanDriver && <StatCard title="Cleanest Driver" value={stats.cleanDriver.total_clean_driver} driver={stats.cleanDriver} />}
          {stats.overtakes && <StatCard title="Most Overtakes" value={stats.overtakes.total_overtakes} driver={stats.overtakes} />}
        </div>
      </section>
    </div>
  );
}
