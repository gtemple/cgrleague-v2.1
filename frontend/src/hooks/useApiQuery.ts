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
  enabled?: boolean;             // default true
  transform?: (data: T) => T;    // e.g. sorting
};

export function useApiQuery<T = unknown>(path: string, { params, enabled = true, transform }: Options<T> = {}): QueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setLoading] = useState<boolean>(!!enabled);
  const [error, setError] = useState<Error | ApiError | null>(null);
  const refetchToken = useRef(0);

  const refetch = useCallback(() => {
    refetchToken.current += 1;
    setLoading(true);
  }, []);

  // Extract paramsString for dependency
  const paramsString = JSON.stringify(params);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const tokenAtStart = refetchToken.current;

    (async () => {
      try {
        setError(null);
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
  }, [path, params, paramsString, enabled, transform]);

  return { data, isLoading, error, refetch };
}