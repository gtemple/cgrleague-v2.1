// src/hooks/useApiQuery.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchJson, ApiError } from "../api/client";

export type QueryState<T> = {
  data: T | null;
  isLoading: boolean;
  error: Error | ApiError | null;
  refetch: () => void;
};

type Options<T> = {
  params?: Record<string, string | number | boolean | undefined>;
  enabled?: boolean;          // default true
  transform?: (data: T) => T; // e.g. sorting
  keepPreviousData?: boolean; // <-- NEW (default false)
};

export function useApiQuery<T = unknown>(
  path: string,
  { params, enabled = true, transform, keepPreviousData = false }: Options<T> = {}
): QueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setLoading] = useState<boolean>(!!enabled);
  const [error, setError] = useState<Error | ApiError | null>(null);
  const refetchToken = useRef(0);

  const refetch = useCallback(() => {
    refetchToken.current += 1;
    setLoading(true);
  }, []);

  const paramsString = JSON.stringify(params ?? {});
  const requestKey = `${path}|${paramsString}`;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const tokenAtStart = refetchToken.current;

    setLoading(true);
    setError(null);
    if (!keepPreviousData) setData(null); // <-- preserve data if asked

    (async () => {
      try {
        const json = await fetchJson<T>(path, { params });
        const final = transform ? transform(json) : json;
        if (!cancelled && tokenAtStart === refetchToken.current) {
          setData(final);
        }
      } catch (e) {
        if (!cancelled && tokenAtStart === refetchToken.current) {
          setError(e as Error);
          setData(null);
        }
      } finally {
        if (!cancelled && tokenAtStart === refetchToken.current) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // IMPORTANT: do NOT depend on `transform` — changing it shouldn’t refetch
  }, [requestKey, enabled]); 

  // If transform changes, just re-derive from current data (no refetch)
  useEffect(() => {
    if (transform && data != null) {
      setData(transform(data));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transform]);

  return { data, isLoading, error, refetch };
}
