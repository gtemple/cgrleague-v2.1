import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDriversList } from "../../hooks/useDriverList";
import { useTeamsList } from "../../hooks/useTeamsList";
import { useTracksList } from "../../hooks/useTrackList";
import { useArticleList } from "../../hooks/useArticles";
import { displayImage } from "../../utils/displayImage";
import "./style.css";

type ResultItem = {
  type: "driver" | "team" | "track" | "article";
  id: number;
  label: string;
  sublabel: string;
  href: string;
  image?: string | null;
};

function highlight(text: string, query: string) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="srch-mark">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

const TYPE_ICON: Record<ResultItem["type"], string> = {
  driver:  "DRV",
  team:    "TM",
  track:   "TRK",
  article: "ART",
};

const TYPE_LABEL: Record<ResultItem["type"], string> = {
  driver:  "Drivers",
  team:    "Teams",
  track:   "Tracks",
  article: "Articles",
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SearchModal({ open, onClose }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { data: driverData }  = useDriversList();
  const { data: teamData }    = useTeamsList();
  const { tracks }            = useTracksList();
  const { data: articleData } = useArticleList();

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const results = useMemo((): ResultItem[] => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const items: ResultItem[] = [];

    // Drivers
    (driverData ?? []).forEach((d) => {
      const full = `${d.first_name} ${d.last_name}`.toLowerCase();
      if (full.includes(q) || d.display_name?.toLowerCase().includes(q)) {
        items.push({
          type: "driver",
          id: d.id,
          label: d.display_name ?? `${d.first_name} ${d.last_name}`,
          sublabel: "Driver",
          href: `/drivers/${d.id}`,
          image: d.profile_image,
        });
      }
    });

    // Teams
    (teamData?.teams ?? []).forEach((t) => {
      if (t.team_name.toLowerCase().includes(q)) {
        items.push({
          type: "team",
          id: t.id,
          label: t.team_name,
          sublabel: "Team",
          href: `/teams/${t.id}`,
        });
      }
    });

    // Tracks
    tracks.forEach((t) => {
      const searchable = [t.name, t.city, t.country].filter(Boolean).join(" ").toLowerCase();
      if (searchable.includes(q)) {
        items.push({
          type: "track",
          id: t.id,
          label: t.name,
          sublabel: [t.city, t.country].filter(Boolean).join(", ") || "Track",
          href: `/tracks/${t.id}`,
        });
      }
    });

    // Articles
    (articleData ?? []).forEach((a) => {
      const searchable = [a.title, a.teaser, a.race?.track?.name].filter(Boolean).join(" ").toLowerCase();
      if (searchable.includes(q)) {
        items.push({
          type: "article",
          id: a.id,
          label: a.title,
          sublabel: a.race?.track?.name ?? a.type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
          href: `/articles/${a.id}`,
        });
      }
    });

    return items;
  }, [query, driverData, teamData, tracks, articleData]);

  // Keep activeIdx in bounds
  useEffect(() => {
    setActiveIdx(0);
  }, [results.length]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const go = (item: ResultItem) => {
    navigate(item.href);
    onClose();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIdx]) {
      go(results[activeIdx]);
    }
  };

  if (!open) return null;

  // Group results by type for section headers
  const groups: { type: ResultItem["type"]; items: ResultItem[]; startIdx: number }[] = [];
  let cursor = 0;
  (["driver", "team", "track", "article"] as const).forEach((type) => {
    const items = results.filter((r) => r.type === type);
    if (items.length) {
      groups.push({ type, items, startIdx: cursor });
      cursor += items.length;
    }
  });

  return (
    <div className="srch-backdrop" onClick={onClose}>
      <div className="srch-modal" onClick={(e) => e.stopPropagation()} onKeyDown={onKey}>

        {/* Input row */}
        <div className="srch-input-row">
          <span className="srch-input-icon">⌕</span>
          <input
            ref={inputRef}
            className="srch-input"
            placeholder="Search drivers, teams, tracks, articles…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="srch-clear" onClick={() => setQuery("")}>✕</button>
          )}
        </div>

        {/* Results */}
        <div className="srch-results" ref={listRef}>
          {query && results.length === 0 && (
            <div className="srch-empty">No results for "{query}"</div>
          )}

          {!query && (
            <div className="srch-hint">
              <span>Search across drivers, teams, tracks, and articles</span>
            </div>
          )}

          {groups.map(({ type, items, startIdx }) => (
            <div key={type} className="srch-group">
              <div className="srch-group-label">
                {TYPE_LABEL[type]}
              </div>
              {items.map((item, i) => {
                const flatIdx = startIdx + i;
                const isActive = flatIdx === activeIdx;
                return (
                  <button
                    key={item.id}
                    data-idx={flatIdx}
                    className={`srch-result${isActive ? " srch-result-active" : ""}`}
                    onClick={() => go(item)}
                    onMouseEnter={() => setActiveIdx(flatIdx)}
                  >
                    <div className="srch-result-avatar">
                      {item.image && (item.type === "driver" || item.type === "team") ? (
                        <img loading="lazy"
                          src={displayImage(item.image, item.type)}
                          alt=""
                        />
                      ) : (
                        <span className="srch-result-icon">{TYPE_ICON[item.type]}</span>
                      )}
                    </div>
                    <div className="srch-result-text">
                      <span className="srch-result-label">
                        {highlight(item.label, query)}
                      </span>
                      <span className="srch-result-sub">{item.sublabel}</span>
                    </div>
                    <span className="srch-result-arrow">→</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="srch-footer">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
