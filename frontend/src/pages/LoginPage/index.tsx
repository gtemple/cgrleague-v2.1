import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ApiError } from "../../api/client";
import "./style.css";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      navigate("/admin");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Invalid username or password.");
      } else {
        setError("Login failed. Is the server running?");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="lg-page">
      <form className="lg-card" onSubmit={handleSubmit}>
        <span className="lg-eyebrow">CGR League · Admin</span>
        <h1 className="lg-title">Sign in</h1>

        {error && <p className="lg-error">{error}</p>}

        <div className="lg-field">
          <label className="lg-label" htmlFor="lg-username">Username</label>
          <input
            id="lg-username"
            className="lg-input"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
          />
        </div>

        <div className="lg-field">
          <label className="lg-label" htmlFor="lg-password">Password</label>
          <input
            id="lg-password"
            className="lg-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        <button className="lg-submit" type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
