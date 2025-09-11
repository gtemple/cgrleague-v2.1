

import { SeasonStandingsTable } from "../../components/SeasonStandingsTable/index";
import { ConstructorStandingsTable } from "../../components/ConstructorStandingsTable";

export const HomePage = () => {

  return (
    <main style={{ padding: 16 }}>
      <h1>CGR League</h1>
      <SeasonStandingsTable seasonId={2} />
      <ConstructorStandingsTable seasonId={2} />
    </main>
  );
}