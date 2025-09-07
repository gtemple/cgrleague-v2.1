import { useSeasonStandings } from "../hooks/useSeasonStandings";

export function SeasonStandingsTable({ seasonId }: { seasonId: number }) {
  const { data, isLoading, error } = useSeasonStandings(seasonId);

  if (isLoading) return <p>Loading…</p>;
  if (error) return <p>Failed: {error.message}</p>;
  if (!data?.length) return <p>No results.</p>;

  return (
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Driver</th>
          <th>Team</th>
          <th>Pts</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row, idx) => (
          <tr key={row.driver_season_id}>
            <td>{idx + 1}</td>
            <td>{row.driver.display_name}</td>
            <td>{row.team.name}</td>
            <td>{row.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
