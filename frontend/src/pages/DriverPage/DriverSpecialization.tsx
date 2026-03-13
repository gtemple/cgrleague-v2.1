import { useDriverSpecialization } from "../../hooks/useDriverSpecialization";
import { Loader } from "../../components/Loader";

export function DriverSpecialization({ driverId }: { driverId?: string }) {
  const { data, isLoading, error } = useDriverSpecialization(driverId);

  if (isLoading) {
    return (
      <section className="spec-section">
        <h2 className="section-title">Track Specialization</h2>
        <Loader label="Loading specialization…" full />
      </section>
    );
  }

  if (error || !data?.categories?.length) return null;

  const { categories, best_category } = data;

  // Find the max values for the bar chart scaling
  const maxRaces = Math.max(...categories.map((c) => c.races));

  return (
    <section className="spec-section">
      <h2 className="section-title">Track Specialization</h2>

      <div className="spec-cards">
        {categories.map((cat) => {
          const isBest = cat.category === best_category;
          return (
            <div
              key={cat.category}
              className={`spec-card${isBest ? " spec-card--best" : ""}`}
            >
              <div className="spec-card-header">
                <span className="spec-category-name">{cat.label}</span>
                {isBest && <span className="spec-badge">Strongest</span>}
              </div>

              <div className="spec-avg-finish">
                <span className="spec-big-value">
                  {cat.avg_finish != null ? cat.avg_finish.toFixed(1) : "—"}
                </span>
                <span className="spec-big-label">Avg Finish</span>
              </div>

              <div className="spec-bar-row">
                <div className="spec-bar-bg">
                  <div
                    className="spec-bar-fill"
                    style={{ width: `${(cat.races / maxRaces) * 100}%` }}
                  />
                </div>
                <span className="spec-bar-count">{cat.races} races</span>
              </div>

              <div className="spec-stats-grid">
                <div className="spec-mini">
                  <span className="spec-mini-value">{cat.points}</span>
                  <span className="spec-mini-label">Pts</span>
                </div>
                <div className="spec-mini">
                  <span className="spec-mini-value">
                    {cat.ppr != null ? cat.ppr.toFixed(1) : "—"}
                  </span>
                  <span className="spec-mini-label">PPR</span>
                </div>
                <div className="spec-mini">
                  <span className="spec-mini-value">{cat.wins}</span>
                  <span className="spec-mini-label">Wins</span>
                </div>
                <div className="spec-mini">
                  <span className="spec-mini-value">{cat.podiums}</span>
                  <span className="spec-mini-label">Podiums</span>
                </div>
                <div className="spec-mini">
                  <span className="spec-mini-value">
                    {cat.win_rate != null ? `${cat.win_rate}%` : "—"}
                  </span>
                  <span className="spec-mini-label">Win %</span>
                </div>
                <div className="spec-mini">
                  <span className="spec-mini-value">
                    {cat.podium_rate != null ? `${cat.podium_rate}%` : "—"}
                  </span>
                  <span className="spec-mini-label">Podium %</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
