import { usePing } from "../hooks/usePing";
import DriverList from "../components/DriverList";
import { SeasonStandingsTable } from "../components/SeasonStandingsTable";

export default function HomePage() {
  const { data } = usePing();
  return (
    <main style={{ padding: 16 }}>
      <h1>CGR League</h1>
      <p>Backend status: {data ? data.status : "…"}</p>
      <DriverList />
      <SeasonStandingsTable seasonId={1} />
    </main>
  );
}