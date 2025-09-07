import { useDrivers } from "../hooks/useDrivers";
import { useState } from "react";

export default function DriverList() {
  const { drivers, addDriver, loading, error } = useDrivers();
  const [name, setName] = useState("");
  const [team, setTeam] = useState("");

  if (loading) return <div>Loading…</div>;
  if (error) return <pre className="error">Error: {error}</pre>;

  return (
    <div>
      <h2>Drivers</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          await addDriver(name.trim(), team.trim() || undefined);
          setName(""); setTeam("");
        }}
        style={{ display: "flex", gap: 8, marginBottom: 12 }}
      >
        <input placeholder="Driver name" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="Team" value={team} onChange={(e) => setTeam(e.target.value)} />
        <button type="submit">Add</button>
      </form>

      <ul>
        {drivers.map(d => (
          <li key={d.id}>
            <strong>{d.name}</strong> {d.team && <em>({d.team})</em>}
          </li>
        ))}
      </ul>
    </div>
  );
}