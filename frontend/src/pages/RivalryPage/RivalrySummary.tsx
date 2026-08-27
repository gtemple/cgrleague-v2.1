import { useState } from "react";

type Props = {
  summary: string;
  content: string;
};

/**
 * The AI profile of a pairing. Collapsed to its one-sentence line by default —
 * the numbers below are the point of the page, and a couple of paragraphs of
 * prose above them would push everything under the fold.
 */
export function RivalrySummary({ summary, content }: Props) {
  const [open, setOpen] = useState(false);
  const paragraphs = content.split("\n\n").map((p) => p.trim()).filter(Boolean);

  return (
    <section className="rv-summary" aria-label="Rivalry summary">
      <h2 className="rv-summary-eyebrow">The story</h2>
      <p className="rv-summary-lead">{summary}</p>

      {paragraphs.length > 0 && (
        <>
          {open && (
            <div className="rv-summary-body">
              {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
            </div>
          )}
          <button
            type="button"
            className="rv-summary-toggle"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            {open ? "Show less" : "Read the full story"}
          </button>
        </>
      )}
    </section>
  );
}
