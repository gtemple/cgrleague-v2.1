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
    // keep current data during manual refetch (optional):
    // setData(null);
  }, []);

  // Build a stable “request key” from path + params
  const paramsString = JSON.stringify(params ?? {});
  const requestKey = `${path}|${paramsString}`;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const tokenAtStart = refetchToken.current;

    // Immediately show loading state when the request key changes
    setLoading(true);
    setError(null);
    setData(null); // ensures your skeletons show during season switch

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
  // IMPORTANT: depend on the stable requestKey instead of the raw params object
  }, [requestKey, enabled, transform]);

  return { data, isLoading, error, refetch };
}
