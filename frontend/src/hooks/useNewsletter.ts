import { useApiMutation } from "./useApiMutation";

type DetailResponse = { detail: string; email?: string };

// Public, unauthenticated endpoints — no session cookie, so no CSRF token.
const PUBLIC = { withCsrf: false } as const;

export function useSubscribe() {
  return useApiMutation<DetailResponse, { email: string; source?: string; website?: string }>(
    "/api/newsletter/subscribe/",
    PUBLIC,
  );
}

export function useConfirmSubscription() {
  return useApiMutation<DetailResponse, { token: string }>(
    "/api/newsletter/confirm/",
    PUBLIC,
  );
}

export function useUnsubscribe() {
  return useApiMutation<DetailResponse, { token: string }>(
    "/api/newsletter/unsubscribe/",
    PUBLIC,
  );
}
