import { useState } from "react";
import { ApiError } from "../../api/client";
import { useSubscribe } from "../../hooks/useNewsletter";
import "./style.css";

type Props = {
  source?: string;
};

export function NewsletterSignup({ source = "homepage" }: Props) {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState("");
  const { mutate, isLoading } = useSubscribe();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    try {
      const res = await mutate({ email, source, website });
      setDone(true);
      setMessage(res.detail);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setMessage("Too many attempts. Try again a bit later.");
      } else {
        setMessage("Something went wrong. Try again.");
      }
    }
  };

  return (
    <section className="nl-panel">
      <div className="nl-copy">
        <div className="nl-eyebrow">The Debrief</div>
        <h2 className="nl-title">Every round, in your inbox</h2>
        <p className="nl-sub">
          Race recap, podium, championship standings and what's coming next — sent
          after every grand prix. No spam, unsubscribe in one click.
        </p>
      </div>

      {done ? (
        <div className="nl-done">
          <span className="nl-done-mark">✓</span>
          <span>{message}</span>
        </div>
      ) : (
        <form className="nl-form" onSubmit={onSubmit}>
          <div className="nl-row">
            <input
              type="email"
              className="nl-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              aria-label="Email address"
            />
            <button type="submit" className="nl-submit" disabled={isLoading}>
              {isLoading ? "Sending…" : "Subscribe"}
            </button>
          </div>

          {/* Honeypot — hidden from people, irresistible to bots. */}
          <input
            type="text"
            className="nl-hp"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            aria-hidden="true"
          />

          {message && <div className="nl-error">{message}</div>}
        </form>
      )}
    </section>
  );
}
