import { authClient } from "./auth";

const API_BASE = "/api/v1";

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Get JWT token from BetterAuth for Go Fiber API calls
  try {
    const { data, error } = await authClient.$fetch("/token", {
      method: "GET",
    });
    if (error) {
      console.warn("[apiFetch] Token fetch error:", error);
    } else if (data && typeof data === "object" && "token" in data) {
      headers["Authorization"] = `Bearer ${(data as { token: string }).token}`;
    }
  } catch (e) {
    console.warn("[apiFetch] Token fetch failed:", e);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      ...headers,
      ...options?.headers,
    },
    ...options,
  });

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
