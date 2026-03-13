import React, { createContext, useCallback, useContext, useState } from "react";
import { fetchJson } from "../api/client";

const TOKEN_KEY = "cgrleague_admin_token";
const USERNAME_KEY = "cgrleague_admin_username";

type AuthContextType = {
  token: string | null;
  username: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [username, setUsername] = useState<string | null>(() => localStorage.getItem(USERNAME_KEY));

  const login = useCallback(async (user: string, pass: string) => {
    const data = await fetchJson<{ token: string; username: string }>("/api/auth/login/", {
      method: "POST",
      body: JSON.stringify({ username: user, password: pass }),
    });
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USERNAME_KEY, data.username);
    setToken(data.token);
    setUsername(data.username);
  }, []);

  const logout = useCallback(async () => {
    if (token) {
      try {
        await fetchJson("/api/auth/logout/", {
          method: "POST",
          headers: { Authorization: `Token ${token}` },
        });
      } catch {
        // ignore errors on logout
      }
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
    setToken(null);
    setUsername(null);
  }, [token]);

  return (
    <AuthContext.Provider value={{ token, username, isAuthenticated: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
