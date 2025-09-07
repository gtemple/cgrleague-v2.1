import { useEffect, useState } from "react";
import { getPing, type PingResponse } from "../api/ping";

export function usePing() {
  const [data, setData] = useState<PingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPing().then(setData).catch((e) => setError(String(e))).finally(() => setLoading(false));
  }, []);

  return { data, error, loading };
}
