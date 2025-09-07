// src/api/client.ts
export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

function getApiBase() {
  return (
    import.meta.env.VITE_API_BASE_URL ||
    "" // same-origin for dev proxy
  );
}

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>) {
  const base = getApiBase();
  const url = new URL(path.startsWith("http") ? path : `${base}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export async function fetchJson<T>(
  path: string,
  opts: RequestInit & { params?: Record<string, string | number | boolean | undefined> } = {}
): Promise<T> {
  const { params, headers, ...rest } = opts;
  const url = buildUrl(path, params);
  const res = await fetch(url, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(headers || {}),
    },
    ...rest,
  });

  // Try to parse JSON even on errors
  const text = await res.text();
  const maybeJson = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;

  if (!res.ok) {
    throw new ApiError(`HTTP ${res.status} for ${url}`, res.status, maybeJson);
  }
  return (maybeJson as T) ?? ({} as T);
}
