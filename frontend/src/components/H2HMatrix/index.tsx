import { useH2HMatrix, type H2HDriver } from "../../hooks/useH2HMatrix";
import { displayImage } from "../../utils/displayImage";
import { Loader } from "../Loader";
import "./style.css";

function shortName(d: H2HDriver) {
  if (d.first_name && d.last_name) return `${d.first_name[0]}. ${d.last_name}`;
  return d.first_name || d.last_name || `#${d.id}`;
}

function initials(d: H2HDriver) {
  const f = (d.first_name || "").charAt(0).toUpperCase();
  const l = (d.last_name || "").charAt(0).toUpperCase();
  return f + l || `#${d.id}`;
}

export function H2HMatrix() {
  const { data, isLoading } = useH2HMatrix();

  if (isLoading) return <Loader />;
  if (!data || data.drivers.length < 2) return null;

  const { drivers, matrix } = data;

  return (
    <div className="h2h-wrap">
      <div className="h2h-table-scroll">
        <table className="h2h-table">
          <thead>
            <tr>
              {/* top-left corner label */}
              <th className="h2h-corner">
                <span className="h2h-corner-row">Row wins</span>
                <div className="h2h-corner-divider" />
                <span className="h2h-corner-col">vs →</span>
              </th>
              {drivers.map((col) => (
                <th key={col.id} className="h2h-col-header">
                  <div className="h2h-col-avatar">
                    {col.profile_image
                      ? <img loading="lazy" src={displayImage(col.profile_image, "driver")} alt={shortName(col)} />
                      : <span className="h2h-initials">{initials(col)}</span>}
                  </div>
                  <span className="h2h-col-name">{shortName(col)}</span>
                </th>
              ))}
              <th className="h2h-totals-header">W – L</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((row) => {
              const rowStr = String(row.id);
              let totalWins = 0;
              let totalLosses = 0;
              drivers.forEach((col) => {
                if (col.id === row.id) return;
                const colStr = String(col.id);
                totalWins += matrix[rowStr]?.[colStr] ?? 0;
                totalLosses += matrix[colStr]?.[rowStr] ?? 0;
              });

              return (
                <tr key={row.id}>
                  {/* Row header */}
                  <td className="h2h-row-header">
                    <div className="h2h-row-driver">
                      <div className="h2h-row-avatar">
                        {row.profile_image
                          ? <img loading="lazy" src={displayImage(row.profile_image, "driver")} alt={shortName(row)} />
                          : <span className="h2h-initials">{initials(row)}</span>}
                      </div>
                      <span className="h2h-row-name">{row.first_name} {row.last_name}</span>
                    </div>
                  </td>

                  {/* Data cells */}
                  {drivers.map((col) => {
                    if (col.id === row.id) {
                      return <td key={col.id} className="h2h-cell h2h-self" />;
                    }
                    const wins = matrix[String(row.id)]?.[String(col.id)] ?? 0;
                    const losses = matrix[String(col.id)]?.[String(row.id)] ?? 0;
                    const total = wins + losses;
                    const ratio = total > 0 ? wins / total : 0.5;

                    let cls = "h2h-cell";
                    if (total === 0) cls += " h2h-no-data";
                    else if (ratio > 0.5) cls += " h2h-win";
                    else if (ratio < 0.5) cls += " h2h-loss";
                    else cls += " h2h-even";

                    return (
                      <td key={col.id} className={cls}>
                        {total > 0 ? (
                          <>
                            <span className="h2h-cell-wins">{wins}</span>
                            <span className="h2h-cell-sep">/</span>
                            <span className="h2h-cell-total">{total}</span>
                          </>
                        ) : (
                          <span className="h2h-cell-na">—</span>
                        )}
                      </td>
                    );
                  })}

                  {/* Totals */}
                  <td className="h2h-cell h2h-totals">
                    <span className="h2h-total-wins">{totalWins}</span>
                    <span className="h2h-total-sep"> – </span>
                    <span className="h2h-total-losses">{totalLosses}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="h2h-legend">
        Cell shows <strong>row driver's wins / races together</strong>. Green = winning record, red = losing record.
      </p>
    </div>
  );
}
