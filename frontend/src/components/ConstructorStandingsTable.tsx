import { useConstructorStandings } from "../hooks/useConstructorStandings";

export function ConstructorStandingsTable({ seasonId }: { seasonId: number }) {
const { data, isLoading, error } = useConstructorStandings(seasonId);

if (isLoading) return 'Loading';
if (error) return <div>Failed to load standings.</div>;

return (
  <ol>
    {data?.map((row) => (
      <li key={row.team_season_id}>
        {row.team.name} — {row.points} pts
      </li>
    ))}
  </ol>
);
}
