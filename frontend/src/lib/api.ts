import { authClient } from "./auth";

const API_BASE = "/api/v1";

// Active organization ID — set by OrgProvider
let activeOrgId: string | null = null;

export function setActiveOrgId(orgId: string | null) {
  activeOrgId = orgId;
}

// Cache the JWT token to avoid fetching on every request.
// The token expires in 15m server-side; we refresh after 13m.
let cachedToken: string | null = null;
let tokenExpiresAt = 0;
let tokenPromise: Promise<string | null> | null = null;

const TOKEN_LIFETIME = 13 * 60 * 1000; // 13 minutes

async function fetchToken(): Promise<string | null> {
  try {
    const { data, error } = await authClient.$fetch("/token", {
      method: "GET",
    });
    if (!error && data && typeof data === "object" && "token" in data) {
      return (data as { token: string }).token;
    }
  } catch {
    // fall through
  }
  return null;
}

async function getToken(forceRefresh = false): Promise<string | null> {
  // Return cached token if still valid
  if (!forceRefresh && cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  // Deduplicate concurrent token fetches
  if (!tokenPromise) {
    tokenPromise = fetchToken().finally(() => {
      tokenPromise = null;
    });
  }

  const token = await tokenPromise;
  if (token) {
    cachedToken = token;
    tokenExpiresAt = Date.now() + TOKEN_LIFETIME;
  } else {
    cachedToken = null;
    tokenExpiresAt = 0;
  }
  return token;
}

/** Invalidate the cached token (e.g. on sign-out). */
export function clearTokenCache() {
  cachedToken = null;
  tokenExpiresAt = 0;
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const token = await getToken();

  const doFetch = async (authToken: string | null) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    if (activeOrgId) {
      headers["X-Organization-Id"] = activeOrgId;
    }

    return fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...headers,
        ...options?.headers,
      },
    });
  };

  let res = await doFetch(token);

  // If 401, force-refresh the token and retry once
  if (res.status === 401) {
    const freshToken = await getToken(true);
    if (freshToken && freshToken !== token) {
      res = await doFetch(freshToken);
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const error = new Error(
      body?.error || `API error: ${res.status} ${res.statusText}`
    );
    (error as any).status = res.status;
    (error as any).code = body?.code;
    throw error;
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}
