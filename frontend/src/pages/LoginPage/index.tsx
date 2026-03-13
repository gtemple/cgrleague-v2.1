import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ApiError } from "../../api/client";

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
      navigate("/admin/results");
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
    <div style={{ display: "flex", justifyContent: "center", paddingTop: "4rem" }}>
      <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 360 }}>
        <h2 style={{ marginBottom: "1.5rem" }}>Admin Login</h2>
        {error && (
          <p style={{ color: "#f87171", marginBottom: "1rem" }}>{error}</p>
        )}
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: 4, fontSize: "0.875rem", color: "rgba(255,255,255,0.7)" }}>
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
            style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", marginBottom: 4, fontSize: "0.875rem", color: "rgba(255,255,255,0.7)" }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            style={inputStyle}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "0.65rem 1rem",
            background: "#e10600",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontWeight: 600,
            fontSize: "0.95rem",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Logging in…" : "Login"}
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.55rem 0.75rem",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 6,
  color: "#fff",
  fontSize: "0.95rem",
  boxSizing: "border-box",
};
