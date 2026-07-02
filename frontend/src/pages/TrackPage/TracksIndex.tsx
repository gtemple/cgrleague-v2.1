import { useState } from "react";
import { Link } from "react-router-dom";
import { useTracksHomepage } from "../../hooks/useTracksHomepage";
import type { TrackEntry, TrackRecord } from "../../hooks/useTracksHomepage";
import { displayImage } from "../../utils/displayImage";
import { Loader } from "../../components/Loader";
import "./TracksIndex.css";

// ─── Record tile ──────────────────────────────────────────────────────────────

const RECORD_LABELS: Record<string, string> = {
  most_races: "Most Races Held",
  most_laps:  "Most Laps Driven",
};

function RecordTile({ stat, entry }: { stat: string; entry: TrackRecord }) {
  const { track, value } = entry;
  const imgUrl = track.image ? displayImage(track.image, "trackImage") : null;
  const flagUrl = track.country ? displayImage(track.country, "flags") : null;

  return (
    <Link to={`/tracks/${track.id}`} className="trx-record">
      <div className="trx-record-left">
        <span className="trx-record-label">{RECORD_LABELS[stat]}</span>
        <span className="trx-record-value">{value.toLocaleString()}</span>
        <div className="trx-record-track-row">
          {flagUrl && <img loading="lazy" src={flagUrl} alt={track.country} className="trx-record-flag" />}
          <span className="trx-record-track-name">{track.name}</span>
        </div>
      </div>
      {imgUrl ? (
        <img loading="lazy" src={imgUrl} alt={track.name} className="trx-record-img" />
      ) : (
        <div className="trx-record-img-placeholder" />
      )}
    </Link>
  );
}

// ─── Track grid card ──────────────────────────────────────────────────────────

function TrackGridCard({ entry }: { entry: TrackEntry }) {
  const { id, name, city, country, image, races_count } = entry;
  const imgUrl = image ? displayImage(image, "trackImage") : null;
  const flagUrl = country ? displayImage(country, "flags") : null;
  const location = [city, country].filter(Boolean).join(", ");

  return (
    <Link to={`/tracks/${id}`} className="trx-grid-card">
      <div className="trx-grid-img-wrap">
        {imgUrl
          ? <img loading="lazy" src={imgUrl} alt={name} className="trx-grid-img" />
          : <div className="trx-grid-img-placeholder" />
        }
      </div>
      <div className="trx-grid-info">
        <div className="trx-grid-name">{name}</div>
        <div className="trx-grid-meta">
          {flagUrl && <img loading="lazy" src={flagUrl} alt={country} className="trx-grid-flag" />}
          {location && <span className="trx-grid-location">{location}</span>}
        </div>
        <div className="trx-grid-stats">
          {races_count > 0 && (
            <span className="trx-grid-races">{races_count} race{races_count !== 1 ? "s" : ""}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const TracksIndex = () => {
  const { data, isLoading, error } = useTracksHomepage();
  const [search, setSearch] = useState("");

  if (isLoading) return <Loader label="Loading tracks…" full />;
  if (error || !data) return <div style={{ color: "crimson", padding: 20 }}>Failed to load tracks.</div>;

  const { all_tracks, records } = data;
  const recordEntries = Object.entries(records).filter(([, v]) => v !== null) as [string, TrackRecord][];

  const filtered = search.trim()
    ? all_tracks.filter((t) =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.city.toLowerCase().includes(search.toLowerCase()) ||
        t.country.toLowerCase().includes(search.toLowerCase())
      )
    : all_tracks;

  return (
    <div className="trx-page">

      {/* ── Header band ── */}
      <div className="trx-header-band">
        <div className="trx-header-inner">
          <div>
            <div className="trx-eyebrow">CGR LEAGUE · CIRCUITS</div>
            <h1 className="trx-title">Tracks</h1>
          </div>
          <span className="trx-chip">{all_tracks.length} TRACKS</span>
        </div>
      </div>

      <div className="trx-body">

        {/* ── Records ── */}
        {recordEntries.length > 0 && (
          <section className="trx-section">
            <div className="trx-section-eyebrow-row">
              <span className="trx-section-eyebrow">ALL-TIME RECORDS</span>
            </div>
            <div className="trx-records">
              {recordEntries.map(([stat, entry]) => (
                <RecordTile key={stat} stat={stat} entry={entry} />
              ))}
            </div>
          </section>
        )}

        {/* ── Track Grid ── */}
        <section className="trx-section">
          <div className="trx-section-eyebrow-row trx-section-eyebrow-row--space">
            <span className="trx-section-eyebrow">ALL TRACKS</span>
            <input
              className="trx-search"
              type="search"
              placeholder="Search tracks…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="trx-track-grid">
            {filtered.map((entry) => (
              <TrackGridCard key={entry.id} entry={entry} />
            ))}
            {filtered.length === 0 && (
              <p className="trx-empty">No tracks match "{search}"</p>
            )}
          </div>
        </section>

      </div>
    </div>
  );
};
