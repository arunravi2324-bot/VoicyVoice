import { useState, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_URL ?? "";
const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000;

function isSessionValid(): boolean {
  const auth = sessionStorage.getItem("voicyvoice_auth");
  const timestamp = sessionStorage.getItem("voicyvoice_auth_at");
  if (auth !== "true" || !timestamp) return false;
  return Date.now() - parseInt(timestamp) < SESSION_TIMEOUT_MS;
}

function clearSession() {
  sessionStorage.removeItem("voicyvoice_auth");
  sessionStorage.removeItem("voicyvoice_creds");
  sessionStorage.removeItem("voicyvoice_auth_at");
}

export function useAuth() {
  const [authed, setAuthed] = useState(() => isSessionValid());
  const [error, setError] = useState<string>();

  if (authed && !isSessionValid()) {
    clearSession();
    setAuthed(false);
  }

  const login = useCallback(async (username: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/calls/active`, {
        headers: {
          Authorization: `Basic ${btoa(`${username}:${password}`)}`,
        },
      });

      if (res.ok) {
        sessionStorage.setItem("voicyvoice_auth", "true");
        sessionStorage.setItem("voicyvoice_creds", btoa(`${username}:${password}`));
        sessionStorage.setItem("voicyvoice_auth_at", String(Date.now()));
        setAuthed(true);
        setError(undefined);
      } else {
        setError("Invalid credentials");
      }
    } catch {
      setError("Unable to reach server");
    }
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setAuthed(false);
  }, []);

  return { authed, login, logout, error };
}
