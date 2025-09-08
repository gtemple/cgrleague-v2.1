// src/hooks/useApiQuery.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchJson, ApiError } from "../api/client";

export type QueryState<T> = {
  data: T | null;
  isLoading: boolean;
  error: Error | ApiError | null;
  refetch: () => void;
};

type Options<T> = {
  params?: Record<string, string | number | boolean | undefined>;
  enabled?: boolean;
  transform?: (data: T) => T;
};

export function useApiQuery<T = unknown>(
  path: string,
  { params, enabled = true, transform }: Options<T> = {}
): QueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setLoading] = useState<boolean>(!!enabled);
  const [error, setError] = useState<Error | ApiError | null>(null);
  const refetchToken = useRef(0);

  const refetch = useCallback(() => {
    refetchToken.current += 1;
    setLoading(true);
  }, []);

  // stable key for params
  const paramsString = useMemo(() => JSON.stringify(params ?? {}), [params]);

  // keep transform stable (init with identity fn)
  const transformRef = useRef<(d: T) => T>((d) => d);
  useEffect(() => {
    transformRef.current = transform ?? ((d) => d);
  }, [transform]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const tokenAtStart = refetchToken.current;

    (async () => {
      try {
        setError(null);
        const json = await fetchJson<T>(path, { params });
        const final = transformRef.current(json);
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

    return () => { cancelled = true; };
  }, [path, paramsString, enabled]);

  return { data, isLoading, error, refetch };
}
