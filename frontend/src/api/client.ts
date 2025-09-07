const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/";

type FetchOptions = RequestInit & { json?: unknown };

function buildUrl(path: string) {
  // Ensures exactly one slash between base and path
  const base = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export async function http<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(buildUrl(path), {
    credentials: "include", // good habit for CSRF/logged-in endpoints
    ...options,
    headers,
    body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
  });

  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* leave as text */ }

  if (!res.ok) {
    const message = typeof data === "object" && data?.detail
      ? data.detail
      : `${res.status} ${res.statusText}`;
    throw new Error(message);
  }
  return data as T;
}