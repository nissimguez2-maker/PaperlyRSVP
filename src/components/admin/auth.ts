/**
 * Shared client-side admin auth + fetch helpers for the control-panel React
 * islands (Dashboard / Media / Responses).
 *
 * Auth model (preserved exactly from the old vanilla-JS panel): the admin
 * password is read from sessionStorage["pl_admin"]; if absent it's prompted
 * once and stored. Every admin API call sends `Authorization: Basic
 * btoa("admin:" + pw)`. On a 401 the cached password is cleared so the caller
 * can show a "wrong password / try again" state.
 */

const PW_KEY = "pl_admin";

/** Read the cached admin password, prompting once (and caching) if missing. */
export function adminPw(): string {
  let pw = sessionStorage.getItem(PW_KEY);
  if (!pw) {
    pw = window.prompt("Enter the admin password:") || "";
    if (pw) sessionStorage.setItem(PW_KEY, pw);
  }
  return pw;
}

/** Forget the cached password (called on a 401). */
export function clearAdminPw(): void {
  sessionStorage.removeItem(PW_KEY);
}

/** Build admin auth headers, merging any extras (e.g. Content-Type). */
export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { Authorization: "Basic " + btoa("admin:" + adminPw()), ...extra };
}

/** Extract a human-readable error message from a failed Response. */
export async function errText(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string };
    return j.error || JSON.stringify(j);
  } catch {
    return `Error ${res.status}`;
  }
}

/** Sentinel thrown by adminFetch on a 401 so callers can render the auth gate. */
export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

/**
 * fetch() wrapper that injects admin auth headers and, on a 401, clears the
 * cached password and throws UnauthorizedError. Other non-OK responses are
 * returned as-is for the caller to inspect.
 */
export async function adminFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(input, {
    ...init,
    headers: authHeaders((init.headers as Record<string, string>) ?? {}),
  });
  if (res.status === 401) {
    clearAdminPw();
    throw new UnauthorizedError();
  }
  return res;
}
