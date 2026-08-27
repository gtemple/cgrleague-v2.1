import { Link } from "react-router-dom";
import { useDriverRivals, type RivalEntry } from "../../hooks/useDriverRivals";
import { displayImage } from "../../utils/displayImage";

/** Matches the "established grid" cutoff used by Driver DNA. */
const MIN_RACES = 10;

export function DriverRivals({ driverId }: { driverId: string | undefined }) {
  const id = Number(driverId);
  const { data, isLoading } = useDriverRivals(driverId);

  if (isLoading || !data || !Number.isFinite(id)) return null;

  // Below the cutoff a 3-2 record outranks a 107-race rivalry, so only fall
  // back to short samples when there's nothing established to show.
  const established = data.rivals.filter((r) => r.races >= MIN_RACES);
  const pool: RivalEntry[] = established.length ? established : data.rivals;
  const rivals = pool.slice(0, 6);

  if (rivals.length === 0) return null;

  return (
    <section className="dp-rivals">
      <h2 className="dp-section-title">Closest Rivals</h2>
      <ul className="dp-rivals-list">
        {rivals.map(({ driver, wins, losses, races }) => {
          const [lo, hi] = id < driver.id ? [id, driver.id] : [driver.id, id];
          const img = driver.profile_image ? displayImage(driver.profile_image, "driver") : null;
          const pct = (wins / races) * 100;
          const state = wins === losses ? "even" : wins > losses ? "up" : "down";
          return (
            <li key={driver.id}>
              <Link to={`/rivalry/${lo}/${hi}`} className="dp-rival">
                <span className="dp-rival-avatar">
                  {img
                    ? <img loading="lazy" src={img} alt="" />
                    : <span>{driver.first_name[0]}{driver.last_name[0]}</span>}
                </span>
                <span className="dp-rival-meta">
                  <span className="dp-rival-name">
                    {driver.first_name} {driver.last_name}
                    {!driver.human && <span className="dp-rival-ai">AI</span>}
                  </span>
                  <span className="dp-rival-bar">
                    <span className="dp-rival-bar-fill" style={{ width: `${pct}%` }} />
                  </span>
                </span>
                <span className={`dp-rival-score dp-rival-score--${state}`}>
                  {wins}<span className="dp-rival-dash">–</span>{losses}
                  <span className="dp-rival-races">{races}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
