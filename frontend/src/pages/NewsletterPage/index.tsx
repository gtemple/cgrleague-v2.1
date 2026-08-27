import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { NewsletterSignup } from "../../components/NewsletterSignup";
import { useConfirmSubscription, useUnsubscribe } from "../../hooks/useNewsletter";
import "./style.css";

type State = "working" | "done" | "failed";

function Shell({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <div className="nlp-page">
      <div className="nlp-wrap">
        <div className="nlp-card">
          <div className="nlp-head">
            <div className="nlp-eyebrow">{eyebrow}</div>
            <h1 className="nlp-title">{title}</h1>
          </div>
          <div className="nlp-body">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function NewsletterConfirmPage() {
  const { token } = useParams<{ token: string }>();
  const { mutate } = useConfirmSubscription();
  const [state, setState] = useState<State>("working");
  const fired = useRef(false);

  useEffect(() => {
    if (!token || fired.current) return;
    fired.current = true;
    mutate({ token })
      .then(() => setState("done"))
      .catch(() => setState("failed"));
  }, [token, mutate]);

  if (state === "working") {
    return (
      <Shell eyebrow="Newsletter" title="Confirming…">
        <p className="nlp-text">One moment.</p>
      </Shell>
    );
  }

  if (state === "failed") {
    return (
      <Shell eyebrow="Newsletter" title="Link expired">
        <p className="nlp-text">
          That confirmation link is no longer valid. Sign up again and we'll send a fresh one.
        </p>
        <div className="nlp-signup"><NewsletterSignup source="confirm-retry" /></div>
      </Shell>
    );
  }

  return (
    <Shell eyebrow="Newsletter" title="You're in">
      <p className="nlp-text">
        You'll get the recap, the standings and what's coming next after every round.
      </p>
      <Link to="/" className="nlp-btn">Back to the league</Link>
    </Shell>
  );
}

export function NewsletterUnsubscribePage() {
  const { token } = useParams<{ token: string }>();
  const { mutate, isLoading } = useUnsubscribe();
  // Deliberately not automatic: mail scanners follow links, and nobody should be
  // unsubscribed by a link preview.
  const [state, setState] = useState<State | "idle">("idle");

  const onConfirm = () => {
    if (!token) return;
    setState("working");
    mutate({ token })
      .then(() => setState("done"))
      .catch(() => setState("failed"));
  };

  if (state === "done") {
    return (
      <Shell eyebrow="Newsletter" title="Unsubscribed">
        <p className="nlp-text">You won't get any more emails from us. Changed your mind?</p>
        <div className="nlp-signup"><NewsletterSignup source="resubscribe" /></div>
      </Shell>
    );
  }

  if (state === "failed") {
    return (
      <Shell eyebrow="Newsletter" title="Link expired">
        <p className="nlp-text">
          That link is no longer valid — you may already be unsubscribed.
        </p>
        <Link to="/" className="nlp-btn">Back to the league</Link>
      </Shell>
    );
  }

  return (
    <Shell eyebrow="Newsletter" title="Unsubscribe?">
      <p className="nlp-text">
        Confirm below and we'll stop sending you the round-by-round email.
      </p>
      <button className="nlp-btn" onClick={onConfirm} disabled={isLoading || state === "working"}>
        {state === "working" || isLoading ? "Unsubscribing…" : "Yes, unsubscribe"}
      </button>
    </Shell>
  );
}

export function NewsletterPage() {
  return (
    <div className="nlp-page">
      <div className="nlp-wrap">
        <NewsletterSignup source="newsletter-page" />
      </div>
    </div>
  );
}
