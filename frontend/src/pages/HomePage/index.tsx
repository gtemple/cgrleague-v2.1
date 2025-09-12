

import { SeasonStandingsTable } from "../../components/SeasonStandingsTable/index";
import { ConstructorStandingsTable } from "../../components/ConstructorStandingsTable/index";
import { NextRaceTeaser } from "../../components/NextRaceTeaser/index";

import './style.css'

export const HomePage = () => {
  const currentSeasonId = 7;

  return (
    <main style={{ padding: 16 }}>
      <NextRaceTeaser includeSprints={true} />
      <div className="standings-container">
        <SeasonStandingsTable seasonId={currentSeasonId} />
        <ConstructorStandingsTable seasonId={currentSeasonId} />
      </div>
    </main>
  );
}