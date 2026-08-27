import { Link } from "react-router-dom";
import { useH2HMatrix } from "../../hooks/useH2HMatrix";
import { displayImage } from "../../utils/displayImage";

/**
 * Closest rivals for one driver, derived from the existing all-pairs H2H
 * matrix so this costs no extra request beyond what Hall of Fame already loads.
 */
export function DriverRivals({ driverId }: { driverId: string | undefined }) {
  const { data, isLoading } = useH2HMatrix();
  const id = Number(driverId);
  if (isLoading || !data || !Number.isFinite(id)) return null;

  const me = String(id);
  if (!data.matrix[me]) return null;

  const rivals = data.drivers
    .filter((d) => d.id !== id)
    .map((d) => {
      const wins = data.matrix[me]?.[String(d.id)] ?? 0;
      const losses = data.matrix[String(d.id)]?.[me] ?? 0;
      return { driver: d, wins, losses, total: wins + losses };
    })
    .filter((r) => r.total >= 5)
    // Closest first: smallest win-rate gap from 50/50, most meetings breaks ties.
    .sort((a, b) => {
      const skew = (r: typeof a) => Math.abs(r.wins / r.total - 0.5);
      return skew(a) - skew(b) || b.total - a.total;
    })
    .slice(0, 4);

  if (rivals.length === 0) return null;

  return (
    <section className="dp-rivals">
      <h2 className="dp-section-title">Closest Rivals</h2>
      <ul className="dp-rivals-list">
        {rivals.map(({ driver, wins, losses, total }) => {
          const [lo, hi] = id < driver.id ? [id, driver.id] : [driver.id, id];
          const img = driver.profile_image ? displayImage(driver.profile_image, "driver") : null;
          const pct = (wins / total) * 100;
          const state = wins === losses ? "even" : wins > losses ? "up" : "down";
          return (
            <li key={driver.id}>
              <Link to={`/rivalry/${lo}/${hi}`} className="dp-rival">
                <span className="dp-rival-avatar">
                  {img ? <img loading="lazy" src={img} alt="" /> : <span>{driver.first_name[0]}{driver.last_name[0]}</span>}
                </span>
                <span className="dp-rival-meta">
                  <span className="dp-rival-name">{driver.first_name} {driver.last_name}</span>
                  <span className="dp-rival-bar">
                    <span className="dp-rival-bar-fill" style={{ width: `${pct}%` }} />
                  </span>
                </span>
                <span className={`dp-rival-score dp-rival-score--${state}`}>
                  {wins}<span className="dp-rival-dash">–</span>{losses}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
