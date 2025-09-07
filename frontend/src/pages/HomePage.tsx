
import DriverList from "../components/DriverList";
import { SeasonStandingsTable } from "../components/SeasonStandingsTable";

export default function HomePage() {

  return (
    <main style={{ padding: 16 }}>
      <h1>CGR League</h1>
      <DriverList />
      <SeasonStandingsTable seasonId={2} />
    </main>
  );
}