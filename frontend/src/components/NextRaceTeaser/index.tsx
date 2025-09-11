import { useNextRaceTeaser,
  type NextTwoItem,
  type UpcomingRaceBlock,
  type RecentWinnerItem
} from "../../hooks/useNextRaceTeaser";
import { displayImage } from "../../utils/displayImage";
import "./style.css";

export function NextRaceTeaser({ includeSprints = false }: { includeSprints?: boolean }) {
  const { data, isLoading, error } = useNextRaceTeaser({ includeSprints });

  if (isLoading) {
    return (
      <div className="teaser-grid">
        <div className="teaser-card">
          <div className="teaser-header"><h3>Next Race</h3></div>
          <div className="teaser-skeleton" />
        </div>
        <div className="teaser-card">
          <div className="teaser-header"><h3>Also Coming Up</h3></div>
          <div className="teaser-skeleton" />
        </div>
      </div>
    );
  }

  if (error) {
    const msg = error instanceof Error ? error.message : "Failed to load";
    return (
      <div className="teaser-grid">
        <div className="teaser-card">
          <div className="teaser-header"><h3>Next Race</h3></div>
          <div className="teaser-error">{msg}</div>
        </div>
        <div className="teaser-card">
          <div className="teaser-header"><h3>Also Coming Up</h3></div>
          <div className="teaser-error">{msg}</div>
        </div>
      </div>
    );
  }

  // data is typed by the hook; guard for nulls per type
  if (!data || !data.upcoming_race) {
    return (
      <div className="teaser-grid">
        <div className="teaser-card">
          <div className="teaser-header"><h3>Next Race</h3></div>
          <div className="teaser-muted">No upcoming race found.</div>
        </div>
        <div className="teaser-card">
          <div className="teaser-header"><h3>Also Coming Up</h3></div>
          <div className="teaser-muted">No additional races.</div>
        </div>
      </div>
    );
  }

  const upcoming_race: UpcomingRaceBlock = data.upcoming_race;
  const recent_winners: RecentWinnerItem[] = data.recent_winners ?? [];
  const nextTwo: NextTwoItem[] = data.following_two ?? [];

  console.log(data)

  const { race, track } = upcoming_race;

  const trackImg = track.image ? displayImage(track.image, "trackImage") : null;
  const flagImg = track.country ? displayImage(track.country, "flags") : null;

  return (
    <div className="teaser-grid">
      {/* LEFT: Next race */}
      <div className="teaser-card">
        <div className="teaser-header">
          <h3>Next Race</h3>
          {race.is_sprint && <span className="pill pill-sprint">Sprint</span>}
        </div>

        <div className="teaser-track">
          {trackImg && (
            <div className="teaser-track-image">
              <img src={trackImg} alt={track.name} />
            </div>
          )}
          <div className="teaser-track-meta">
            <div className="teaser-track-title">
              {flagImg && <img className="teaser-flag" src={flagImg} alt={track.country} />}
              <span>{track.name}</span>
            </div>
            <div className="teaser-track-sub">
              Round {race.round} • {track.city ? `${track.city}, ` : ""}{track.country}
            </div>
          </div>
        </div>

        {recent_winners.length > 0 && (
          <div className="teaser-section">
            <div className="teaser-section-title">Recent Winners</div>

            <div className="winner-stack">
              {recent_winners.map((w, i) => {
                const driverImg = w.driver.profile_image ? displayImage(w.driver.profile_image, "driver") : null;
                const teamLogo = w.team.logo_image ? displayImage(w.team.name, "team") : null;

                return (
                  <div className={"winner-row" + (i === 0 ? " first" : "")} key={`${w.season_id}-${w.driver.id}`}>
                    <div className="wr-left">
                      <div className="wr-avatar">
                        {driverImg ? <img src={driverImg} alt={w.driver.display_name} /> : <div className="wr-avatar-fallback" />}
                      </div>
                      <div className="wr-meta">
                        <div className="wr-name">{w.driver.display_name}</div>
                        <div className="wr-sub">Season {w.season_id}</div>
                      </div>
                    </div>
                    <div className="wr-right">
                      {teamLogo && <img className="wr-team-logo" src={teamLogo} alt={w.team.name} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT: Next two races */}
      <div className="teaser-card">
        <div className="teaser-header">
          <h3>Also Coming Up</h3>
        </div>

        {nextTwo.length === 0 ? (
          <div className="teaser-muted">No additional races.</div>
        ) : (
          <div className="nexttwo-list">
            {nextTwo.map(({ event, last_winner }) => {
              const t = event.track;
              const tImg = t.image ? displayImage(t.image, "trackImage") : null;
              const fImg = t.country ? displayImage(t.country, "flags") : null;

              const winnerAvatar = last_winner?.driver?.profile_image
                ? displayImage(last_winner.driver.profile_image, "driver")
                : null;

              const winnerTeamLogo = last_winner?.team?.logo_image
                ? displayImage(last_winner.team.name, "team")
                : null;

              return (
                <div className="nexttwo-row" key={event.id}>
                  {tImg ? (
                    <div className="nt-thumb">
                      <img src={tImg} alt={t.name || "Track"} />
                    </div>
                  ) : (
                    <div className="nt-thumb nt-thumb-fallback" />
                  )}

                  <div className="nt-meta">
                    <div className="nt-title">
                      {fImg && <img className="teaser-flag" src={fImg} alt={t.country} />}
                      <span>{t.name || "TBA"}</span>
                    </div>
                    <div className="nt-sub">
                      Round {event.round}{t.city ? ` • ${t.city}` : ""}{t.country ? `, ${t.country}` : ""}
                    </div>
                  </div>

                  <div className="nt-winner">
                    {last_winner ? (
                      <>
                        <div className="nt-winner-left">
                          <div className="nt-avatar">
                            {winnerAvatar ? <img src={winnerAvatar} alt={last_winner.driver.display_name} /> : <div className="nt-avatar-fallback" />}
                          </div>
                          <div className="nt-winner-meta">
                            <div className="nt-winner-name">{last_winner.driver.display_name}</div>
                            <div className="nt-winner-sub">{last_winner.team?.name || ""}</div>
                          </div>
                        </div>
                        {winnerTeamLogo && <img className="nt-team-logo" src={winnerTeamLogo} alt={last_winner.team?.name || "Team"} />}
                      </>
                    ) : (
                      <span className="teaser-muted">No prior winner</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
