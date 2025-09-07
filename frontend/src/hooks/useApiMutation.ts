// src/hooks/useApiMutation.ts
import { useCallback, useState } from "react";
import { fetchJson, ApiError } from "../api/client";
import { getCookie } from "../lib/csrf"; // you already have this

type MutationOptions<TBody> = {
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  withCsrf?: boolean; // default true for non-GET
  headers?: Record<string, string>;
  // optional side-effects
  onSuccess?: (data: unknown) => void;
  onError?: (e: Error | ApiError) => void;
  bodyTransform?: (body: TBody) => unknown; // e.g. to FormData later if needed
};

export function useApiMutation<TResp = unknown, TBody = unknown>(
  path: string,
  { method = "POST", withCsrf = true, headers, onSuccess, onError, bodyTransform }: MutationOptions<TBody> = {}
) {
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<Error | ApiError | null>(null);

  const mutate = useCallback(
    async (body?: TBody): Promise<TResp> => {
      setLoading(true);
      setError(null);
      try {
        const csrf = withCsrf ? getCookie("csrftoken") : undefined;
        const resp = await fetchJson<TResp>(path, {
          method,
          headers: {
            ...(headers || {}),
            ...(csrf ? { "X-CSRFToken": csrf } : {}),
          },
          body: body !== undefined ? JSON.stringify(bodyTransform ? bodyTransform(body) : body) : undefined,
        });
        onSuccess?.(resp);
        return resp;
      } catch (e) {
        setError(e as Error);
        onError?.(e as Error);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [path, method, withCsrf, headers, onSuccess, onError, bodyTransform]
  );

  return { mutate, isLoading, error };
}
